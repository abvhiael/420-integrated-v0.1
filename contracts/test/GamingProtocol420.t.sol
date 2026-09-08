// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/gaming/GamingAuthorization420.sol";
import "../src/gaming/GamingIds420.sol";
import "../src/gaming/GameRegistry420.sol";
import "../src/gaming/GameIdentity420.sol";
import "../src/gaming/GameEntitlements420.sol";
import "../src/gaming/GameClaims420.sol";
import "../src/gaming/CrossGameRegistry420.sol";

interface VmGaming420 { function prank(address) external; function warp(uint256) external; }

contract MockGamingCapabilities420 is ICapabilityRegistry420 {
    bool public authorized;
    function setAuthorized(bool value) external { authorized = value; }
    function grant(bytes32) external pure returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address,bytes32,bytes32,bytes32,uint256) external view returns (bool) { return authorized; }
}

contract GamingProtocol420Test {
    VmGaming420 internal constant vm = VmGaming420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant GOVERNOR = address(0x420);
    address internal constant OPERATOR = address(0xBEEF);
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    bytes32 internal constant GAME_ID = keccak256("HIGH_COUNTRY");

    function _setup() internal returns (
        MockGamingCapabilities420 caps,
        GameRegistry420 games,
        GameIdentity420 identity,
        GameEntitlements420 entitlements,
        GameClaims420 claims,
        CrossGameRegistry420 crossGame
    ) {
        caps = new MockGamingCapabilities420();
        GamingAuthorization420 auth = new GamingAuthorization420(address(caps));
        games = new GameRegistry420(address(auth));
        identity = new GameIdentity420(address(games));
        entitlements = new GameEntitlements420(address(games), address(identity));
        claims = new GameClaims420(address(games), address(identity));
        crossGame = new CrossGameRegistry420(address(games), address(identity));
        caps.setAuthorized(true);
        vm.prank(GOVERNOR);
        games.registerGame(GAME_ID, OPERATOR, keccak256("high-country-v1"));
    }

    function testWalletLinkedProfileAndEntitlementLifecycle() public {
        (, GameRegistry420 games, GameIdentity420 identity, GameEntitlements420 entitlements,,) = _setup();
        require(games.isActive(GAME_ID), "game inactive");

        vm.prank(ALICE);
        bytes32 profileId = identity.createProfile(GAME_ID, keccak256("registered-player-42"));
        require(identity.profileIdOf(GAME_ID, ALICE) == profileId, "profile link missing");

        bytes32 entitlementId = keccak256("breeders-district/alice");
        vm.prank(OPERATOR);
        entitlements.issue(entitlementId, profileId, GamingIds420.ENTITLEMENT_CLASS_CONTENT, keccak256("BREEDERS_DISTRICT"), 0, 0);
        require(entitlements.isActive(entitlementId), "entitlement inactive");

        vm.prank(OPERATOR);
        entitlements.revoke(entitlementId);
        require(!entitlements.isActive(entitlementId), "revoked entitlement active");
    }

    function testGuestMigrationClaimIsTargetBoundAndReplaySafe() public {
        (, , GameIdentity420 identity,, GameClaims420 claims,) = _setup();
        vm.prank(ALICE);
        bytes32 profileId = identity.createProfile(GAME_ID, keccak256("guest-profile-commitment"));

        bytes32 claimId = keccak256("guest-claim-1");
        vm.prank(OPERATOR);
        claims.issue(claimId, GAME_ID, ALICE, keccak256("guest-state-root"), keccak256("eligible-migration-payload"), uint64(block.timestamp + 1 days));

        vm.prank(BOB);
        (bool wrongAccount,) = address(claims).call(abi.encodeWithSelector(claims.consume.selector, claimId));
        require(!wrongAccount, "wrong account consumed migration");

        vm.prank(ALICE);
        bytes32 consumedProfile = claims.consume(claimId);
        require(consumedProfile == profileId, "claim linked wrong profile");

        vm.prank(ALICE);
        (bool replay,) = address(claims).call(abi.encodeWithSelector(claims.consume.selector, claimId));
        require(!replay, "migration replay accepted");
    }

    function testCrossGameAttestationHasNoEnumerationAuthority() public {
        (, , GameIdentity420 identity,,, CrossGameRegistry420 crossGame) = _setup();
        vm.prank(ALICE);
        bytes32 profileId = identity.createProfile(GAME_ID, bytes32(0));

        bytes32 attestationId = keccak256("hc/global-420-cup/2027/alice");
        vm.prank(OPERATOR);
        crossGame.issue(attestationId, profileId, keccak256("ACHIEVEMENT"), keccak256("GLOBAL_420_CUP_2027"), keccak256("result-root"), 0);
        require(crossGame.isActive(attestationId), "attestation inactive");
    }

    function testGameRegistrationDefaultsToCapabilityDeny() public {
        MockGamingCapabilities420 caps = new MockGamingCapabilities420();
        GamingAuthorization420 auth = new GamingAuthorization420(address(caps));
        GameRegistry420 games = new GameRegistry420(address(auth));
        vm.prank(GOVERNOR);
        (bool ok,) = address(games).call(abi.encodeWithSelector(games.registerGame.selector, GAME_ID, OPERATOR, keccak256("metadata")));
        require(!ok, "unprivileged game registration accepted");
    }

    function testInactiveGameCannotCreateNewProfiles() public {
        (MockGamingCapabilities420 caps, GameRegistry420 games, GameIdentity420 identity,,,) = _setup();
        caps.setAuthorized(true);
        vm.prank(GOVERNOR);
        games.setGameStatus(GAME_ID, false);
        vm.prank(ALICE);
        (bool ok,) = address(identity).call(abi.encodeWithSelector(identity.createProfile.selector, GAME_ID, bytes32(0)));
        require(!ok, "inactive game profile created");
    }
}
