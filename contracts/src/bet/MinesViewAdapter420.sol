// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./MinesV1420.sol";
import "./RandomnessRouter420.sol";

/// @notice Read-only client snapshot for a Mines V1 wager.
/// @dev Aggregates canonical wager, randomness, hidden-board, session, progressive payout,
///      and settlement state without introducing mutation, custody, randomness, or settlement authority.
contract MinesViewAdapter420 is I420System {
    struct Snapshot {
        bytes32 wagerId;
        address player;
        bytes32 gameId;
        bytes32 gameVersionId;
        bytes32 rulesetId;
        address asset;
        uint256 stake;
        uint256 maxGrossPayout;
        uint256 requiredMaxGrossPayout;
        BetTypes420.WagerStatus wagerStatus;
        uint64 acceptedAt;
        uint64 deadline;
        bool randomnessRequested;
        bool randomnessFulfilled;
        RandomnessRouter420.Source randomnessSource;
        bytes32 randomnessRoot;
        bool seedCommitted;
        bool boardBound;
        bytes32 boardRoot;
        bool sessionExists;
        MinesV1420.Phase phase;
        uint8 mineCount;
        uint8 safeReveals;
        uint32 revealedMask;
        uint256 currentGrossPayout;
        uint256 cashoutGrossPayout;
        bool mineHit;
        bool cashedOut;
        bool canCashOut;
        bool settlementAvailable;
        BetTypes420.TerminalOutcome outcome;
        uint256 settledGrossPayout;
        uint64 settledAt;
    }

    MinesV1420 public immutable mines;
    BetRegistry420 public immutable registry;
    RandomnessRouter420 public immutable randomness;

    error ZeroAddress();
    error WrongGameVersion();

    constructor(address mines_) {
        if (mines_ == address(0)) revert ZeroAddress();
        mines = MinesV1420(mines_);
        registry = mines.wagerRegistry();
        randomness = mines.randomnessRouter();
    }

    function systemName() external pure returns (string memory) { return "MinesViewAdapter420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    /// @notice Return one UI/indexer-friendly snapshot across the full Mines lifecycle.
    function snapshot(bytes32 wagerId) external view returns (Snapshot memory out) {
        BetTypes420.Wager memory wager = registry.getWager(wagerId);
        if (wager.gameVersionId != mines.gameVersionId()) revert WrongGameVersion();

        out.wagerId = wager.wagerId;
        out.player = wager.player;
        out.gameId = wager.gameId;
        out.gameVersionId = wager.gameVersionId;
        out.rulesetId = wager.rulesetId;
        out.asset = wager.asset;
        out.stake = wager.stake;
        out.maxGrossPayout = wager.maxGrossPayout;
        out.wagerStatus = wager.status;
        out.acceptedAt = wager.acceptedAt;
        out.deadline = wager.deadline;

        try randomness.getRequest(wagerId) returns (RandomnessRouter420.RandomnessRequest memory request) {
            out.randomnessRequested = true;
            out.randomnessFulfilled = request.fulfilled;
            out.randomnessSource = request.source;
            out.randomnessRoot = request.root;

            if (request.source == RandomnessRouter420.Source.PRIMARY || request.source == RandomnessRouter420.Source.FALLBACK) {
                try mines.getBoard(wagerId, request.source) returns (MinesV1420.BoardCommitment memory board) {
                    out.seedCommitted = board.seedCommitted;
                    out.boardBound = board.boardBound;
                    out.boardRoot = board.boardRoot;
                } catch {}
            }
        } catch {}

        try mines.getSession(wagerId) returns (MinesV1420.SessionState memory session) {
            out.sessionExists = true;
            out.phase = session.phase;
            out.mineCount = session.mineCount;
            out.safeReveals = session.safeReveals;
            out.revealedMask = session.revealedMask;
            out.currentGrossPayout = session.currentGrossPayout;
            out.cashoutGrossPayout = session.cashoutGrossPayout;
            out.mineHit = session.mineHit;
            out.cashedOut = session.cashedOut;
            out.canCashOut = session.phase == MinesV1420.Phase.ACTIVE
                && session.safeReveals != 0
                && session.currentGrossPayout != 0;

            if (session.mineCount >= mines.MIN_MINES() && session.mineCount <= mines.MAX_MINES() && wager.stake != 0) {
                out.requiredMaxGrossPayout = mines.requiredMaxGrossPayout(wager.stake, session.mineCount);
            }
        } catch {}

        if (registry.settlementExists(wagerId)) {
            BetTypes420.Settlement memory settlement = registry.getSettlement(wagerId);
            out.settlementAvailable = true;
            out.outcome = settlement.outcome;
            out.settledGrossPayout = settlement.grossPayout;
            out.settledAt = settlement.settledAt;
        }
    }
}
