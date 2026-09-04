// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./RandomnessRouter420.sol";

/// @notice Canonical read-only result envelope for first-party 420Bet casino wagers.
/// @dev Game-specific detail remains in the versioned per-game view contracts. This adapter
///      only normalizes shared wager, randomness, and terminal-settlement fields for wallets,
///      indexers, and the common casino shell. It has no mutation, custody, or settlement authority.
contract CasinoResultAdapter420 is I420System {
    struct Envelope {
        bytes32 wagerId;
        address player;
        bytes32 gameId;
        bytes32 gameVersionId;
        bytes32 rulesetId;
        address asset;
        uint256 stake;
        uint256 maxGrossPayout;
        bytes32 paramsHash;
        BetTypes420.WagerStatus wagerStatus;
        uint64 acceptedAt;
        uint64 deadline;
        bool randomnessRequested;
        bool randomnessFulfilled;
        bytes32 randomnessRoot;
        bool settlementAvailable;
        BetTypes420.TerminalOutcome outcome;
        uint256 grossPayout;
        uint64 settledAt;
    }

    BetRegistry420 public immutable registry;
    RandomnessRouter420 public immutable randomness;

    error ZeroAddress();

    constructor(address registry_, address randomness_) {
        if (registry_ == address(0) || randomness_ == address(0)) revert ZeroAddress();
        registry = BetRegistry420(registry_);
        randomness = RandomnessRouter420(randomness_);
    }

    function systemName() external pure returns (string memory) { return "CasinoResultAdapter420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function envelope(bytes32 wagerId) external view returns (Envelope memory out) {
        BetTypes420.Wager memory wager = registry.getWager(wagerId);
        out.wagerId = wager.wagerId;
        out.player = wager.player;
        out.gameId = wager.gameId;
        out.gameVersionId = wager.gameVersionId;
        out.rulesetId = wager.rulesetId;
        out.asset = wager.asset;
        out.stake = wager.stake;
        out.maxGrossPayout = wager.maxGrossPayout;
        out.paramsHash = wager.paramsHash;
        out.wagerStatus = wager.status;
        out.acceptedAt = wager.acceptedAt;
        out.deadline = wager.deadline;

        try randomness.getRequest(wagerId) returns (RandomnessRouter420.RandomnessRequest memory request) {
            out.randomnessRequested = true;
            out.randomnessFulfilled = request.fulfilled;
            out.randomnessRoot = request.root;
        } catch {}

        if (registry.settlementExists(wagerId)) {
            BetTypes420.Settlement memory settlement = registry.getSettlement(wagerId);
            out.settlementAvailable = true;
            out.outcome = settlement.outcome;
            out.grossPayout = settlement.grossPayout;
            out.settledAt = settlement.settledAt;
        }
    }
}
