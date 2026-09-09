// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../../src/highcountry/constants/ModuleIds.sol";
import { GuestProfileMigration, IGrowerProfileMigration } from "../../../../src/highcountry/access/GuestProfileMigration.sol";
import { MockCapabilityRegistry } from "../../mocks/MockCapabilityRegistry.sol";

contract MockGrowerProfilesPA3 is IGrowerProfileMigration {
    mapping(uint64 => GrowerProfile) private _profiles;

    function setProfile(uint64 id, address account) external {
        _profiles[id] = GrowerProfile(id, account, 1, uint64(block.timestamp), true);
    }

    function getProfile(uint64 id) external view returns (GrowerProfile memory) {
        return _profiles[id];
    }
}

contract GuestProfileMigrationTest {
    MockCapabilityRegistry private caps;
    HighCountryAuthorization private auth;
    MockGrowerProfilesPA3 private growers;
    GuestProfileMigration private migration;

    bytes32 private source = keccak256("guest:save:alpha");
    bytes32 private objectId = keccak256("rare:cultivar:1");
    bytes32 private payloadHash = keccak256("cultivar:payload");
    uint32 private constant POLICY_VERSION = 1;

    constructor() {
        caps = new MockCapabilityRegistry();
        auth = new HighCountryAuthorization(address(caps));
        growers = new MockGrowerProfilesPA3();
        growers.setProfile(7, address(this));
        migration = new GuestProfileMigration(address(auth), address(growers));
        _grant(source, keccak256("hc-pa3:grant"));
    }

    function testProfileClaimIsIdempotentAndOneToOne() public {
        bytes32 root = migration.migrationLeaf(
            source,
            objectId,
            GuestProfileMigration.CanonicalObjectKind.REGISTERED_CULTIVAR,
            payloadHash,
            POLICY_VERSION
        );

        require(migration.claimProfile(source, 7, root, POLICY_VERSION), "initial claim not created");
        require(!migration.claimProfile(source, 7, root, POLICY_VERSION), "exact replay not idempotent");

        (bool conflicting,) = address(migration).call(
            abi.encodeWithSelector(migration.claimProfile.selector, source, uint64(7), keccak256("other-root"), POLICY_VERSION)
        );
        require(!conflicting, "conflicting replay accepted");

        bytes32 secondSource = keccak256("guest:save:beta");
        _grant(secondSource, keccak256("hc-pa3:grant:beta"));
        (bool secondBind,) = address(migration).call(
            abi.encodeWithSelector(migration.claimProfile.selector, secondSource, uint64(7), keccak256("beta-root"), POLICY_VERSION)
        );
        require(!secondBind, "grower profile bound to multiple source profiles");
    }

    function testManifestedObjectConsumesExactlyOnce() public {
        bytes32 root = migration.migrationLeaf(
            source,
            objectId,
            GuestProfileMigration.CanonicalObjectKind.REGISTERED_CULTIVAR,
            payloadHash,
            POLICY_VERSION
        );
        migration.claimProfile(source, 7, root, POLICY_VERSION);

        bytes32[] memory emptyProof = new bytes32[](0);
        bytes32 key = migration.consumeObject(
            source,
            objectId,
            GuestProfileMigration.CanonicalObjectKind.REGISTERED_CULTIVAR,
            payloadHash,
            emptyProof
        );
        require(migration.consumedObject(key), "object consumption missing");

        (bool replay,) = address(migration).call(
            abi.encodeWithSelector(
                migration.consumeObject.selector,
                source,
                objectId,
                GuestProfileMigration.CanonicalObjectKind.REGISTERED_CULTIVAR,
                payloadHash,
                emptyProof
            )
        );
        require(!replay, "object replay consumed twice");
    }

    function testObjectOutsideManifestCannotCanonicalize() public {
        bytes32 root = migration.migrationLeaf(
            source,
            objectId,
            GuestProfileMigration.CanonicalObjectKind.REGISTERED_CULTIVAR,
            payloadHash,
            POLICY_VERSION
        );
        migration.claimProfile(source, 7, root, POLICY_VERSION);
        bytes32[] memory emptyProof = new bytes32[](0);

        (bool accepted,) = address(migration).call(
            abi.encodeWithSelector(
                migration.consumeObject.selector,
                source,
                keccak256("ordinary:irrigation:level"),
                GuestProfileMigration.CanonicalObjectKind.REGISTERED_CULTIVAR,
                keccak256("ordinary:payload"),
                emptyProof
            )
        );
        require(!accepted, "object outside explicit manifest canonicalized");
    }

    function _grant(bytes32 scope, bytes32 grantId) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: address(this),
            componentId: ModuleIds.GUEST_MIGRATION,
            capabilityId: ActionIds.GUEST_MIGRATION_APPLY,
            scopeHash: scope,
            perCallLimit: 0,
            periodLimit: 0,
            periodSeconds: 0,
            validFrom: 0,
            validUntil: uint64(block.timestamp + 365 days),
            revoked: false
        });
        caps.setGrant(grantId, grant, 0);
    }
}
