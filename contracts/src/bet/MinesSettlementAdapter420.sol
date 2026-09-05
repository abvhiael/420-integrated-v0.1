// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./MinesV1420.sol";
import "./SettlementEngine420.sol";

/// @notice Canonical settlement bridge for Mines V1 terminal sessions.
/// @dev MinesV1420 remains custody- and settlement-authority-free. This adapter derives the
///      only valid terminal tuple from locked game state and forwards it to SettlementEngine420.
///      ACTION_SETTLE should be granted to this adapter, never to the game module itself.
contract MinesSettlementAdapter420 is I420System {
    MinesV1420 public immutable mines;
    SettlementEngine420 public immutable settlementEngine;
    BetRegistry420 public immutable wagerRegistry;

    error ZeroAddress();
    error SessionNotTerminal();
    error InvalidTerminalState();
    error WrongGameVersion();
    error InvalidPayout();

    event MinesSettlementSubmitted(
        bytes32 indexed wagerId,
        BetTypes420.TerminalOutcome outcome,
        uint256 grossPayout
    );

    constructor(address mines_, address settlementEngine_) {
        if (mines_ == address(0) || settlementEngine_ == address(0)) revert ZeroAddress();
        mines = MinesV1420(mines_);
        settlementEngine = SettlementEngine420(settlementEngine_);
        wagerRegistry = mines.wagerRegistry();
    }

    function systemName() external pure returns (string memory) { return "MinesSettlementAdapter420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    /// @notice Derive the unique canonical terminal tuple from Mines session state.
    function terminalResult(bytes32 wagerId)
        public
        view
        returns (BetTypes420.TerminalOutcome outcome, uint256 grossPayout)
    {
        MinesV1420.SessionState memory session = mines.getSession(wagerId);
        if (session.phase != MinesV1420.Phase.TERMINAL) revert SessionNotTerminal();

        BetTypes420.Wager memory wager = wagerRegistry.getWager(wagerId);
        if (wager.gameVersionId != mines.gameVersionId()) revert WrongGameVersion();

        if (session.mineHit) {
            if (session.cashedOut || session.cashoutGrossPayout != 0 || session.currentGrossPayout != 0) {
                revert InvalidTerminalState();
            }
            return (BetTypes420.TerminalOutcome.LOSS, 0);
        }

        if (!session.cashedOut || session.cashoutGrossPayout == 0) revert InvalidTerminalState();
        grossPayout = session.cashoutGrossPayout;
        if (grossPayout > wager.maxGrossPayout) revert InvalidPayout();
        if (grossPayout < wager.stake) revert InvalidPayout();

        outcome = grossPayout == wager.stake
            ? BetTypes420.TerminalOutcome.PUSH
            : BetTypes420.TerminalOutcome.WIN;
    }

    /// @notice Submit the already-locked Mines terminal result through the canonical engine.
    /// @dev SettlementEngine420 remains responsible for authorization, liability release,
    ///      custody, registry settlement, fee finalization, expiry and emergency semantics.
    function settle(bytes32 wagerId) external returns (BetTypes420.Settlement memory settlement) {
        (BetTypes420.TerminalOutcome outcome, uint256 grossPayout) = terminalResult(wagerId);
        settlement = settlementEngine.settle(wagerId, outcome, grossPayout);
        emit MinesSettlementSubmitted(wagerId, outcome, grossPayout);
    }
}
