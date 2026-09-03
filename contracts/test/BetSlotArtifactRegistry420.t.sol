// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetGameRegistry420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/BetModuleRegistry420.sol";
import "../src/bet/BetProfileRegistry420.sol";
import "../src/bet/BetSlotArtifactRegistry420.sol";
import "../src/bet/BetTypes420.sol";

interface VmBetSlotArtifactRegistry420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockCapabilityRegistryBetSlotArtifactRegistry420 is ICapabilityRegistry420 {
    mapping(bytes32 => CapabilityGrant) private _grants;
    mapping(bytes32 => bool) private _allowed;

    function setAllowed(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, bool value) external {
        _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))] = value;
    }

    function grant(bytes32 grantId) external view returns (CapabilityGrant memory) { return _grants[grantId]; }

    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256)
        external view returns (bool)
    {
        return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))];
    }
}

contract BetSlotArtifactRegistry420Test {
    VmBetSlotArtifactRegistry420 constant vm = VmBetSlotArtifactRegistry420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ADMIN = address(0xA11CE);
    bytes32 constant MODULE = keccak256("420BET.MODULE.SLOT");
    bytes32 constant MODULE_V1 = keccak256("420BET.MODULE.SLOT.V1");
    bytes32 constant GAME = keccak256("420BET.GAME.SLOT");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.SLOT.V1");
    bytes32 constant SPORTS_GAME = keccak256("420BET.GAME.SPORTS");
    bytes32 constant SPORTS_GAME_V1 = keccak256("420BET.GAME.SPORTS.V1");
    bytes32 constant RANDOMNESS = keccak256("profile/randomness");
    bytes32 constant RISK = keccak256("profile/risk");
    bytes32 constant SETTLEMENT = keccak256("profile/settlement");
    bytes32 constant ACCESS = keccak256("profile/access");

    struct Suite {
        MockCapabilityRegistryBetSlotArtifactRegistry420 caps;
        BetAuthorization420 auth;
        BetModuleRegistry420 modules;
        BetProfileRegistry420 profiles;
        BetGameRegistry420 games;
        BetSlotArtifactRegistry420 artifacts;
    }

    function _allow(Suite memory s, address principal, bytes32 action, bytes32 scope) private {
        s.caps.setAllowed(principal, BetIds420.COMPONENT_BET, action, scope, true);
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryBetSlotArtifactRegistry420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.modules = new BetModuleRegistry420(address(s.auth));
        s.profiles = new BetProfileRegistry420(address(s.auth));
        s.games = new BetGameRegistry420(address(s.auth), address(s.modules), address(s.profiles));
        s.artifacts = new BetSlotArtifactRegistry420(address(s.auth), address(s.games));

        bytes32 moduleScope = s.auth.scopeForModule(MODULE, MODULE_V1);
        _allow(s, ADMIN, BetIds420.ACTION_MODULE_REGISTER, moduleScope);
        _allow(s, ADMIN, BetIds420.ACTION_MODULE_APPROVE, moduleScope);
        vm.prank(ADMIN);
        s.modules.registerModule(MODULE, MODULE_V1, address(0x1234), keccak256("module-manifest"), keccak256("module-code"));
        vm.prank(ADMIN);
        s.modules.approve(MODULE_V1);

        _registerProfile(s, RANDOMNESS, keccak256("RANDOMNESS"));
        _registerProfile(s, RISK, keccak256("RISK"));
        _registerProfile(s, SETTLEMENT, keccak256("SETTLEMENT"));
        _registerProfile(s, ACCESS, keccak256("ACCESS"));

        _registerGame(s, GAME, GAME_V1, BetTypes420.ProductClass.CASINO);
        _registerGame(s, SPORTS_GAME, SPORTS_GAME_V1, BetTypes420.ProductClass.SPORTSBOOK);
    }

    function _registerProfile(Suite memory s, bytes32 id, bytes32 profileType) private {
        _allow(s, ADMIN, BetIds420.ACTION_PROFILE_REGISTER, s.auth.scopeForProfile(id));
        vm.prank(ADMIN);
        s.profiles.registerProfile(id, profileType, keccak256(abi.encode("manifest", id)), keccak256(abi.encode("artifact", id)));
    }

    function _registerGame(Suite memory s, bytes32 gameId, bytes32 gameVersionId, BetTypes420.ProductClass productClass) private {
        bytes32 scope = s.auth.scopeForGame(gameId, gameVersionId);
        _allow(s, ADMIN, BetIds420.ACTION_GAME_REGISTER, scope);
        BetGameRegistry420.GameVersion memory game = BetGameRegistry420.GameVersion({
            gameId: gameId,
            gameVersionId: gameVersionId,
            moduleVersionId: MODULE_V1,
            rulesetId: keccak256(abi.encode("ruleset", gameVersionId)),
            randomnessProfileId: RANDOMNESS,
            riskProfileId: RISK,
            settlementProfileId: SETTLEMENT,
            accessPolicyId: ACCESS,
            manifestHash: keccak256(abi.encode("game-manifest", gameVersionId)),
            productClass: productClass,
            gameMode: BetTypes420.GameMode.INSTANT,
            registeredAt: 0,
            status: BetGameRegistry420.GameStatus.NONE,
            exists: false
        });
        vm.prank(ADMIN);
        s.games.registerGame(game);
    }

    function _registerArtifacts(Suite memory s, bytes32 gameVersionId) private {
        vm.prank(ADMIN);
        s.artifacts.registerSlotArtifacts(
            gameVersionId,
            keccak256("reels"),
            keccak256("paytable"),
            keccak256("rtp"),
            keccak256("liability"),
            5_000
        );
    }

    function testRegistersAppendOnlyArtifactsBoundToCanonicalModule() public {
        Suite memory s = _deploy();
        _allow(s, ADMIN, BetIds420.ACTION_SLOT_ARTIFACT_REGISTER, s.auth.scopeForGame(GAME, GAME_V1));
        _registerArtifacts(s, GAME_V1);

        BetSlotArtifactRegistry420.SlotArtifacts memory a = s.artifacts.getSlotArtifacts(GAME_V1);
        require(a.gameVersionId == GAME_V1, "game version mismatch");
        require(a.moduleVersionId == MODULE_V1, "module binding mismatch");
        require(a.reelSetHash == keccak256("reels"), "reels mismatch");
        require(a.paytableHash == keccak256("paytable"), "paytable mismatch");
        require(a.rtpArtifactHash == keccak256("rtp"), "rtp mismatch");
        require(a.liabilityArtifactHash == keccak256("liability"), "liability mismatch");
        require(a.maxMultiplier == 5_000, "multiplier mismatch");
        require(a.exists, "missing record");
    }

    function testDefaultDenyWithoutScopedCapability() public {
        Suite memory s = _deploy();
        vm.expectRevert(BetSlotArtifactRegistry420.Unauthorized.selector);
        _registerArtifacts(s, GAME_V1);
    }

    function testDuplicateRegistrationFailsClosed() public {
        Suite memory s = _deploy();
        _allow(s, ADMIN, BetIds420.ACTION_SLOT_ARTIFACT_REGISTER, s.auth.scopeForGame(GAME, GAME_V1));
        _registerArtifacts(s, GAME_V1);
        vm.expectRevert(BetSlotArtifactRegistry420.AlreadyExists.selector);
        _registerArtifacts(s, GAME_V1);
    }

    function testRejectsNonCasinoGame() public {
        Suite memory s = _deploy();
        _allow(s, ADMIN, BetIds420.ACTION_SLOT_ARTIFACT_REGISTER, s.auth.scopeForGame(SPORTS_GAME, SPORTS_GAME_V1));
        vm.expectRevert(BetSlotArtifactRegistry420.NotCasinoGame.selector);
        _registerArtifacts(s, SPORTS_GAME_V1);
    }

    function testRejectsZeroArtifactCommitment() public {
        Suite memory s = _deploy();
        _allow(s, ADMIN, BetIds420.ACTION_SLOT_ARTIFACT_REGISTER, s.auth.scopeForGame(GAME, GAME_V1));
        vm.prank(ADMIN);
        vm.expectRevert(BetSlotArtifactRegistry420.InvalidCommitment.selector);
        s.artifacts.registerSlotArtifacts(
            GAME_V1,
            bytes32(0),
            keccak256("paytable"),
            keccak256("rtp"),
            keccak256("liability"),
            5_000
        );
    }
}
