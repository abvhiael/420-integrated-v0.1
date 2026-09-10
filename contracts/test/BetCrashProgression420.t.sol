// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/CrashV1420.sol";
import "../src/bet/RandomnessRouter420.sol";

interface VmBetCrashProgression420 { function prank(address) external; function warp(uint256) external; function expectRevert(bytes4) external; }

contract MockCrashProgressionRegistry420 {
    mapping(bytes32 => BetTypes420.Wager) private _wagers;
    function setWager(BetTypes420.Wager calldata wager_) external { _wagers[wager_.wagerId] = wager_; }
    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) { wager = _wagers[wagerId]; require(wager.wagerId != bytes32(0), "wager"); }
}

contract MockCrashProgressionRandomness420 {
    mapping(bytes32 => RandomnessRouter420.RandomnessRequest) private _requests;
    function setRequest(RandomnessRouter420.RandomnessRequest calldata request_) external { _requests[request_.wagerId] = request_; }
    function getRequest(bytes32 wagerId) external view returns (RandomnessRouter420.RandomnessRequest memory request) { request = _requests[wagerId]; require(request.wagerId != bytes32(0), "request"); }
}

contract BetCrashProgression420Test {
    VmBetCrashProgression420 constant vm = VmBetCrashProgression420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant PLAYER=address(0xBEEF); address constant OTHER=address(0xCAFE); address constant ASSET=address(0xCA0C);
    bytes32 constant GAME=keccak256("420BET.GAME.CRASH"); bytes32 constant GAME_V1=keccak256("420BET.GAME.CRASH.V1"); bytes32 constant RULESET=keccak256("420BET.RULESET.CRASH.V1");
    MockCrashProgressionRegistry420 private registry; MockCrashProgressionRandomness420 private randomness; CrashV1420 private crash;

    constructor(){registry=new MockCrashProgressionRegistry420(); randomness=new MockCrashProgressionRandomness420(); crash=new CrashV1420(address(registry),address(randomness),GAME,GAME_V1,RULESET);}

    function _wager(bytes32 wagerId, CrashV1420.Params memory params) private view returns (BetTypes420.Wager memory wager) {
        wager=BetTypes420.Wager({wagerId:wagerId,player:PLAYER,operatorId:keccak256("operator"),gameId:GAME,gameVersionId:GAME_V1,asset:ASSET,stake:100 ether,maxGrossPayout:500 ether,paramsHash:crash.hashParams(params),vaultId:keccak256("vault"),randomnessProfileId:keccak256("randomness"),riskProfileId:keccak256("risk"),settlementProfileId:keccak256("settlement"),accessPolicyId:keccak256("access"),rulesetId:RULESET,acceptedAt:uint64(block.timestamp),deadline:uint64(block.timestamp+1 hours),status:BetTypes420.WagerStatus.ACCEPTED});
    }

    function _prepare(bytes32 wagerId, CrashV1420.Params memory params, bytes32 root) private {
        BetTypes420.Wager memory wager=_wager(wagerId,params); registry.setWager(wager);
        randomness.setRequest(RandomnessRouter420.RandomnessRequest({wagerId:wagerId,profileId:wager.randomnessProfileId,gameVersionId:GAME_V1,paramsHash:wager.paramsHash,contextHash:keccak256(abi.encode("crash/progression",wagerId)),requestedAt:uint64(block.timestamp),fallbackAt:uint64(block.timestamp+5 minutes),root:root,proofHash:keccak256("proof"),entropyHash:keccak256("entropy"),source:RandomnessRouter420.Source.PRIMARY,fulfilled:true}));
        vm.prank(PLAYER); crash.startSession(wagerId,params);
    }

    function _rootAbove(bytes32 wagerId,uint64 minimum) private view returns(bytes32 root,uint64 point){for(uint256 i=1;i<10000;++i){root=keccak256(abi.encode("root",wagerId,i));point=crash.deriveCrashPoint(wagerId,root);if(point>minimum)return(root,point);}revert("root");}
    function _rootBetween(bytes32 wagerId,uint64 minimum,uint64 maximum) private view returns(bytes32 root,uint64 point){for(uint256 i=1;i<10000;++i){root=keccak256(abi.encode("root/between",wagerId,i));point=crash.deriveCrashPoint(wagerId,root);if(point>minimum&&point<=maximum)return(root,point);}revert("root/between");}

    function testMultiplierProgressesDeterministicallyFromStart() public {
        bytes32 wagerId=keccak256("live"); (bytes32 root,)=_rootAbove(wagerId,50_000); _prepare(wagerId,CrashV1420.Params({autoCashoutBps:40_000}),root); uint256 started=block.timestamp;
        require(crash.currentMultiplierBps(wagerId)==10_000,"start"); vm.warp(started+7); require(crash.currentMultiplierBps(wagerId)==17_000,"progress");
    }

    function testDelayedExecutionStillAwardsEarlierAutoCashoutBoundary() public {
        bytes32 wagerId=keccak256("auto-first"); (bytes32 root,uint64 point)=_rootAbove(wagerId,30_000); _prepare(wagerId,CrashV1420.Params({autoCashoutBps:15_000}),root); uint256 started=block.timestamp;
        vm.warp(started+((uint256(point)-10_000)/1_000)+5); CrashV1420.TerminalReason reason=crash.advance(wagerId); CrashV1420.SessionState memory s=crash.getSession(wagerId);
        require(reason==CrashV1420.TerminalReason.AUTO_CASHOUT,"auto"); require(s.cashoutMultiplierBps==15_000,"locked");
    }

    function testExactAutoCashoutCrashTieBelongsToCrash() public {
        bytes32 wagerId=keccak256("tie"); (bytes32 root,uint64 point)=_rootBetween(wagerId,10_000,50_000);
        _prepare(wagerId,CrashV1420.Params({autoCashoutBps:point}),root); uint256 started=block.timestamp; vm.warp(started+(uint256(point)-10_000+999)/1_000); crash.advance(wagerId);
        CrashV1420.SessionState memory s=crash.getSession(wagerId); require(s.terminalReason==CrashV1420.TerminalReason.CRASHED,"tie"); require(s.cashoutMultiplierBps==0,"marker");
    }

    function testManualCashoutIsDisabledEvenBeforeCrash() public {
        bytes32 wagerId=keccak256("manual-disabled"); (bytes32 root,)=_rootAbove(wagerId,30_000); _prepare(wagerId,CrashV1420.Params({autoCashoutBps:20_000}),root);
        vm.prank(PLAYER); vm.expectRevert(CrashV1420.ManualCashoutDisabled.selector); crash.cashOut(wagerId);
    }

    function testNonPlayerCannotReachManualCashoutPath() public {
        bytes32 wagerId=keccak256("auth"); (bytes32 root,)=_rootAbove(wagerId,30_000); _prepare(wagerId,CrashV1420.Params({autoCashoutBps:20_000}),root);
        vm.prank(OTHER); vm.expectRevert(CrashV1420.NotPlayer.selector); crash.cashOut(wagerId);
    }

    function testTerminalSessionRejectsReplay() public {
        bytes32 wagerId=keccak256("replay"); (bytes32 root,)=_rootAbove(wagerId,30_000); _prepare(wagerId,CrashV1420.Params({autoCashoutBps:15_000}),root); vm.warp(block.timestamp+10); crash.advance(wagerId);
        vm.expectRevert(CrashV1420.InvalidPhase.selector); crash.advance(wagerId); vm.prank(PLAYER); vm.expectRevert(CrashV1420.InvalidPhase.selector); crash.cashOut(wagerId);
    }
}
