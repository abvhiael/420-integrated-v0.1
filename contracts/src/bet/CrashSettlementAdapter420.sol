// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./CrashV1420.sol";
import "./SettlementEngine420.sol";

/// @notice Canonical settlement bridge for hardened Crash V1 terminal sessions.
/// @dev V1 accepts only reachable AUTO_CASHOUT and CRASHED states; manual settlement is disabled.
contract CrashSettlementAdapter420 is I420System {
    CrashV1420 public immutable crash;
    SettlementEngine420 public immutable settlementEngine;
    BetRegistry420 public immutable wagerRegistry;

    error ZeroAddress();
    error SessionNotTerminal();
    error InvalidTerminalState();
    error WrongGameVersion();
    error InvalidPayout();

    event CrashSettlementSubmitted(bytes32 indexed wagerId, BetTypes420.TerminalOutcome outcome, uint256 grossPayout);

    constructor(address crash_, address settlementEngine_) {
        if (crash_ == address(0) || settlementEngine_ == address(0)) revert ZeroAddress();
        crash = CrashV1420(crash_);
        settlementEngine = SettlementEngine420(settlementEngine_);
        wagerRegistry = crash.wagerRegistry();
    }

    function systemName() external pure returns (string memory) { return "CrashSettlementAdapter420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function terminalResult(bytes32 wagerId)
        public
        view
        returns (BetTypes420.TerminalOutcome outcome, uint256 grossPayout)
    {
        CrashV1420.SessionState memory session = crash.getSession(wagerId);
        if (session.phase != CrashV1420.Phase.TERMINAL) revert SessionNotTerminal();

        BetTypes420.Wager memory wager = wagerRegistry.getWager(wagerId);
        if (wager.gameVersionId != crash.gameVersionId()) revert WrongGameVersion();

        if (session.terminalReason == CrashV1420.TerminalReason.CRASHED) {
            if (session.cashoutMultiplierBps != 0) revert InvalidTerminalState();
            return (BetTypes420.TerminalOutcome.LOSS, 0);
        }

        if (session.terminalReason != CrashV1420.TerminalReason.AUTO_CASHOUT) revert InvalidTerminalState();
        if (session.cashoutMultiplierBps <= crash.BPS()) revert InvalidTerminalState();
        if (session.cashoutMultiplierBps >= session.crashPointBps) revert InvalidTerminalState();
        if (wager.stake == 0 || uint256(session.cashoutMultiplierBps) > type(uint256).max / wager.stake) revert InvalidPayout();

        grossPayout = (wager.stake * uint256(session.cashoutMultiplierBps)) / uint256(crash.BPS());
        if (grossPayout > wager.maxGrossPayout || grossPayout <= wager.stake) revert InvalidPayout();
        outcome = BetTypes420.TerminalOutcome.WIN;
    }

    function settle(bytes32 wagerId) external returns (BetTypes420.Settlement memory settlement) {
        (BetTypes420.TerminalOutcome outcome, uint256 grossPayout) = terminalResult(wagerId);
        settlement = settlementEngine.settle(wagerId, outcome, grossPayout);
        emit CrashSettlementSubmitted(wagerId, outcome, grossPayout);
    }
}
