// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./CrashV1420.sol";
import "./RandomnessRouter420.sol";

/// @notice Read-only client snapshot for a Crash V1 wager.
/// @dev V1 manual cash-out is intentionally disabled while canonical randomness is public pre-session.
contract CrashViewAdapter420 is I420System {
    struct Snapshot {
        bytes32 wagerId; address player; bytes32 gameId; bytes32 gameVersionId; bytes32 rulesetId; address asset;
        uint256 stake; uint256 maxGrossPayout; BetTypes420.WagerStatus wagerStatus; uint64 acceptedAt; uint64 deadline;
        bool randomnessRequested; bool randomnessFulfilled; RandomnessRouter420.Source randomnessSource; bytes32 randomnessRoot;
        bool sessionExists; CrashV1420.Phase phase; CrashV1420.TerminalReason terminalReason; uint64 autoCashoutBps;
        uint64 crashPointBps; uint64 startedAt; uint64 currentMultiplierBps; uint64 cashoutMultiplierBps;
        bool canManualCashOut; bool autoCashoutArmed; bool settlementAvailable; BetTypes420.TerminalOutcome outcome;
        uint256 settledGrossPayout; uint64 settledAt;
    }

    CrashV1420 public immutable crash; BetRegistry420 public immutable registry; RandomnessRouter420 public immutable randomness;
    error ZeroAddress(); error WrongGameVersion();

    constructor(address crash_) { if (crash_ == address(0)) revert ZeroAddress(); crash=CrashV1420(crash_); registry=crash.wagerRegistry(); randomness=crash.randomnessRouter(); }
    function systemName() external pure returns (string memory) { return "CrashViewAdapter420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function snapshot(bytes32 wagerId) external view returns (Snapshot memory out) {
        BetTypes420.Wager memory wager=registry.getWager(wagerId); if(wager.gameVersionId!=crash.gameVersionId()) revert WrongGameVersion();
        out.wagerId=wager.wagerId; out.player=wager.player; out.gameId=wager.gameId; out.gameVersionId=wager.gameVersionId; out.rulesetId=wager.rulesetId;
        out.asset=wager.asset; out.stake=wager.stake; out.maxGrossPayout=wager.maxGrossPayout; out.wagerStatus=wager.status; out.acceptedAt=wager.acceptedAt; out.deadline=wager.deadline;
        try randomness.getRequest(wagerId) returns (RandomnessRouter420.RandomnessRequest memory request) { out.randomnessRequested=true; out.randomnessFulfilled=request.fulfilled; out.randomnessSource=request.source; out.randomnessRoot=request.root; } catch {}
        try crash.getSession(wagerId) returns (CrashV1420.SessionState memory session) {
            out.sessionExists=true; out.phase=session.phase; out.terminalReason=session.terminalReason; out.autoCashoutBps=session.autoCashoutBps;
            out.crashPointBps=session.crashPointBps; out.startedAt=session.startedAt; out.cashoutMultiplierBps=session.cashoutMultiplierBps;
            try crash.currentMultiplierBps(wagerId) returns (uint64 multiplier) { out.currentMultiplierBps=multiplier; } catch {}
            out.canManualCashOut=false;
            out.autoCashoutArmed=session.phase==CrashV1420.Phase.ACTIVE && session.autoCashoutBps<session.crashPointBps;
        } catch {}
        if(registry.settlementExists(wagerId)){BetTypes420.Settlement memory settlement=registry.getSettlement(wagerId); out.settlementAvailable=true; out.outcome=settlement.outcome; out.settledGrossPayout=settlement.grossPayout; out.settledAt=settlement.settledAt;}
    }
}
