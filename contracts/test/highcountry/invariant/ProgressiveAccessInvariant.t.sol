// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { ProgressiveGamingTypes } from "../../../src/gaming/access/ProgressiveGamingTypes.sol";
import { HighCountryAuthorization } from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { HighCountryAccessPolicy } from "../../../src/highcountry/access/HighCountryAccessPolicy.sol";
import { GuestProfileMigration, IGrowerProfileMigration } from "../../../src/highcountry/access/GuestProfileMigration.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import { MockCapabilityRegistry } from "../mocks/MockCapabilityRegistry.sol";
import { InvariantTarget420 } from "../../helpers/InvariantTarget420.sol";

contract MockGrowerProfilesPAInvariant is IGrowerProfileMigration {
    GrowerProfile private _profile;
    constructor(address account) { _profile = GrowerProfile(9, account, 1, uint64(block.timestamp), true); }
    function getProfile(uint64 profileId) external view returns (GrowerProfile memory) {
        require(profileId == 9, "unknown profile");
        return _profile;
    }
}

/// @notice Fuzz attempted reclaims of the existing migration while keeping the
/// established fixture and its capability registry outside unrestricted mutation.
contract ProgressiveAccessInvariantHandler {
    GuestProfileMigration private immutable migration;
    bytes32 private immutable source;
    bytes32 private immutable manifestRoot;

    constructor(GuestProfileMigration migration_, bytes32 source_, bytes32 manifestRoot_) {
        migration = migration_;
        source = source_;
        manifestRoot = manifestRoot_;
    }

    function stepAttemptReclaim(uint32 version) external {
        (bool succeeded,) = address(migration).call(
            abi.encodeWithSelector(migration.claimProfile.selector, source, uint64(9), manifestRoot, version)
        );
        require(!succeeded, "existing profile claim replaced");
    }
}

contract ProgressiveAccessInvariantTest is InvariantTarget420 {
    HighCountryAccessPolicy private policy;
    GuestProfileMigration private migration;
    MockCapabilityRegistry private caps;

    bytes32 private source = keccak256("hc-pa:inv:source");
    bytes32 private objectId = keccak256("hc-pa:inv:object");
    bytes32 private payloadHash = keccak256("hc-pa:inv:payload");
    bytes32 private manifestRoot;
    bytes32 private consumedKey;

    function setUp() public {
        policy = new HighCountryAccessPolicy();
        caps = new MockCapabilityRegistry();
        HighCountryAuthorization auth = new HighCountryAuthorization(address(caps));
        MockGrowerProfilesPAInvariant growers = new MockGrowerProfilesPAInvariant(address(this));
        migration = new GuestProfileMigration(address(auth), address(growers));

        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: address(this), componentId: ModuleIds.GUEST_MIGRATION,
            capabilityId: ActionIds.GUEST_MIGRATION_APPLY, scopeHash: source,
            perCallLimit: 0, periodLimit: 0, periodSeconds: 0, validFrom: 0,
            validUntil: uint64(block.timestamp + 365 days), revoked: false
        });
        caps.setGrant(keccak256("hc-pa:inv:grant"), grant, 0);

        manifestRoot = migration.migrationLeaf(
            source, objectId, GuestProfileMigration.CanonicalObjectKind.SIGNIFICANT_ACHIEVEMENT, payloadHash, 1
        );
        migration.claimProfile(source, 9, manifestRoot, 1);
        bytes32[] memory proof = new bytes32[](0);
        consumedKey = migration.consumeObject(
            source, objectId, GuestProfileMigration.CanonicalObjectKind.SIGNIFICANT_ACHIEVEMENT, payloadHash, proof
        );
        targetContract(address(new ProgressiveAccessInvariantHandler(migration, source, manifestRoot)));
    }

    function invariant_HC_INV_ACCESS_019_CoreGameplayNeverRequiresWallet() public view {
        require(policy.canUse(ProgressiveGamingTypes.AccessState.GUEST, ProgressiveGamingTypes.Capability.CORE_GAMEPLAY), "HC-INV-ACCESS-019: guest core play blocked");
        require(!policy.walletRequiredForCoreGameplay(), "HC-INV-ACCESS-019: wallet required");
        require(!policy.walletMayGrantStatAdvantage(), "HC-INV-ACCESS-019: wallet stat advantage");
    }

    function invariant_HC_INV_ACCESS_020_SourceProfileHasSingleCanonicalBinding() public view {
        GuestProfileMigration.ProfileClaim memory claim = migration.getClaim(source);
        require(claim.growerProfileId == 9, "HC-INV-ACCESS-020: grower binding changed");
        require(migration.sourceProfileOfGrowerProfile(9) == source, "HC-INV-ACCESS-020: reverse binding changed");
    }

    function invariant_HC_INV_ACCESS_021_ObjectCanonicalizesAtMostOnce() public view {
        require(migration.consumedObject(consumedKey), "HC-INV-ACCESS-021: consumed state regressed");
    }

    function invariant_HC_INV_ACCESS_022_ClaimManifestAndPolicyStayImmutable() public view {
        GuestProfileMigration.ProfileClaim memory claim = migration.getClaim(source);
        require(claim.manifestRoot == manifestRoot, "HC-INV-ACCESS-022: manifest changed");
        require(claim.policyVersion == 1, "HC-INV-ACCESS-022: policy version changed");
    }

    function invariant_HC_INV_ACCESS_023_OrdinaryStateRemainsOffChainAuthority() public view {
        require(policy.authorityFor(HighCountryAccessPolicy.StateObject.ORDINARY_FARM_PROGRESSION) == ProgressiveGamingTypes.StateAuthority.LOCAL_GAME_STATE, "HC-INV-ACCESS-023: farm state promoted");
        require(policy.authorityFor(HighCountryAccessPolicy.StateObject.IRRIGATION_UPGRADE) == ProgressiveGamingTypes.StateAuthority.LOCAL_GAME_STATE, "HC-INV-ACCESS-023: irrigation promoted");
    }
}
