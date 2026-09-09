// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/CrashV1420.sol";
import "../src/bet/CrashSettlementAdapter420.sol";

interface VmBetCrashSettlement420 { function expectRevert(bytes4) external; }

contract MockCrashSettlementRegistry420 {
    BetTypes420.Wager private _wager;
    function setWager(BetTypes420.Wager calldata wager_) external { _wager=wager_; }
    function getWager(bytes32 wagerId) external view returns(BetTypes420.Wager memory wager){require(_wager.wagerId==wagerId,"wager");return _wager;}
}

contract MockCrashSettlementSource420 {
    address public wagerRegistry; bytes32 public gameVersionId; uint64 public constant BPS=10_000; CrashV1420.SessionState private _session;
    constructor(address registry_,bytes32 gameVersionId_){wagerRegistry=registry_;gameVersionId=gameVersionId_;}
    function setSession(CrashV1420.SessionState calldata session_) external {_session=session_;}
    function getSession(bytes32) external view returns(CrashV1420.SessionState memory){return _session;}
}

contract MockCrashSettlementEngine420 {
    bytes32 public lastWagerId; BetTypes420.TerminalOutcome public lastOutcome; uint256 public lastGrossPayout; address public lastCaller;
    function settle(bytes32 wagerId,BetTypes420.TerminalOutcome outcome,uint256 grossPayout) external returns(BetTypes420.Settlement memory settlement){lastWagerId=wagerId;lastOutcome=outcome;lastGrossPayout=grossPayout;lastCaller=msg.sender;settlement=BetTypes420.Settlement({wagerId:wagerId,outcome:outcome,grossPayout:grossPayout,settledAt:uint64(block.timestamp)});}
}

contract BetCrashSettlementAdapter420Test {
    VmBetCrashSettlement420 constant vm=VmBetCrashSettlement420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant WAGER=keccak256("crash/settlement/wager"); bytes32 constant GAME=keccak256("420BET.GAME.CRASH"); bytes32 constant GAME_V1=keccak256("420BET.GAME.CRASH.V1"); bytes32 constant RULESET=keccak256("420BET.RULESET.CRASH.V1");
    address constant PLAYER=address(0xC0FFEE); uint256 constant STAKE=100 ether; uint256 constant MAX_GROSS=500 ether;
    struct Suite {MockCrashSettlementRegistry420 registry;MockCrashSettlementSource420 crash;MockCrashSettlementEngine420 engine;CrashSettlementAdapter420 adapter;}

    function _deploy() private returns(Suite memory s){s.registry=new MockCrashSettlementRegistry420();s.crash=new MockCrashSettlementSource420(address(s.registry),GAME_V1);s.engine=new MockCrashSettlementEngine420();s.adapter=new CrashSettlementAdapter420(address(s.crash),address(s.engine));s.registry.setWager(BetTypes420.Wager({wagerId:WAGER,player:PLAYER,operatorId:keccak256("operator"),gameId:GAME,gameVersionId:GAME_V1,asset:address(0),stake:STAKE,maxGrossPayout:MAX_GROSS,paramsHash:keccak256("params"),vaultId:keccak256("vault"),randomnessProfileId:keccak256("randomness"),riskProfileId:keccak256("risk"),settlementProfileId:keccak256("settlement"),accessPolicyId:keccak256("access"),rulesetId:RULESET,acceptedAt:uint64(block.timestamp),deadline:uint64(block.timestamp+1 hours),status:BetTypes420.WagerStatus.ACCEPTED}));}

    function _session(CrashV1420.Phase phase,CrashV1420.TerminalReason reason,uint64 cashoutMultiplierBps,uint64 crashPointBps) private pure returns(CrashV1420.SessionState memory session){session=CrashV1420.SessionState({phase:phase,player:PLAYER,autoCashoutBps:20_000,crashPointBps:crashPointBps,startedAt:1,cashoutMultiplierBps:cashoutMultiplierBps,randomnessRoot:keccak256("root"),randomnessSource:RandomnessRouter420.Source.PRIMARY,terminalReason:reason,exists:true});}

    function testActiveSessionCannotSettle() public {Suite memory s=_deploy();s.crash.setSession(_session(CrashV1420.Phase.ACTIVE,CrashV1420.TerminalReason.NONE,0,30_000));vm.expectRevert(CrashSettlementAdapter420.SessionNotTerminal.selector);s.adapter.settle(WAGER);}

    function testCrashMapsToCanonicalLossZeroPayout() public {Suite memory s=_deploy();s.crash.setSession(_session(CrashV1420.Phase.TERMINAL,CrashV1420.TerminalReason.CRASHED,0,30_000));(BetTypes420.TerminalOutcome outcome,uint256 gross)=s.adapter.terminalResult(WAGER);require(outcome==BetTypes420.TerminalOutcome.LOSS&&gross==0,"loss");s.adapter.settle(WAGER);require(s.engine.lastCaller()==address(s.adapter),"authority");}

    function testAutoCashoutMapsToWinAndForwardsLockedPayout() public {Suite memory s=_deploy();s.crash.setSession(_session(CrashV1420.Phase.TERMINAL,CrashV1420.TerminalReason.AUTO_CASHOUT,25_000,30_000));s.adapter.settle(WAGER);require(s.engine.lastWagerId()==WAGER,"wager");require(s.engine.lastOutcome()==BetTypes420.TerminalOutcome.WIN,"outcome");require(s.engine.lastGrossPayout()==250 ether,"payout");}

    function testLegacyManualTerminalStateFailsClosed() public {Suite memory s=_deploy();s.crash.setSession(_session(CrashV1420.Phase.TERMINAL,CrashV1420.TerminalReason.MANUAL_CASHOUT,15_000,30_000));vm.expectRevert(CrashSettlementAdapter420.InvalidTerminalState.selector);s.adapter.terminalResult(WAGER);}

    function testImpossibleTerminalCombinationsFailClosed() public {Suite memory s=_deploy();s.crash.setSession(_session(CrashV1420.Phase.TERMINAL,CrashV1420.TerminalReason.NONE,0,30_000));vm.expectRevert(CrashSettlementAdapter420.InvalidTerminalState.selector);s.adapter.terminalResult(WAGER);s.crash.setSession(_session(CrashV1420.Phase.TERMINAL,CrashV1420.TerminalReason.CRASHED,10_000,30_000));vm.expectRevert(CrashSettlementAdapter420.InvalidTerminalState.selector);s.adapter.terminalResult(WAGER);s.crash.setSession(_session(CrashV1420.Phase.TERMINAL,CrashV1420.TerminalReason.AUTO_CASHOUT,30_000,30_000));vm.expectRevert(CrashSettlementAdapter420.InvalidTerminalState.selector);s.adapter.terminalResult(WAGER);}

    function testCashoutCannotExceedAcceptedReservedMaximum() public {Suite memory s=_deploy();s.crash.setSession(_session(CrashV1420.Phase.TERMINAL,CrashV1420.TerminalReason.AUTO_CASHOUT,60_000,70_000));vm.expectRevert(CrashSettlementAdapter420.InvalidPayout.selector);s.adapter.terminalResult(WAGER);}
}
