// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetTypes420.sol";
import "../src/bet/CrashV1420.sol";

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

contract BetCrashV1420Test {
    VmBetCrash420 constant vm = VmBetCrash420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant PLAYER = address(0xBEEF);
    address constant OTHER = address(0xCAFE);
    address constant ASSET = address(0xCA0C);

    bytes32 constant GAME = keccak256("420BET.GAME.CRASH");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.CRASH.V1");
    bytes32 constant RULESET = keccak256("420BET.RULESET.CRASH.V1");

    MockCrashRegistry420 private registry;
    CrashV1420 private crash;

    constructor() {
        registry = new MockCrashRegistry420();
        crash = new CrashV1420(address(registry), GAME, GAME_V1, RULESET);
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

    function testPlayerStartsManualSession() public {
        bytes32 wagerId = keccak256("crash/manual");
        CrashV1420.Params memory params = CrashV1420.Params({autoCashoutBps: 0});
        registry.setWager(_wager(wagerId, params));

        vm.prank(PLAYER);
        crash.startSession(wagerId, params);

        CrashV1420.SessionState memory session = crash.getSession(wagerId);
        require(session.exists, "missing");
        require(session.phase == CrashV1420.Phase.ACTIVE, "phase");
        require(session.player == PLAYER, "player");
        require(session.autoCashoutBps == 0, "auto");
    }

    function testPlayerStartsAutoCashoutSession() public {
        bytes32 wagerId = keccak256("crash/auto");
        CrashV1420.Params memory params = CrashV1420.Params({autoCashoutBps: 25_000});
        registry.setWager(_wager(wagerId, params));

        vm.prank(PLAYER);
        crash.startSession(wagerId, params);
        require(crash.getSession(wagerId).autoCashoutBps == 25_000, "auto");
    }

    function testOnlyPlayerCanStartSession() public {
        bytes32 wagerId = keccak256("crash/player");
        CrashV1420.Params memory params = CrashV1420.Params({autoCashoutBps: 0});
        registry.setWager(_wager(wagerId, params));

        vm.prank(OTHER);
        vm.expectRevert(CrashV1420.NotPlayer.selector);
        crash.startSession(wagerId, params);
    }

    function testParamsCommitmentCannotBeChangedAtStart() public {
        bytes32 wagerId = keccak256("crash/params");
        CrashV1420.Params memory committed = CrashV1420.Params({autoCashoutBps: 20_000});
        CrashV1420.Params memory altered = CrashV1420.Params({autoCashoutBps: 30_000});
        registry.setWager(_wager(wagerId, committed));

        vm.prank(PLAYER);
        vm.expectRevert(CrashV1420.ParamsMismatch.selector);
        crash.startSession(wagerId, altered);
    }

    function testDuplicateSessionStartFailsClosed() public {
        bytes32 wagerId = keccak256("crash/duplicate");
        CrashV1420.Params memory params = CrashV1420.Params({autoCashoutBps: 0});
        registry.setWager(_wager(wagerId, params));

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
        vm.prank(PLAYER);
        vm.expectRevert(CrashV1420.WrongGame.selector);
        crash.startSession(wrongGameId, params);

        bytes32 wrongRulesetId = keccak256("crash/wrong-ruleset");
        BetTypes420.Wager memory wrongRuleset = _wager(wrongRulesetId, params);
        wrongRuleset.rulesetId = keccak256("other-ruleset");
        registry.setWager(wrongRuleset);
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

        vm.prank(PLAYER);
        vm.expectRevert(CrashV1420.InvalidWagerStatus.selector);
        crash.startSession(wagerId, params);
    }
}
