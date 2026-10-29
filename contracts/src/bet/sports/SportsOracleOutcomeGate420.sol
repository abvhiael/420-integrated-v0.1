// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./SportsFundedTickets420.sol";
import "../../interfaces/IOracle420.sol";

/// @notice Oracle Interface Layer verification for independently certified sports results.
/// @dev This contract must be the ONLY principal granted the vault's RESOLVE capability
/// for oracle-gated markets. A legacy direct resolver grant bypasses this gate.
/// The canonical OracleRouter420 enforces publisher quorum and per-feed health policies.
/// The read is checked again atomically with the ticket's terminal transition.
contract SportsOracleOutcomeGate420 {
    IOracle420 public immutable oracle;
    SportsFundedTickets420 public immutable vault;
    SportsOutcomeCertification420 public immutable certification;
    SportsMarketRegistry420 public immutable markets;
    uint64 public immutable maxAge;
    uint16 public immutable minConfidenceBps;
    uint16 public immutable minAgreeingSources;

    error Invalid();
    error Unverified();

    event OracleTicketResolved(bytes32 indexed ticketId, bytes32 indexed marketId, bytes32 indexed feedId, bytes32 resultHash);

    constructor(address oracle_, address vault_, uint64 maxAge_, uint16 minConfidence_, uint16 minSources_) {
        if (oracle_.code.length == 0 || vault_.code.length == 0 || maxAge_ == 0
            || minSources_ < 2 || minConfidence_ > 10_000) revert Invalid();
        oracle = IOracle420(oracle_);
        vault = SportsFundedTickets420(vault_);
        certification = vault.certification();
        markets = vault.markets();
        maxAge = maxAge_;
        minConfidenceBps = minConfidence_;
        minAgreeingSources = minSources_;
    }

    function feedFor(bytes32 marketId) public pure returns (bytes32) {
        return keccak256(abi.encode("420.BET.SPORT.RESULT.FEED.V1", marketId));
    }

    function commitment(bytes32 marketId, bytes32 selection, bytes32 evidence) public view returns (bytes32) {
        return keccak256(abi.encode("420.BET.SPORT.RESULT.V1", block.chainid,
            address(markets), marketId, selection, evidence));
    }

    /// @notice Relayers need no asset authority. Vault checks the gate's scoped
    /// RESOLVE capability; this gate checks independently verified oracle data.
    /// @notice Special outcomes require the same independent Oracle commitment as winners.
    function settleSpecial(bytes32 ticketId) external {
        SportsFundedTickets420.Ticket memory ticket = vault.get(ticketId);
        if (ticket.state != SportsFundedTickets420.TicketState.FUNDED) revert Invalid();
        SportsOutcomeCertification420.Result memory outcome = certification.result(ticket.marketId);
        if (outcome.status != SportsOutcomeCertification420.Status.FINAL) revert Unverified();
        SportsOutcomeCertification420.SpecialOutcome memory special = certification.specialOutcome(ticket.marketId);
        if (special.kind == SportsOutcomeCertification420.SpecialKind.NONE) revert Unverified();
        bytes32 feed = feedFor(ticket.marketId);
        IOracle420.ResultRead memory read = oracle.readResult(feed);
        if (read.updatedAt == 0 || read.updatedAt > block.timestamp
            || block.timestamp - read.updatedAt > maxAge
            || read.agreeingSources < minAgreeingSources
            || read.confidenceBps < minConfidenceBps
            || read.resultHash != commitment(ticket.marketId, outcome.selection, outcome.evidence))
            revert Unverified();
        vault.resolveSpecial(ticketId);
        emit OracleTicketResolved(ticketId, ticket.marketId, feed, read.resultHash);
    }

    function settle(bytes32 ticketId, bool won) external {
        SportsFundedTickets420.Ticket memory ticket = vault.get(ticketId);
        if (ticket.state != SportsFundedTickets420.TicketState.FUNDED) revert Invalid();
        SportsOutcomeCertification420.Result memory outcome = certification.result(ticket.marketId);
        if (outcome.status != SportsOutcomeCertification420.Status.FINAL) revert Unverified();
        bytes32 feed = feedFor(ticket.marketId);
        IOracle420.ResultRead memory read = oracle.readResult(feed);
        if (read.updatedAt == 0 || read.updatedAt > block.timestamp
            || block.timestamp - read.updatedAt > maxAge
            || read.agreeingSources < minAgreeingSources
            || read.confidenceBps < minConfidenceBps
            || read.resultHash != commitment(ticket.marketId, outcome.selection, outcome.evidence))
            revert Unverified();
        vault.resolve(ticketId, won);
        emit OracleTicketResolved(ticketId, ticket.marketId, feed, read.resultHash);
    }
}
