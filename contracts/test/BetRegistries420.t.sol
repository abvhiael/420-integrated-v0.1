// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/BetTypes420.sol";
import "../src/bet/BetModuleRegistry420.sol";
import "../src/bet/BetProfileRegistry420.sol";
import "../src/bet/BetOperatorRegistry420.sol";
import "../src/bet/BetGameRegistry420.sol";

interface VmBetRegistries420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockCapabilityRegistryBetRegistries420 is ICapabilityRegistry420 {
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

contract DummyBetModule420 {}

contract BetRegistries420Test {
    VmBetRegistries420 constant vm = VmBetRegistries420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ADMIN = address(0xA11CE);
    address constant OPERATOR_ACCOUNT = address(0xB0B);

    bytes32 constant MODULE = keccak256("420BET.MODULE.DICE");
    bytes32 constant MODULE_V1 = keccak256("420BET.MODULE.DICE.V1");
    bytes32 constant MODULE_V2 = keccak256("420BET.MODULE.DICE.V2");
    bytes32 constant GAME = keccak256("420BET.GAME.DICE");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.DICE.V1");
    bytes32 constant GAME_V2 = keccak256("420BET.GAME.DICE.V2");
    bytes32 constant OPERATOR = keccak256("420BET.OPERATOR.FIRSTPARTY");

    bytes32 constant RNG = keccak256("profile/rng/v1");
    bytes32 constant RISK = keccak256("profile/risk/v1");
    bytes32 constant SETTLEMENT = keccak256("profile/settlement/v1");
    bytes32 constant ACCESS = keccak256("profile/access/v1");

    struct Suite {
        MockCapabilityRegistryBetRegistries420 caps;
        BetAuthorization420 auth;
        BetModuleRegistry420 modules;
        BetProfileRegistry420 profiles;
        BetOperatorRegistry420 operators;
        BetGameRegistry420 games;
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryBetRegistries420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.modules = new BetModuleRegistry420(address(s.auth));
        s.profiles = new BetProfileRegistry420(address(s.auth));
        s.operators = new BetOperatorRegistry420(address(s.auth));
        s.games = new BetGameRegistry420(address(s.auth), address(s.modules), address(s.profiles));
    }

    function _allow(Suite memory s, bytes32 action, bytes32 scope) private {
        s.caps.setAllowed(ADMIN, BetIds420.COMPONENT_BET, action, scope, true);
    }

    function _registerModule(Suite memory s, bytes32 version) private returns (address implementation) {
        implementation = address(new DummyBetModule420());
        _allow(s, BetIds420.ACTION_MODULE_REGISTER, s.auth.scopeForModule(MODULE, version));
        vm.prank(ADMIN);
        s.modules.registerModule(MODULE, version, implementation, keccak256("manifest"), keccak256("code"));
    }

    function _approveModule(Suite memory s, bytes32 version) private {
        _allow(s, BetIds420.ACTION_MODULE_APPROVE, s.auth.scopeForModule(MODULE, version));
        vm.prank(ADMIN);
        s.modules.approve(version);
    }

    function _registerProfile(Suite memory s, bytes32 profileId, bytes32 profileType) private {
        _allow(s, BetIds420.ACTION_PROFILE_REGISTER, s.auth.scopeForProfile(profileId));
        vm.prank(ADMIN);
        s.profiles.registerProfile(profileId, profileType, keccak256("profile-manifest"), keccak256("artifact"));
    }

    function _seedProfiles(Suite memory s) private {
        _registerProfile(s, RNG, keccak256("RANDOMNESS"));
        _registerProfile(s, RISK, keccak256("RISK"));
        _registerProfile(s, SETTLEMENT, keccak256("SETTLEMENT"));
        _registerProfile(s, ACCESS, keccak256("ACCESS"));
    }

    function _gameInput(bytes32 version) private pure returns (BetGameRegistry420.GameVersion memory v) {
        v.gameId = GAME;
        v.gameVersionId = version;
        v.moduleVersionId = MODULE_V1;
        v.rulesetId = keccak256("rules-v1");
        v.randomnessProfileId = RNG;
        v.riskProfileId = RISK;
        v.settlementProfileId = SETTLEMENT;
        v.accessPolicyId = ACCESS;
        v.manifestHash = keccak256("game-manifest");
        v.productClass = BetTypes420.ProductClass.CASINO;
        v.gameMode = BetTypes420.GameMode.INSTANT;
    }

    function testModuleRegistrationDefaultDeny() public {
        Suite memory s = _deploy();
        address implementation = address(new DummyBetModule420());
        vm.prank(ADMIN);
        vm.expectRevert(BetModuleRegistry420.Unauthorized.selector);
        s.modules.registerModule(MODULE, MODULE_V1, implementation, bytes32(0), bytes32(0));
    }

    function testModuleApprovalDoesNotSkipRegistrationOrActivateGame() public {
        Suite memory s = _deploy();
        _registerModule(s, MODULE_V1);
        require(!s.modules.isApproved(MODULE_V1), "registered module already approved");
        _approveModule(s, MODULE_V1);
        require(s.modules.isApproved(MODULE_V1), "module not approved");
    }

    function testModuleVersionIsolationAndNonRebinding() public {
        Suite memory s = _deploy();
        address impl = _registerModule(s, MODULE_V1);
        _allow(s, BetIds420.ACTION_MODULE_REGISTER, s.auth.scopeForModule(MODULE, MODULE_V2));
        address implV2 = address(new DummyBetModule420());
        vm.prank(ADMIN);
        s.modules.registerModule(MODULE, MODULE_V2, implV2, bytes32(0), bytes32(0));

        address replacement = address(new DummyBetModule420());
        vm.prank(ADMIN);
        vm.expectRevert(BetModuleRegistry420.AlreadyExists.selector);
        s.modules.registerModule(MODULE, MODULE_V1, replacement, bytes32(0), bytes32(0));
        require(s.modules.getModule(MODULE_V1).implementation == impl, "module rebound");
    }

    function testProfileDeprecationIsTerminal() public {
        Suite memory s = _deploy();
        _registerProfile(s, RNG, keccak256("RANDOMNESS"));
        _allow(s, BetIds420.ACTION_PROFILE_DEPRECATE, s.auth.scopeForProfile(RNG));
        vm.prank(ADMIN);
        s.profiles.deprecate(RNG);
        require(!s.profiles.isActive(RNG), "profile active");
        vm.prank(ADMIN);
        vm.expectRevert(BetProfileRegistry420.AlreadyDeprecated.selector);
        s.profiles.deprecate(RNG);
    }

    function testOperatorLifecycleAndRevocationTerminal() public {
        Suite memory s = _deploy();
        bytes32 scope = s.auth.scopeForOperator(OPERATOR);
        _allow(s, BetIds420.ACTION_OPERATOR_REGISTER, scope);
        _allow(s, BetIds420.ACTION_OPERATOR_ACTIVATE, scope);
        _allow(s, BetIds420.ACTION_OPERATOR_PAUSE, scope);
        _allow(s, BetIds420.ACTION_OPERATOR_RESUME, scope);
        _allow(s, BetIds420.ACTION_OPERATOR_REVOKE, scope);

        vm.prank(ADMIN); s.operators.registerOperator(OPERATOR, OPERATOR_ACCOUNT, keccak256("operator"));
        require(!s.operators.isActive(OPERATOR), "registration activated operator");
        vm.prank(ADMIN); s.operators.activate(OPERATOR);
        require(s.operators.isActive(OPERATOR), "activation failed");
        vm.prank(ADMIN); s.operators.pause(OPERATOR);
        require(!s.operators.isActive(OPERATOR), "pause failed");
        vm.prank(ADMIN); s.operators.resume(OPERATOR);
        vm.prank(ADMIN); s.operators.revoke(OPERATOR);
        vm.prank(ADMIN);
        vm.expectRevert(BetOperatorRegistry420.InvalidTransition.selector);
        s.operators.resume(OPERATOR);
    }

    function testGameRequiresApprovedModuleAndActiveProfiles() public {
        Suite memory s = _deploy();
        _registerModule(s, MODULE_V1);
        _seedProfiles(s);
        _allow(s, BetIds420.ACTION_GAME_REGISTER, s.auth.scopeForGame(GAME, GAME_V1));
        BetGameRegistry420.GameVersion memory input = _gameInput(GAME_V1);
        vm.prank(ADMIN);
        vm.expectRevert(BetGameRegistry420.InvalidConfiguration.selector);
        s.games.registerGame(input);

        _approveModule(s, MODULE_V1);
        vm.prank(ADMIN);
        s.games.registerGame(input);
        require(!s.games.isActive(GAME_V1), "registration activated game");
    }

    function testGameActivationPauseResumeAndVersionIsolation() public {
        Suite memory s = _deploy();
        _registerModule(s, MODULE_V1);
        _approveModule(s, MODULE_V1);
        _seedProfiles(s);

        bytes32 scopeV1 = s.auth.scopeForGame(GAME, GAME_V1);
        _allow(s, BetIds420.ACTION_GAME_REGISTER, scopeV1);
        _allow(s, BetIds420.ACTION_GAME_ACTIVATE, scopeV1);
        _allow(s, BetIds420.ACTION_GAME_PAUSE, scopeV1);
        _allow(s, BetIds420.ACTION_GAME_RESUME, scopeV1);

        vm.prank(ADMIN); s.games.registerGame(_gameInput(GAME_V1));
        vm.prank(ADMIN); s.games.activate(GAME_V1);
        require(s.games.isActive(GAME_V1), "not active");
        vm.prank(ADMIN); s.games.pause(GAME_V1);
        require(!s.games.isActive(GAME_V1), "not paused");
        vm.prank(ADMIN); s.games.resume(GAME_V1);

        vm.prank(ADMIN);
        vm.expectRevert(BetGameRegistry420.Unauthorized.selector);
        s.games.registerGame(_gameInput(GAME_V2));
    }

    function testDeprecatedModuleCannotResume() public {
        Suite memory s = _deploy();
        _registerModule(s, MODULE_V1);
        _approveModule(s, MODULE_V1);
        bytes32 scope = s.auth.scopeForModule(MODULE, MODULE_V1);
        _allow(s, BetIds420.ACTION_MODULE_DEPRECATE, scope);
        _allow(s, BetIds420.ACTION_MODULE_RESUME, scope);
        vm.prank(ADMIN); s.modules.deprecate(MODULE_V1);
        vm.prank(ADMIN);
        vm.expectRevert(BetModuleRegistry420.InvalidTransition.selector);
        s.modules.resume(MODULE_V1);
    }
}
