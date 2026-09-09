// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/CrashV1420.sol";
import "../src/bet/RandomnessRouter420.sol";

interface VmBetCrash420 { function prank(address) external; function warp(uint256) external; function expectRevert(bytes4) external; }

contract MockCrashRegistry420 {
    mapping(bytes32 => BetTypes420.Wager) private _wagers;
    function setWager(BetTypes420.Wager calldata wager_) external { _wagers[wager_.wagerId] = wager_; }
    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) { wager = _wagers[wagerId]; require(wager.wagerId != bytes32(0), "wager"); }
}

contract MockCrashRandomness420 {
    mapping(bytes32 => RandomnessRouter420.RandomnessRequest) private _requests;
    function setRequest(RandomnessRouter420.RandomnessRequest calldata request_) external { _requests[request_.wagerId] = request_; }
    function getRequest(bytes32 wagerId) external view returns (RandomnessRouter420.RandomnessRequest memory request) { request = _requests[wagerId]; require(request.wagerId != bytes32(0), "request"); }
}

contract BetCrashV1420Test {
    VmBetCrash420 constant vm = VmBetCrash420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant PLAYER = address(0xBEEF); address constant OTHER = address(0xCAFE); address constant ASSET = address(0xCA0C);
    bytes32 constant GAME = keccak256("420BET.GAME.CRASH"); bytes32 constant GAME_V1 = keccak256("420BET.GAME.CRASH.V1"); bytes32 constant RULESET = keccak256("420BET.RULESET.CRASH.V1");
    MockCrashRegistry420 private registry; MockCrashRandomness420 private randomness; CrashV1420 private crash;

    constructor() { registry = new MockCrashRegistry420(); randomness = new MockCrashRandomness420(); crash = new CrashV1420(address(registry), address(randomness), GAME, GAME_V1, RULESET); }

    function _wager(bytes32 wagerId, CrashV1420.Params memory params) private view returns (BetTypes420.Wager memory wager) {
        wager = BetTypes420.Wager({wagerId:wagerId,player:PLAYER,operatorId:keccak256("operator"),gameId:GAME,gameVersionId:GAME_V1,asset:ASSET,stake:100 ether,maxGrossPayout:500 ether,paramsHash:crash.hashParams(params),vaultId:keccak256("vault"),randomnessProfileId:keccak256("randomness"),riskProfileId:keccak256("risk"),settlementProfileId:keccak256("settlement"),accessPolicyId:keccak256("access"),rulesetId:RULESET,acceptedAt:uint64(block.timestamp),deadline:uint64(block.timestamp + 1 hours),status:BetTypes420.WagerStatus.ACCEPTED});
    }

    function _setFulfilled(BetTypes420.Wager memory wager, bytes32 root, RandomnessRouter420.Source source) private {
        randomness.setRequest(RandomnessRouter420.RandomnessRequest({wagerId:wager.wagerId,profileId:wager.randomnessProfileId,gameVersionId:wager.gameVersionId,paramsHash:wager.paramsHash,contextHash:keccak256(abi.encode("crash/context",wager.wagerId)),requestedAt:uint64(block.timestamp),fallbackAt:uint64(block.timestamp + 5 minutes),root:root,proofHash:keccak256("proof"),entropyHash:keccak256("entropy"),source:source,fulfilled:true}));
    }

    function _prepare(bytes32 wagerId, CrashV1420.Params memory params, bytes32 root) private returns (BetTypes420.Wager memory wager) { wager = _wager(wagerId, params); registry.setWager(wager); _setFulfilled(wager, root, RandomnessRouter420.Source.PRIMARY); }

    function testCanonicalBindingSurface() public view { require(keccak256(bytes(crash.systemName())) == keccak256("CrashV1420"), "name"); require(crash.protocolVersion() == 1, "version"); require(crash.gameId() == GAME && crash.gameVersionId() == GAME_V1 && crash.rulesetId() == RULESET, "binding"); }
    function testRejectsAutoCashoutAtOrBelowOneX() public { vm.expectRevert(CrashV1420.InvalidParams.selector); crash.hashParams(CrashV1420.Params({autoCashoutBps:10_000})); }
    function testRejectsAutoCashoutAboveCrashSafetyCeiling() public { vm.expectRevert(CrashV1420.InvalidParams.selector); crash.hashParams(CrashV1420.Params({autoCashoutBps:crash.MAX_CRASH_BPS()+1})); }
    function testCrashPointIsDeterministicAndRootBound() public view { bytes32 wagerId=keccak256("det"); uint64 a=crash.deriveCrashPoint(wagerId,keccak256("a")); require(a==crash.deriveCrashPoint(wagerId,keccak256("a")),"det"); require(a>=crash.BPS()&&a<=crash.MAX_CRASH_BPS(),"bounds"); }

    function testManualOnlySessionIsDisabledBecauseRandomnessIsPublic() public {
        bytes32 wagerId=keccak256("manual-disabled"); CrashV1420.Params memory params=CrashV1420.Params({autoCashoutBps:0}); _prepare(wagerId,params,keccak256("root"));
        vm.prank(PLAYER); vm.expectRevert(CrashV1420.ManualCashoutDisabled.selector); crash.startSession(wagerId,params);
    }

    function testPlayerStartsPrecommittedAutoCashoutSession() public {
        bytes32 wagerId=keccak256("auto"); CrashV1420.Params memory params=CrashV1420.Params({autoCashoutBps:25_000}); bytes32 root=keccak256("auto/root"); _prepare(wagerId,params,root);
        vm.prank(PLAYER); crash.startSession(wagerId,params); CrashV1420.SessionState memory s=crash.getSession(wagerId); require(s.exists&&s.phase==CrashV1420.Phase.ACTIVE,"phase"); require(s.autoCashoutBps==25_000&&s.randomnessRoot==root,"commitment");
    }

    function testCommittedAutoCashoutCannotExceedReservedLiability() public {
        bytes32 wagerId=keccak256("liability"); CrashV1420.Params memory params=CrashV1420.Params({autoCashoutBps:60_000}); _prepare(wagerId,params,keccak256("liability/root"));
        vm.prank(PLAYER); vm.expectRevert(CrashV1420.InvalidLiability.selector); crash.startSession(wagerId,params);
    }

    function testExpiredWagerCannotStartSession() public {
        bytes32 wagerId=keccak256("expired"); CrashV1420.Params memory params=CrashV1420.Params({autoCashoutBps:20_000}); BetTypes420.Wager memory wager=_prepare(wagerId,params,keccak256("expired/root"));
        vm.warp(uint256(wager.deadline)+1); vm.prank(PLAYER); vm.expectRevert(CrashV1420.WagerExpired.selector); crash.startSession(wagerId,params);
    }

    function testUnfulfilledRandomnessCannotStartSession() public {
        bytes32 wagerId=keccak256("unfulfilled"); CrashV1420.Params memory params=CrashV1420.Params({autoCashoutBps:20_000}); BetTypes420.Wager memory wager=_wager(wagerId,params); registry.setWager(wager);
        randomness.setRequest(RandomnessRouter420.RandomnessRequest({wagerId:wagerId,profileId:wager.randomnessProfileId,gameVersionId:GAME_V1,paramsHash:wager.paramsHash,contextHash:bytes32(0),requestedAt:uint64(block.timestamp),fallbackAt:uint64(block.timestamp+5 minutes),root:bytes32(0),proofHash:bytes32(0),entropyHash:bytes32(0),source:RandomnessRouter420.Source.NONE,fulfilled:false}));
        vm.prank(PLAYER); vm.expectRevert(CrashV1420.RandomnessNotReady.selector); crash.startSession(wagerId,params);
    }

    function testOnlyPlayerCanStartSession() public { bytes32 wagerId=keccak256("player"); CrashV1420.Params memory params=CrashV1420.Params({autoCashoutBps:20_000}); _prepare(wagerId,params,keccak256("root/player")); vm.prank(OTHER); vm.expectRevert(CrashV1420.NotPlayer.selector); crash.startSession(wagerId,params); }

    function testParamsCommitmentCannotBeChangedAtStart() public { bytes32 wagerId=keccak256("params"); CrashV1420.Params memory committed=CrashV1420.Params({autoCashoutBps:20_000}); CrashV1420.Params memory altered=CrashV1420.Params({autoCashoutBps:30_000}); _prepare(wagerId,committed,keccak256("root/params")); vm.prank(PLAYER); vm.expectRevert(CrashV1420.ParamsMismatch.selector); crash.startSession(wagerId,altered); }

    function testDuplicateSessionStartFailsClosed() public { bytes32 wagerId=keccak256("dup"); CrashV1420.Params memory params=CrashV1420.Params({autoCashoutBps:20_000}); _prepare(wagerId,params,keccak256("root/dup")); vm.prank(PLAYER); crash.startSession(wagerId,params); vm.prank(PLAYER); vm.expectRevert(CrashV1420.SessionAlreadyStarted.selector); crash.startSession(wagerId,params); }

    function testFallbackSourceIsPreservedInSession() public { bytes32 wagerId=keccak256("fallback"); CrashV1420.Params memory params=CrashV1420.Params({autoCashoutBps:20_000}); BetTypes420.Wager memory wager=_wager(wagerId,params); registry.setWager(wager); _setFulfilled(wager,keccak256("fallback/root"),RandomnessRouter420.Source.FALLBACK); vm.prank(PLAYER); crash.startSession(wagerId,params); require(crash.getSession(wagerId).randomnessSource==RandomnessRouter420.Source.FALLBACK,"fallback"); }
}
