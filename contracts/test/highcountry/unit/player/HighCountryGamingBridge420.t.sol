// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { HighCountryGamingBridge420, IGameIdentityHC420, IGameClaimsHC420, IGameEntitlementsHC420, IGrowerProfileHC420 } from "../../../../src/highcountry/player/HighCountryGamingBridge420.sol";
import { HighCountryGamingIds } from "../../../../src/highcountry/player/HighCountryGamingIds.sol";

interface VmHCGaming420 { function prank(address) external; }

contract MockGameIdentityHC420 is IGameIdentityHC420 {
    mapping(bytes32 => mapping(address => bytes32)) internal ids;
    mapping(bytes32 => GameProfile) internal profiles;

    function setProfile(bytes32 gameId, address account, bytes32 profileId) external {
        ids[gameId][account] = profileId;
        profiles[profileId] = GameProfile(profileId, gameId, account, bytes32(0), uint64(block.timestamp), true);
    }

    function profileIdOf(bytes32 gameId, address account) external view returns (bytes32) { return ids[gameId][account]; }
    function profile(bytes32 profileId) external view returns (GameProfile memory) { return profiles[profileId]; }
}

contract MockGameClaimsHC420 is IGameClaimsHC420 {
    mapping(bytes32 => MigrationClaim) internal claims;

    function setClaim(MigrationClaim calldata record) external { claims[record.claimId] = record; }
    function claim(bytes32 claimId) external view returns (MigrationClaim memory) { return claims[claimId]; }
}

contract MockGameEntitlementsHC420 is IGameEntitlementsHC420 {
    mapping(bytes32 => Entitlement) internal records;
    mapping(bytes32 => bool) internal active;

    function setEntitlement(Entitlement calldata record, bool isActive_) external { records[record.entitlementId] = record; active[record.entitlementId] = isActive_; }
    function entitlement(bytes32 entitlementId) external view returns (Entitlement memory) { return records[entitlementId]; }
    function isActive(bytes32 entitlementId) external view returns (bool) { return active[entitlementId]; }
}

contract MockGrowerProfileHC420 is IGrowerProfileHC420 {
    mapping(uint64 => GrowerProfile) internal profiles;

    function setProfile(uint64 id, address account) external { profiles[id] = GrowerProfile(id, account, 1, uint64(block.timestamp), true); }
    function getProfile(uint64 profileId) external view returns (GrowerProfile memory) { return profiles[profileId]; }
}

contract HighCountryGamingBridge420Test {
    VmHCGaming420 internal constant vm = VmHCGaming420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);

    MockGameIdentityHC420 internal identity;
    MockGameClaimsHC420 internal claims;
    MockGameEntitlementsHC420 internal entitlements;
    MockGrowerProfileHC420 internal growers;
    HighCountryGamingBridge420 internal bridge;

    function setUp() public {
        identity = new MockGameIdentityHC420();
        claims = new MockGameClaimsHC420();
        entitlements = new MockGameEntitlementsHC420();
        growers = new MockGrowerProfileHC420();
        bridge = new HighCountryGamingBridge420(address(identity), address(claims), address(entitlements), address(growers));
    }

    function _bindAlice() internal returns (bytes32 sharedProfileId) {
        sharedProfileId = keccak256("alice-hc-game-profile");
        growers.setProfile(1, ALICE);
        identity.setProfile(HighCountryGamingIds.GAME_ID, ALICE, sharedProfileId);
        vm.prank(ALICE);
        bytes32 bound = bridge.bindGrowerProfile(1);
        require(bound == sharedProfileId, "wrong shared profile bound");
    }

    function testBindsGrowerToCanonicalSharedGameProfile() public {
        bytes32 sharedProfileId = _bindAlice();
        require(bridge.gameProfileIdOfGrower(1) == sharedProfileId, "grower binding missing");
        require(bridge.growerProfileIdOfGameProfile(sharedProfileId) == 1, "reverse binding missing");
    }

    function testRejectsBindingByDifferentWallet() public {
        growers.setProfile(1, ALICE);
        identity.setProfile(HighCountryGamingIds.GAME_ID, BOB, keccak256("bob-profile"));
        vm.prank(BOB);
        (bool ok,) = address(bridge).call(abi.encodeWithSelector(bridge.bindGrowerProfile.selector, uint64(1)));
        require(!ok, "foreign grower bound");
    }

    function testRequiresSharedGamingProfileBeforeBinding() public {
        growers.setProfile(1, ALICE);
        vm.prank(ALICE);
        (bool ok,) = address(bridge).call(abi.encodeWithSelector(bridge.bindGrowerProfile.selector, uint64(1)));
        require(!ok, "binding succeeded without shared profile");
    }

    function testConsumedGuestMigrationCanBindOnce() public {
        bytes32 sharedProfileId = _bindAlice();
        bytes32 claimId = keccak256("guest-claim");
        bytes32 payloadHash = keccak256("migration-payload");
        claims.setClaim(IGameClaimsHC420.MigrationClaim({
            claimId: claimId,
            gameId: HighCountryGamingIds.GAME_ID,
            targetAccount: ALICE,
            guestStateCommitment: keccak256("guest-state"),
            migrationPayloadHash: payloadHash,
            validUntil: 0,
            consumed: true,
            cancelled: false,
            exists: true
        }));

        vm.prank(ALICE);
        bridge.bindConsumedMigrationClaim(claimId, 1, payloadHash);
        require(bridge.growerProfileIdOfMigrationClaim(claimId) == 1, "claim binding missing");
        require(bridge.gameProfileIdOfGrower(1) == sharedProfileId, "profile binding changed");

        vm.prank(ALICE);
        (bool ok,) = address(bridge).call(abi.encodeWithSelector(bridge.bindConsumedMigrationClaim.selector, claimId, uint64(1), payloadHash));
        require(!ok, "migration claim replayed");
    }

    function testEntitlementMustBelongToBoundHighCountryProfile() public {
        bytes32 sharedProfileId = _bindAlice();
        bytes32 entitlementId = keccak256("breeders-district");
        entitlements.setEntitlement(IGameEntitlementsHC420.Entitlement({
            entitlementId: entitlementId,
            profileId: sharedProfileId,
            gameId: HighCountryGamingIds.GAME_ID,
            entitlementType: HighCountryGamingIds.ENTITLEMENT_BONUS_REGION,
            contentId: keccak256("breeders-district-content"),
            validFrom: 0,
            validUntil: 0,
            revoked: false,
            exists: true
        }), true);
        require(bridge.hasActiveEntitlement(1, entitlementId), "valid entitlement rejected");

        bytes32 foreignEntitlement = keccak256("foreign-entitlement");
        entitlements.setEntitlement(IGameEntitlementsHC420.Entitlement({
            entitlementId: foreignEntitlement,
            profileId: keccak256("other-profile"),
            gameId: HighCountryGamingIds.GAME_ID,
            entitlementType: HighCountryGamingIds.ENTITLEMENT_COSMETIC,
            contentId: keccak256("other-content"),
            validFrom: 0,
            validUntil: 0,
            revoked: false,
            exists: true
        }), true);
        require(!bridge.hasActiveEntitlement(1, foreignEntitlement), "foreign entitlement accepted");
    }

    function testScopedEntitlementRequiresMatchingTypeAndContent() public {
        bytes32 sharedProfileId = _bindAlice();
        bytes32 entitlementId = keccak256("breeders-district");
        bytes32 contentId = keccak256("breeders-district-content");
        entitlements.setEntitlement(IGameEntitlementsHC420.Entitlement({
            entitlementId: entitlementId,
            profileId: sharedProfileId,
            gameId: HighCountryGamingIds.GAME_ID,
            entitlementType: HighCountryGamingIds.ENTITLEMENT_BONUS_REGION,
            contentId: contentId,
            validFrom: 0,
            validUntil: 0,
            revoked: false,
            exists: true
        }), true);

        require(
            bridge.hasScopedEntitlement(1, entitlementId, HighCountryGamingIds.ENTITLEMENT_BONUS_REGION, contentId),
            "valid scoped entitlement rejected"
        );
        require(bridge.hasBonusRegion(1, entitlementId, contentId), "bonus region helper rejected valid entitlement");
        require(
            !bridge.hasScopedEntitlement(1, entitlementId, HighCountryGamingIds.ENTITLEMENT_COSMETIC, contentId),
            "wrong entitlement type accepted"
        );
        require(
            !bridge.hasScopedEntitlement(1, entitlementId, HighCountryGamingIds.ENTITLEMENT_BONUS_REGION, keccak256("wrong-content")),
            "wrong content accepted"
        );
    }

    function testRequireScopedEntitlementFailsClosed() public {
        _bindAlice();
        bytes32 missingId = keccak256("missing-entitlement");
        (bool ok,) = address(bridge).call(
            abi.encodeWithSelector(
                bridge.requireScopedEntitlement.selector,
                uint64(1),
                missingId,
                HighCountryGamingIds.ENTITLEMENT_COMPETITION,
                keccak256("global-420-cup")
            )
        );
        require(!ok, "missing entitlement did not fail closed");
    }
}
