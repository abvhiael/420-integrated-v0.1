// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/CrashV1420.sol";
import "../src/bet/CrashViewAdapter420.sol";
import "../src/bet/RandomnessRouter420.sol";

interface VmBetCrashView420 { function prank(address) external; function warp(uint256) external; }

contract MockCrashViewRegistry420 {
    mapping(bytes32=>BetTypes420.Wager) private _wagers; mapping(bytes32=>BetTypes420.Settlement) private _settlements; mapping(bytes32=>bool) private _settled;
    function setWager(BetTypes420.Wager calldata wager_) external {_wagers[wager_.wagerId]=wager_;}
    function getWager(bytes32 wagerId) external view returns(BetTypes420.Wager memory wager){wager=_wagers[wagerId];require(wager.wagerId!=bytes32(0),"wager");}
    function setSettlement(BetTypes420.Settlement calldata settlement_) external {_settlements[settlement_.wagerId]=settlement_;_settled[settlement_.wagerId]=true;}
    function settlementExists(bytes32 wagerId) external view returns(bool){return _settled[wagerId];}
    function getSettlement(bytes32 wagerId) external view returns(BetTypes420.Settlement memory){require(_settled[wagerId],"settlement");return _settlements[wagerId];}
}

contract MockCrashViewRandomness420 {
    mapping(bytes32=>RandomnessRouter420.RandomnessRequest) private _requests;
    function setRequest(RandomnessRouter420.RandomnessRequest calldata request_) external {_requests[request_.wagerId]=request_;}
    function getRequest(bytes32 wagerId) external view returns(RandomnessRouter420.RandomnessRequest memory request){request=_requests[wagerId];require(request.wagerId!=bytes32(0),"request");}
}

contract BetCrashViewAdapter420Test {
    VmBetCrashView420 constant vm=VmBetCrashView420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant PLAYER=address(0xBEEF); address constant ASSET=address(0xCA0C);
    bytes32 constant GAME=keccak256("420BET.GAME.CRASH"); bytes32 constant GAME_V1=keccak256("420BET.GAME.CRASH.V1"); bytes32 constant RULESET=keccak256("420BET.RULESET.CRASH.V1");
    MockCrashViewRegistry420 private registry; MockCrashViewRandomness420 private randomness; CrashV1420 private crash; CrashViewAdapter420 private viewAdapter;

    constructor(){registry=new MockCrashViewRegistry420();randomness=new MockCrashViewRandomness420();crash=new CrashV1420(address(registry),address(randomness),GAME,GAME_V1,RULESET);viewAdapter=new CrashViewAdapter420(address(crash));}

    function _wager(bytes32 wagerId,CrashV1420.Params memory params) private view returns(BetTypes420.Wager memory wager){wager=BetTypes420.Wager({wagerId:wagerId,player:PLAYER,operatorId:keccak256("operator"),gameId:GAME,gameVersionId:GAME_V1,asset:ASSET,stake:100 ether,maxGrossPayout:1000 ether,paramsHash:crash.hashParams(params),vaultId:keccak256("vault"),randomnessProfileId:keccak256("randomness"),riskProfileId:keccak256("risk"),settlementProfileId:keccak256("settlement"),accessPolicyId:keccak256("access"),rulesetId:RULESET,acceptedAt:uint64(block.timestamp),deadline:uint64(block.timestamp+1 hours),status:BetTypes420.WagerStatus.ACCEPTED});}

    function _prepare(bytes32 wagerId,CrashV1420.Params memory params,bytes32 root) private returns(BetTypes420.Wager memory wager){wager=_wager(wagerId,params);registry.setWager(wager);randomness.setRequest(RandomnessRouter420.RandomnessRequest({wagerId:wagerId,profileId:wager.randomnessProfileId,gameVersionId:wager.gameVersionId,paramsHash:wager.paramsHash,contextHash:keccak256(abi.encode("crash/view",wagerId)),requestedAt:uint64(block.timestamp),fallbackAt:uint64(block.timestamp+5 minutes),root:root,proofHash:keccak256("proof"),entropyHash:keccak256("entropy"),source:RandomnessRouter420.Source.PRIMARY,fulfilled:true}));}

    function testPreSessionSnapshotShowsCanonicalWagerAndRandomness() public {bytes32 wagerId=keccak256("pre");CrashV1420.Params memory params=CrashV1420.Params({autoCashoutBps:20_000});_prepare(wagerId,params,keccak256("pre/root"));CrashViewAdapter420.Snapshot memory s=viewAdapter.snapshot(wagerId);require(s.wagerId==wagerId&&s.player==PLAYER,"identity");require(s.randomnessRequested&&s.randomnessFulfilled,"randomness");require(!s.sessionExists,"session");}

    function testActiveSnapshotExposesAutoOnlyFlags() public {bytes32 wagerId=keccak256("active");CrashV1420.Params memory params=CrashV1420.Params({autoCashoutBps:30_000});_prepare(wagerId,params,keccak256("active/root"));vm.prank(PLAYER);crash.startSession(wagerId,params);CrashViewAdapter420.Snapshot memory s=viewAdapter.snapshot(wagerId);require(s.sessionExists&&s.phase==CrashV1420.Phase.ACTIVE,"phase");require(!s.canManualCashOut,"manual must stay disabled");require(s.autoCashoutArmed==(s.autoCashoutBps<s.crashPointBps),"auto flag");}

    function testTerminalSnapshotLocksAutoOrCrashReason() public {bytes32 wagerId=keccak256("terminal");CrashV1420.Params memory params=CrashV1420.Params({autoCashoutBps:15_000});_prepare(wagerId,params,keccak256("terminal/root"));vm.prank(PLAYER);crash.startSession(wagerId,params);vm.warp(block.timestamp+100);crash.advance(wagerId);CrashViewAdapter420.Snapshot memory s=viewAdapter.snapshot(wagerId);require(s.phase==CrashV1420.Phase.TERMINAL,"terminal");require(s.terminalReason==CrashV1420.TerminalReason.AUTO_CASHOUT||s.terminalReason==CrashV1420.TerminalReason.CRASHED,"reason");require(!s.canManualCashOut&&!s.autoCashoutArmed,"flags");}

    function testSettlementIsSurfacedReadOnly() public {bytes32 wagerId=keccak256("settled");CrashV1420.Params memory params=CrashV1420.Params({autoCashoutBps:20_000});_prepare(wagerId,params,keccak256("settled/root"));registry.setSettlement(BetTypes420.Settlement({wagerId:wagerId,outcome:BetTypes420.TerminalOutcome.WIN,grossPayout:150 ether,settledAt:uint64(block.timestamp)}));CrashViewAdapter420.Snapshot memory s=viewAdapter.snapshot(wagerId);require(s.settlementAvailable,"settlement");require(s.outcome==BetTypes420.TerminalOutcome.WIN,"outcome");require(s.settledGrossPayout==150 ether,"gross");}
}
