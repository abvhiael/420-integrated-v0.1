// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./SportsMarketRegistry420.sol";

/// @notice Two distinct independent evidence signers and a separately designated adjudicator.
/// @dev Governance must verify organizational independence off-chain; address checks are necessary, not sufficient.
contract SportsOutcomeCertification420 {
    enum Status { NONE, PROPOSED, CHALLENGED, FINAL, VOID }
    struct Result {
        bytes32 selection;
        bytes32 evidence;
        uint64 proposedAt;
        Status status;
        address first;
        address second;
        address challenger;
        bytes32 challengeEvidence;
    }
    SportsMarketRegistry420 public immutable markets;
    address public immutable reporterA;
    address public immutable reporterB;
    address public immutable adjudicator;
    uint64 public immutable challengePeriod;
    mapping(bytes32 => Result) private results;
    mapping(bytes32 => mapping(address => bytes32)) public reports;
    event Attested(bytes32 indexed marketId, address indexed reporter, bytes32 selection, bytes32 evidence);
    event Challenged(bytes32 indexed marketId, address indexed challenger, bytes32 evidence);
    event Finalized(bytes32 indexed marketId, bytes32 selection, bool voided, bytes32 evidence);
    error Invalid();
    error Unauthorized();
    error Conflict();

    constructor(address registry, address a, address b, address judge, uint64 period) {
        if (registry.code.length == 0) revert Invalid();
        markets = SportsMarketRegistry420(registry);
        if (a == address(0) || b == address(0) || judge == address(0)
            || a == b || a == judge || b == judge || period < 1 hours) revert Invalid();
        reporterA = a;
        reporterB = b;
        adjudicator = judge;
        challengePeriod = period;
    }

    function result(bytes32 marketId) external view returns (Result memory) { return results[marketId]; }

    function attest(bytes32 marketId, bytes32 selection, bytes32 evidence) external {
        if (msg.sender != reporterA && msg.sender != reporterB) revert Unauthorized();
        if (block.timestamp < markets.get(marketId).config.cutoff) revert Invalid();
        if (marketId == 0 || selection == 0 || evidence == 0 || reports[marketId][msg.sender] != 0
            || results[marketId].status != Status.NONE) revert Conflict();
        bytes32 claim = keccak256(abi.encode(block.chainid, address(this), marketId, selection, evidence));
        reports[marketId][msg.sender] = claim;
        emit Attested(marketId, msg.sender, selection, evidence);
        address other = msg.sender == reporterA ? reporterB : reporterA;
        if (reports[marketId][other] != 0) {
            if (reports[marketId][other] != claim) revert Conflict();
            results[marketId] = Result(selection, evidence, uint64(block.timestamp), Status.PROPOSED, reporterA, reporterB, address(0), bytes32(0));
        }
    }

    function challenge(bytes32 marketId, bytes32 evidence) external {
        Result storage r = results[marketId];
        if (r.status != Status.PROPOSED || evidence == 0 || block.timestamp >= uint256(r.proposedAt) + challengePeriod) revert Invalid();
        r.status = Status.CHALLENGED;
        r.challenger = msg.sender;
        r.challengeEvidence = evidence;
        emit Challenged(marketId, msg.sender, evidence);
    }

    function finalize(bytes32 marketId) external {
        Result storage r = results[marketId];
        if (r.status != Status.PROPOSED || block.timestamp < uint256(r.proposedAt) + challengePeriod) revert Invalid();
        r.status = Status.FINAL;
        emit Finalized(marketId, r.selection, false, r.evidence);
    }

    /// @notice Adjudicator may confirm the documented report or void. Cannot introduce a new winner.
    function decide(bytes32 marketId, bool voided, bytes32 evidence) external {
        if (msg.sender != adjudicator) revert Unauthorized();
        Result storage r = results[marketId];
        if (r.status != Status.CHALLENGED || evidence == 0) revert Invalid();
        r.status = voided ? Status.VOID : Status.FINAL;
        r.evidence = evidence;
        emit Finalized(marketId, r.selection, voided, evidence);
    }
}
