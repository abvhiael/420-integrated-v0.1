// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BetAccessPolicy420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/BetProfileRegistry420.sol";

interface VmBetAccessPolicy420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function warp(uint256) external;
}

contract MockCapabilityRegistryBetAccess420 is ICapabilityRegistry420 {
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

contract MockCredentialVerifierBetAccess420 is IBetCredentialVerifier420 {
    mapping(bytes32 => bool) private _valid;
    bool public shouldRevert;

    function setCredential(address subject, bytes32 credentialId, bool valid) external {
        _valid[keccak256(abi.encode(subject, credentialId))] = valid;
    }

    function setShouldRevert(bool value) external { shouldRevert = value; }

    function isCredentialValid(address subject, bytes32 credentialId) external view returns (bool) {
        if (shouldRevert) revert("verifier unavailable");
        return _valid[keccak256(abi.encode(subject, credentialId))];
    }
}

contract BetAccessPolicy420Test {
    VmBetAccessPolicy420 constant vm = VmBetAccessPolicy420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ADMIN = address(0xA11CE);
    address constant ROUTER = address(0xBEEF);
    address constant PLAYER = address(0xC0FFEE);
    address constant ASSET = address(0xCA0C);

    bytes32 constant ACCESS = keccak256("profile/access/v1");
    bytes32 constant ACCESS_2 = keccak256("profile/access/v2");
    bytes32 constant AGE = keccak256("credential/age/19-plus");
    bytes32 constant JURISDICTION = keccak256("credential/jurisdiction/allowed");

    struct Suite {
        MockCapabilityRegistryBetAccess420 caps;
        BetAuthorization420 auth;
        BetProfileRegistry420 profiles;
        BetAccessPolicy420 access;
        MockCredentialVerifierBetAccess420 verifier;
    }

    function _allow(Suite memory s, address principal, bytes32 action, bytes32 scope) private {
        s.caps.setAllowed(principal, BetIds420.COMPONENT_BET, action, scope, true);
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryBetAccess420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.profiles = new BetProfileRegistry420(address(s.auth));
        s.access = new BetAccessPolicy420(address(s.auth), address(s.profiles));
        s.verifier = new MockCredentialVerifierBetAccess420();
        _register(s, ACCESS);
        _register(s, ACCESS_2);
    }

    function _register(Suite memory s, bytes32 profileId) private {
        _allow(s, ADMIN, BetIds420.ACTION_PROFILE_REGISTER, s.auth.scopeForProfile(profileId));
        vm.prank(ADMIN);
        s.profiles.registerProfile(profileId, keccak256("ACCESS"), keccak256(abi.encode("manifest", profileId)), keccak256(abi.encode("artifact", profileId)));
    }

    function _configure(
        Suite memory s,
        bytes32 profileId,
        bytes32[] memory requirements,
        uint256 perWager,
        uint256 perPeriod,
        uint64 periodSeconds
    ) private {
        _allow(s, ADMIN, BetIds420.ACTION_ACCESS_CONFIGURE, s.auth.scopeForProfile(profileId));
        vm.prank(ADMIN);
        s.access.configurePolicy(
            profileId,
            ASSET,
            requirements.length == 0 ? address(0) : address(s.verifier),
            requirements,
            perWager,
            perPeriod,
            periodSeconds,
            keccak256(abi.encode("access-policy", profileId))
        );
    }

    function _allowRouter(Suite memory s, bytes32 profileId) private {
        _allow(s, ROUTER, BetIds420.ACTION_ACCESS_RECORD, s.auth.scopeForProfile(profileId));
    }

    function testConfigureIsDefaultDenyAndProfileScoped() public {
        Suite memory s = _deploy();
        bytes32[] memory none = new bytes32[](0);

        vm.prank(ADMIN);
        vm.expectRevert(BetAccessPolicy420.Unauthorized.selector);
        s.access.configurePolicy(ACCESS, ASSET, address(0), none, 0, 0, 0, keccak256("policy"));

        _allow(s, ADMIN, BetIds420.ACTION_ACCESS_CONFIGURE, s.auth.scopeForProfile(ACCESS_2));
        vm.prank(ADMIN);
        vm.expectRevert(BetAccessPolicy420.Unauthorized.selector);
        s.access.configurePolicy(ACCESS, ASSET, address(0), none, 0, 0, 0, keccak256("policy"));
    }

    function testCredentialRequirementsFailClosed() public {
        Suite memory s = _deploy();
        bytes32[] memory requirements = new bytes32[](2);
        requirements[0] = AGE;
        requirements[1] = JURISDICTION;
        _configure(s, ACCESS, requirements, 0, 0, 0);
        _allowRouter(s, ACCESS);
        s.verifier.setCredential(PLAYER, AGE, true);

        vm.prank(ROUTER);
        vm.expectRevert(BetAccessPolicy420.MissingCredential.selector);
        s.access.validateAndRecord(ACCESS, PLAYER, ASSET, 10 ether);

        s.verifier.setCredential(PLAYER, JURISDICTION, true);
        s.verifier.setShouldRevert(true);
        vm.prank(ROUTER);
        vm.expectRevert(BetAccessPolicy420.MissingCredential.selector);
        s.access.validateAndRecord(ACCESS, PLAYER, ASSET, 10 ether);

        s.verifier.setShouldRevert(false);
        vm.prank(ROUTER);
        s.access.validateAndRecord(ACCESS, PLAYER, ASSET, 10 ether);
    }

    function testSelfExclusionAndCoolOffCanOnlyExtend() public {
        Suite memory s = _deploy();
        bytes32[] memory none = new bytes32[](0);
        _configure(s, ACCESS, none, 0, 0, 0);
        _allowRouter(s, ACCESS);

        uint64 excludedUntil = uint64(block.timestamp + 7 days);
        vm.prank(PLAYER);
        s.access.selfExclude(excludedUntil);
        vm.prank(PLAYER);
        vm.expectRevert(BetAccessPolicy420.CannotShortenProtection.selector);
        s.access.selfExclude(uint64(block.timestamp + 1 days));
        vm.prank(ROUTER);
        vm.expectRevert(BetAccessPolicy420.SelfExcluded.selector);
        s.access.validateAndRecord(ACCESS, PLAYER, ASSET, 1 ether);

        vm.warp(excludedUntil);
        uint64 coolUntil = uint64(block.timestamp + 1 days);
        vm.prank(PLAYER);
        s.access.coolOff(coolUntil);
        vm.prank(ROUTER);
        vm.expectRevert(BetAccessPolicy420.CoolingOff.selector);
        s.access.validateAndRecord(ACCESS, PLAYER, ASSET, 1 ether);

        vm.warp(coolUntil);
        vm.prank(ROUTER);
        s.access.validateAndRecord(ACCESS, PLAYER, ASSET, 1 ether);
    }

    function testPolicyPerWagerAndPeriodLimits() public {
        Suite memory s = _deploy();
        bytes32[] memory none = new bytes32[](0);
        _configure(s, ACCESS, none, 40 ether, 100 ether, 1 days);
        _allowRouter(s, ACCESS);

        vm.prank(ROUTER);
        vm.expectRevert(BetAccessPolicy420.StakeLimitExceeded.selector);
        s.access.validateAndRecord(ACCESS, PLAYER, ASSET, 41 ether);

        vm.prank(ROUTER);
        s.access.validateAndRecord(ACCESS, PLAYER, ASSET, 40 ether);
        vm.prank(ROUTER);
        s.access.validateAndRecord(ACCESS, PLAYER, ASSET, 40 ether);
        vm.prank(ROUTER);
        vm.expectRevert(BetAccessPolicy420.PeriodLimitExceeded.selector);
        s.access.validateAndRecord(ACCESS, PLAYER, ASSET, 30 ether);

        vm.warp(block.timestamp + 1 days);
        vm.prank(ROUTER);
        s.access.validateAndRecord(ACCESS, PLAYER, ASSET, 30 ether);
    }

    function testPlayerLimitsOnlyTightenAndAreAssetSpecific() public {
        Suite memory s = _deploy();
        bytes32[] memory none = new bytes32[](0);
        _configure(s, ACCESS, none, 0, 0, 0);
        _allowRouter(s, ACCESS);

        vm.prank(PLAYER);
        s.access.setPlayerLimits(ASSET, 25 ether, 50 ether, 1 days);
        vm.prank(PLAYER);
        vm.expectRevert(BetAccessPolicy420.LimitCanOnlyTighten.selector);
        s.access.setPlayerLimits(ASSET, 30 ether, 50 ether, 1 days);

        vm.prank(ROUTER);
        vm.expectRevert(BetAccessPolicy420.StakeLimitExceeded.selector);
        s.access.validateAndRecord(ACCESS, PLAYER, ASSET, 26 ether);

        vm.prank(ROUTER);
        s.access.validateAndRecord(ACCESS, PLAYER, ASSET, 25 ether);
        vm.prank(ROUTER);
        s.access.validateAndRecord(ACCESS, PLAYER, ASSET, 25 ether);
        vm.prank(ROUTER);
        vm.expectRevert(BetAccessPolicy420.PeriodLimitExceeded.selector);
        s.access.validateAndRecord(ACCESS, PLAYER, ASSET, 1 ether);
    }

    function testWrongAssetAndUnauthorizedRecorderFailClosed() public {
        Suite memory s = _deploy();
        bytes32[] memory none = new bytes32[](0);
        _configure(s, ACCESS, none, 0, 0, 0);

        vm.prank(ROUTER);
        vm.expectRevert(BetAccessPolicy420.WrongAsset.selector);
        s.access.validateAndRecord(ACCESS, PLAYER, address(0x1234), 1 ether);

        vm.prank(ROUTER);
        vm.expectRevert(BetAccessPolicy420.Unauthorized.selector);
        s.access.validateAndRecord(ACCESS, PLAYER, ASSET, 1 ether);
    }
}
