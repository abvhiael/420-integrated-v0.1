// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./SportsMarketRegistry420.sol";

/// @notice Two distinct independent evidence signers and a separately designated adjudicator.
/// @dev Governance must verify organizational independence off-chain; address checks are necessary, not sufficient.
contract SportsOutcomeCertification420 {
    enum Status { NONE, PROPOSED, CHALLENGED, FINAL, VOID }
    enum SpecialKind { NONE, PUSH, NO_ACTION, DEAD_HEAT }
    bytes32 public constant PUSH_RESULT = keccak256("420.BET.SPORT.OUTCOME.PUSH.V1");
    bytes32 public constant NO_ACTION_RESULT = keccak256("420.BET.SPORT.OUTCOME.NO_ACTION.V1");
    bytes32 public constant DEAD_HEAT_RESULT = keccak256("420.BET.SPORT.OUTCOME.DEAD_HEAT.V1");
    struct SpecialOutcome {
        SpecialKind kind;
        bytes32 firstSelection;
        bytes32 secondSelection;
    }
    mapping(bytes32 => SpecialOutcome) private specialOutcomes;
    event SpecialAttested(bytes32 indexed marketId, SpecialKind kind, bytes32 first, bytes32 second, address reporter);
    function specialOutcome(bytes32 marketId) external view returns (SpecialOutcome memory) {
        return specialOutcomes[marketId];
    }
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
        if (selection == PUSH_RESULT || selection == NO_ACTION_RESULT || selection == DEAD_HEAT_RESULT) revert Invalid();
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

    /// @notice Two independent reporters must agree on special settlement terms.
    /// Dead heat uses an exact two-way split; both selections are frozen on attestation.
    function attestSpecial(bytes32 marketId, SpecialKind kind, bytes32 first, bytes32 second, bytes32 evidence) external {
        if (msg.sender != reporterA && msg.sender != reporterB) revert Unauthorized();
        SportsMarketRegistry420.Record memory m = markets.get(marketId);
        if (block.timestamp < m.config.cutoff || evidence == bytes32(0)
            || reports[marketId][msg.sender] != bytes32(0) || results[marketId].status != Status.NONE)
            revert Invalid();
        bytes32[] memory selections = markets.selections(marketId);
        if (kind == SpecialKind.PUSH) {
            SportsTypes420.Kind k = markets.getTemplate(m.config.templateId).config.kind;
            if (k != SportsTypes420.Kind.SPREAD && k != SportsTypes420.Kind.TOTAL) revert Invalid();
            if (first != bytes32(0) || second != bytes32(0)) revert Invalid();
        } else if (kind == SpecialKind.NO_ACTION) {
            if (first != bytes32(0) || second != bytes32(0)) revert Invalid();
        } else if (kind == SpecialKind.DEAD_HEAT) {
            SportsTypes420.Kind k = markets.getTemplate(m.config.templateId).config.kind;
            if (k != SportsTypes420.Kind.MONEYLINE_TWO && k != SportsTypes420.Kind.MONEYLINE_THREE)
                revert Invalid();
            if (first == bytes32(0) || second == bytes32(0) || first >= second) revert Invalid();
            bool foundFirst;
            bool foundSecond;
            for (uint256 i; i < selections.length; ++i) {
                if (selections[i] == first) foundFirst = true;
                if (selections[i] == second) foundSecond = true;
            }
            if (!foundFirst || !foundSecond) revert Invalid();
        } else revert Invalid();

        bytes32 marker = kind == SpecialKind.PUSH ? PUSH_RESULT
            : kind == SpecialKind.NO_ACTION ? NO_ACTION_RESULT : DEAD_HEAT_RESULT;
        bytes32 claim = keccak256(abi.encode("420.BET.SPORT.SPECIAL.V1", block.chainid,
            address(this), marketId, kind, first, second, evidence));
        reports[marketId][msg.sender] = claim;
        emit SpecialAttested(marketId, kind, first, second, msg.sender);
        address other = msg.sender == reporterA ? reporterB : reporterA;
        if (reports[marketId][other] != bytes32(0)) {
            if (reports[marketId][other] != claim) revert Conflict();
            specialOutcomes[marketId] = SpecialOutcome(kind, first, second);
            results[marketId] = Result(marker, evidence, uint64(block.timestamp),
                Status.PROPOSED, reporterA, reporterB, address(0), bytes32(0));
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
