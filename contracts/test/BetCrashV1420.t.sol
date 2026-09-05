// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/CrashV1420.sol";
import "../src/bet/RandomnessRouter420.sol";

interface VmBetCrash420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockCrashRegistry420 {
    mapping(bytes32 => BetTypes420.Wager) private _wagers;

    function setWager(BetTypes420.Wager calldata wager_) external { _wagers[wager_.wagerId] = wager_; }

    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) {
        wager = _wagers[wagerId];
        require(wager.wagerId != bytes32(0), "wager");
    }
}

contract MockCrashRandomness420 {
    mapping(bytes32 => RandomnessRouter420.RandomnessRequest) private _requests;

    function setRequest(RandomnessRouter420.RandomnessRequest calldata request_) external {
        _requests[request_.wagerId] = request_;
    }

    function getRequest(bytes32 wagerId) external view returns (RandomnessRouter420.RandomnessRequest memory request) {
        request = _requests[wagerId];
        require(request.wagerId != bytes32(0), "request");
    }
}

contract BetCrashV1420Test {
    VmBetCrash420 constant vm = VmBetCrash420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant PLAYER = address(0xBEEF);
    address constant OTHER = address(0xCAFE);
    address constant ASSET = address(0xCA0C);

    bytes32 constant GAME = keccak256("420BET.GAME.CRASH");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.CRASH.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.CRASH.V1");

    MockCrashRegistry420 private registry;
    MockCrashRandomness420 private randomness;
    CrashV1420 private crash;

    constructor() {
        registry = new MockCrashRegistry420();
        randomness = new MockCrashRandomness420();
        crash = new CrashV1420(address(registry), address(randomness), GAME, GAME_V1, RULESET);
    }

    function _wager(bytes32 wagerId, CrashV1420.Params memory params) private view returns (BetTypes420.Wager memory wager) {
        wager = BetTypes420.Wager({
            wagerId: wagerId,
            player: PLAYER,
            operatorId: keccak256("operator"),
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: ASSET,
            stake: 100 ether,
            maxGrossPayout: 500 ether,
            paramsHash: crash.hashParams(params),
            vaultId: keccak256("vault"),
            randomnessProfileId: keccak256("randomness"),
            riskProfileId: keccak256("risk"),
            settlementProfileId: keccak256("settlement"),
            accessPolicyId: keccak256("access"),
            rulesetId: RULESET,
            acceptedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 1 hours),
            status: BetTypes420.WagerStatus.ACCEPTED
        });
    }

    function _setFulfilled(BetTypes420.Wager memory wager, bytes32 root, RandomnessRouter420.Source source) private {
        randomness.setRequest(RandomnessRouter420.RandomnessRequest({
            wagerId: wager.wagerId,
            profileId: wager.randomnessProfileId,
            gameVersionId: wager.gameVersionId,
            paramsHash: wager.paramsHash,
            contextHash: keccak256(abi.encode("crash/context", wager.wagerId)),
            requestedAt: uint64(block.timestamp),
            fallbackAt: uint64(block.timestamp + 5 minutes),
            root: root,
            proofHash: keccak256("proof"),
            entropyHash: keccak256("entropy"),
            source: source,
            fulfilled: true
        }));
    }

    function _prepare(bytes32 wagerId, CrashV1420.Params memory params, bytes32 root) private returns (BetTypes420.Wager memory wager) {
        wager = _wager(wagerId, params);
        registry.setWager(wager);
        _setFulfilled(wager, root, RandomnessRouter420.Source.PRIMARY);
    }

    function testCanonicalBindingSurface() public view {
        require(keccak256(bytes(crash.systemName())) == keccak256("CrashV1420"), "name");
        require(crash.protocolVersion() == 1, "version");
        require(crash.gameId() == GAME, "game");
        require(crash.gameVersionId() == GAME_V1, "game version");
        require(crash.rulesetId() == RULESET, "ruleset");
    }

    function testManualAndAutoCashoutParamsAreDomainBound() public view {
        CrashV1420.Params memory manualOnly = CrashV1420.Params({autoCashoutBps: 0});
        CrashV1420.Params memory twoX = CrashV1420.Params({autoCashoutBps: 20_000});
        require(crash.hashParams(manualOnly) != crash.hashParams(twoX), "params collision");
    }

    function testRejectsAutoCashoutAtOrBelowOneX() public {
        vm.expectRevert(CrashV1420.InvalidParams.selector);
        crash.hashParams(CrashV1420.Params({autoCashoutBps: 10_000}));
    }

    function testRejectsAutoCashoutAboveCrashSafetyCeiling() public {
        vm.expectRevert(CrashV1420.InvalidParams.selector);
        crash.hashParams(CrashV1420.Params({autoCashoutBps: crash.MAX_CRASH_BPS() + 1}));
    }

    function testCrashPointIsDeterministicAndRootBound() public view {
        bytes32 wagerId = keccak256("crash/deterministic");
        bytes32 rootA = keccak256("root/a");
        bytes32 rootB = keccak256("root/b");
        uint64 a1 = crash.deriveCrashPoint(wagerId, rootA);
        uint64 a2 = crash.deriveCrashPoint(wagerId, rootA);
        uint64 b = crash.deriveCrashPoint(wagerId, rootB);
        require(a1 == a2, "not deterministic");
        require(a1 >= crash.BPS() && a1 <= crash.MAX_CRASH_BPS(), "a bounds");
        require(b >= crash.BPS() && b <= crash.MAX_CRASH_BPS(), "b bounds");
        require(a1 != b, "root collision");
    }

    function testPlayerStartsManualSessionWithCanonicalCrashPoint() public {
        bytes32 wagerId = keccak256("crash/manual");
        bytes32 root = keccak256("crash/manual/root");
        CrashV1420.Params memory params = CrashV1420.Params({autoCashoutBps: 0});
        _prepare(wagerId, params, root);

        uint64 expected = crash.deriveCrashPoint(wagerId, root);
        vm.prank(PLAYER);
        crash.startSession(wagerId, params);

        CrashV1420.SessionState memory session = crash.getSession(wagerId);
        require(session.exists, "missing");
        require(session.phase == CrashV1420.Phase.ACTIVE, "phase");
        require(session.player == PLAYER, "player");
        require(session.autoCashoutBps == 0, "auto");
        require(session.crashPointBps == expected, "crash point");
        require(session.randomnessRoot == root, "root");
        require(session.randomnessSource == RandomnessRouter420.Source.PRIMARY, "source");
    }

    function testPlayerStartsAutoCashoutSession() public {
        bytes32 wagerId = keccak256("crash/auto");
        CrashV1420.Params memory params = CrashV1420.Params({autoCashoutBps: 25_000});
        _prepare(wagerId, params, keccak256("crash/auto/root"));

        vm.prank(PLAYER);
        crash.startSession(wagerId, params);
        require(crash.getSession(wagerId).autoCashoutBps == 25_000, "auto");
    }

    function testUnfulfilledRandomnessCannotStartSession() public {
        bytes32 wagerId = keccak256("crash/unfulfilled");
        CrashV1420.Params memory params = CrashV1420.Params({autoCashoutBps: 0});
        BetTypes420.Wager memory wager = _wager(wagerId, params);
        registry.setWager(wager);
        randomness.setRequest(RandomnessRouter420.RandomnessRequest({
            wagerId: wagerId,
            profileId: wager.randomnessProfileId,
            gameVersionId: GAME_V1,
            paramsHash: wager.paramsHash,
            contextHash: bytes32(0),
            requestedAt: uint64(block.timestamp),
            fallbackAt: uint64(block.timestamp + 5 minutes),
            root: bytes32(0),
            proofHash: bytes32(0),
            entropyHash: bytes32(0),
            source: RandomnessRouter420.Source.NONE,
            fulfilled: false
        }));

        vm.prank(PLAYER);
        vm.expectRevert(CrashV1420.RandomnessNotReady.selector);
        crash.startSession(wagerId, params);
    }

    function testRandomnessVersionAndParamsSubstitutionFailClosed() public {
        CrashV1420.Params memory params = CrashV1420.Params({autoCashoutBps: 20_000});

        bytes32 wrongVersionId = keccak256("crash/randomness-version");
        BetTypes420.Wager memory wrongVersion = _wager(wrongVersionId, params);
        registry.setWager(wrongVersion);
        _setFulfilled(wrongVersion, keccak256("root/version"), RandomnessRouter420.Source.PRIMARY);
        RandomnessRouter420.RandomnessRequest memory request = randomness.getRequest(wrongVersionId);
        request.gameVersionId = keccak256("other-version");
        randomness.setRequest(request);
        vm.prank(PLAYER);
        vm.expectRevert(CrashV1420.RandomnessMismatch.selector);
        crash.startSession(wrongVersionId, params);

        bytes32 wrongParamsId = keccak256("crash/randomness-params");
        BetTypes420.Wager memory wrongParams = _wager(wrongParamsId, params);
        registry.setWager(wrongParams);
        _setFulfilled(wrongParams, keccak256("root/params"), RandomnessRouter420.Source.PRIMARY);
        request = randomness.getRequest(wrongParamsId);
        request.paramsHash = keccak256("altered-params");
        randomness.setRequest(request);
        vm.prank(PLAYER);
        vm.expectRevert(CrashV1420.RandomnessMismatch.selector);
        crash.startSession(wrongParamsId, params);
    }

    function testFallbackSourceIsPreservedInSession() public {
        bytes32 wagerId = keccak256("crash/fallback");
        CrashV1420.Params memory params = CrashV1420.Params({autoCashoutBps: 0});
        BetTypes420.Wager memory wager = _wager(wagerId, params);
        registry.setWager(wager);
        _setFulfilled(wager, keccak256("fallback/root"), RandomnessRouter420.Source.FALLBACK);

        vm.prank(PLAYER);
        crash.startSession(wagerId, params);
        require(crash.getSession(wagerId).randomnessSource == RandomnessRouter420.Source.FALLBACK, "fallback");
    }

    function testOnlyPlayerCanStartSession() public {
        bytes32 wagerId = keccak256("crash/player");
        CrashV1420.Params memory params = CrashV1420.Params({autoCashoutBps: 0});
        _prepare(wagerId, params, keccak256("crash/player/root"));

        vm.prank(OTHER);
        vm.expectRevert(CrashV1420.NotPlayer.selector);
        crash.startSession(wagerId, params);
    }

    function testParamsCommitmentCannotBeChangedAtStart() public {
        bytes32 wagerId = keccak256("crash/params");
        CrashV1420.Params memory committed = CrashV1420.Params({autoCashoutBps: 20_000});
        CrashV1420.Params memory altered = CrashV1420.Params({autoCashoutBps: 30_000});
        _prepare(wagerId, committed, keccak256("crash/params/root"));

        vm.prank(PLAYER);
        vm.expectRevert(CrashV1420.ParamsMismatch.selector);
        crash.startSession(wagerId, altered);
    }

    function testDuplicateSessionStartFailsClosed() public {
        bytes32 wagerId = keccak256("crash/duplicate");
        CrashV1420.Params memory params = CrashV1420.Params({autoCashoutBps: 0});
        _prepare(wagerId, params, keccak256("crash/duplicate/root"));

        vm.prank(PLAYER);
        crash.startSession(wagerId, params);

        vm.prank(PLAYER);
        vm.expectRevert(CrashV1420.SessionAlreadyStarted.selector);
        crash.startSession(wagerId, params);
    }

    function testWrongGameAndRulesetFailClosed() public {
        CrashV1420.Params memory params = CrashV1420.Params({autoCashoutBps: 0});

        bytes32 wrongGameId = keccak256("crash/wrong-game");
        BetTypes420.Wager memory wrongGame = _wager(wrongGameId, params);
        wrongGame.gameVersionId = keccak256("other-version");
        registry.setWager(wrongGame);
        _setFulfilled(wrongGame, keccak256("wrong-game/root"), RandomnessRouter420.Source.PRIMARY);
        vm.prank(PLAYER);
        vm.expectRevert(CrashV1420.WrongGame.selector);
        crash.startSession(wrongGameId, params);

        bytes32 wrongRulesetId = keccak256("crash/wrong-ruleset");
        BetTypes420.Wager memory wrongRuleset = _wager(wrongRulesetId, params);
        wrongRuleset.rulesetId = keccak256("other-ruleset");
        registry.setWager(wrongRuleset);
        _setFulfilled(wrongRuleset, keccak256("wrong-ruleset/root"), RandomnessRouter420.Source.PRIMARY);
        vm.prank(PLAYER);
        vm.expectRevert(CrashV1420.WrongRuleset.selector);
        crash.startSession(wrongRulesetId, params);
    }

    function testTerminalWagerStatusCannotStartSession() public {
        bytes32 wagerId = keccak256("crash/status");
        CrashV1420.Params memory params = CrashV1420.Params({autoCashoutBps: 0});
        BetTypes420.Wager memory wager = _wager(wagerId, params);
        wager.status = BetTypes420.WagerStatus.SETTLED;
        registry.setWager(wager);
        _setFulfilled(wager, keccak256("crash/status/root"), RandomnessRouter420.Source.PRIMARY);

        vm.prank(PLAYER);
        vm.expectRevert(CrashV1420.InvalidWagerStatus.selector);
        crash.startSession(wagerId, params);
    }
}
