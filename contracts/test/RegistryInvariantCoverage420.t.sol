// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/apps/Identity420.sol";
import "../src/pay/MerchantRegistry420.sol";
import "../src/system/SystemAccess.sol";

interface VmRegistryInvariant420 {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }

    function prank(
        address
    ) external;
    function expectRevert(
        bytes4
    ) external;
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}

contract RegistryInvariantImplementation420 {
    function ping() external pure returns (bytes4) {
        return this.ping.selector;
    }
}

contract RegistryInvariantCoverage420Test {
    VmRegistryInvariant420 constant vm =
        VmRegistryInvariant420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant OUTSIDER = address(0xBAD);
    address constant ALICE = address(0xA11CE);

    bytes32 constant PAY_ID = keccak256("420/service/pay/v1");
    bytes32 constant EXTENSION_ID = keccak256("420/service/reg-audit-3-extension/v1");

    function _publish(
        ProtocolRegistry registry,
        bytes32 serviceId,
        address implementation,
        uint32 version,
        bytes32 manifestHash,
        bytes32 dependencyRoot,
        bytes32 interfaceHash
    ) internal {
        registry.publishRegisteredService(
            serviceId,
            implementation,
            keccak256(abi.encodePacked("metadata", version)),
            version,
            true,
            ProtocolRegistry.ComponentType.APPLICATION,
            manifestHash,
            dependencyRoot,
            interfaceHash
        );
    }

    function test_REG_INV_001_canonical_or_explicit_extension_only() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryInvariantImplementation420 implementation = new RegistryInvariantImplementation420();

        require(registry.isGenesisCanonicalServiceId(PAY_ID), "pay must be canonical");

        vm.expectRevert(ProtocolRegistry.UnapprovedServiceId.selector);
        _publish(
            registry,
            EXTENSION_ID,
            address(implementation),
            1,
            keccak256("manifest"),
            bytes32(0),
            keccak256("interface")
        );

        registry.approveServiceId(EXTENSION_ID, keccak256("extension descriptor"));
        _publish(
            registry,
            EXTENSION_ID,
            address(implementation),
            1,
            keccak256("manifest"),
            bytes32(0),
            keccak256("interface")
        );
        require(registry.currentVersion(EXTENSION_ID) == 1, "approved extension not published");
    }

    function test_REG_INV_002_versions_are_sequential_and_history_readable() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryInvariantImplementation420 first = new RegistryInvariantImplementation420();
        RegistryInvariantImplementation420 second = new RegistryInvariantImplementation420();

        _publish(registry, PAY_ID, address(first), 1, keccak256("m1"), bytes32(0), keccak256("i1"));

        vm.expectRevert(ProtocolRegistry.InvalidVersion.selector);
        _publish(registry, PAY_ID, address(second), 3, keccak256("m3"), bytes32(0), keccak256("i3"));

        _publish(registry, PAY_ID, address(second), 2, keccak256("m2"), bytes32(0), keccak256("i2"));
        require(registry.getServiceVersion(PAY_ID, 1).implementation == address(first), "v1 history lost");
        require(registry.getServiceVersion(PAY_ID, 2).implementation == address(second), "v2 history missing");
    }

    function test_REG_INV_003_genesis_registration_rejects_no_runtime_code() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        vm.expectRevert(ProtocolRegistry.ImplementationHasNoCode.selector);
        _publish(registry, PAY_ID, address(0x1001), 1, keccak256("manifest"), bytes32(0), keccak256("interface"));
    }

    function test_REG_INV_004_runtime_code_hash_is_derived_not_caller_supplied() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryInvariantImplementation420 implementation = new RegistryInvariantImplementation420();

        _publish(
            registry, PAY_ID, address(implementation), 1, keccak256("manifest"), bytes32(0), keccak256("interface")
        );

        ProtocolRegistry.Service memory service = registry.getService(PAY_ID);
        require(service.codeHash == address(implementation).codehash, "runtime code hash not derived");
    }

    function test_REG_INV_005_zero_manifest_and_interface_rejected_independently() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryInvariantImplementation420 implementation = new RegistryInvariantImplementation420();

        vm.expectRevert(ProtocolRegistry.InvalidManifest.selector);
        _publish(registry, PAY_ID, address(implementation), 1, bytes32(0), bytes32(0), keccak256("interface"));

        vm.expectRevert(ProtocolRegistry.InvalidManifest.selector);
        _publish(registry, PAY_ID, address(implementation), 1, keccak256("manifest"), bytes32(0), bytes32(0));

        require(registry.currentVersion(PAY_ID) == 0, "rejected publication mutated state");
    }

    function test_REG_INV_006_published_profile_is_immutable_for_version() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryInvariantImplementation420 implementation = new RegistryInvariantImplementation420();

        bytes32 manifest = keccak256("immutable-manifest");
        bytes32 dependencies = keccak256("immutable-dependencies");
        bytes32 iface = keccak256("immutable-interface");
        _publish(registry, PAY_ID, address(implementation), 1, manifest, dependencies, iface);

        vm.expectRevert(ProtocolRegistry.InvalidVersion.selector);
        registry.publishRegisteredService(
            PAY_ID,
            address(implementation),
            keccak256("replacement metadata"),
            1,
            true,
            ProtocolRegistry.ComponentType.REGISTRY,
            keccak256("replacement manifest"),
            keccak256("replacement dependencies"),
            keccak256("replacement interface")
        );

        ProtocolRegistry.RegistrationProfile memory profile = registry.getRegistrationProfile(PAY_ID, 1);
        require(profile.componentType == ProtocolRegistry.ComponentType.APPLICATION, "component type mutated");
        require(profile.manifestHash == manifest, "manifest mutated");
        require(profile.dependencyRoot == dependencies, "dependency root mutated");
        require(profile.interfaceHash == iface, "interface commitment mutated");
    }

    function test_REG_INV_007_only_governance_can_approve_publish_or_deprecate() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryInvariantImplementation420 implementation = new RegistryInvariantImplementation420();

        vm.expectRevert(SystemAccess.Unauthorized.selector);
        vm.prank(OUTSIDER);
        registry.approveServiceId(EXTENSION_ID, keccak256("descriptor"));

        vm.expectRevert(SystemAccess.Unauthorized.selector);
        vm.prank(OUTSIDER);
        _publish(
            registry, PAY_ID, address(implementation), 1, keccak256("manifest"), bytes32(0), keccak256("interface")
        );

        _publish(
            registry, PAY_ID, address(implementation), 1, keccak256("manifest"), bytes32(0), keccak256("interface")
        );

        vm.expectRevert(SystemAccess.Unauthorized.selector);
        vm.prank(OUTSIDER);
        registry.deprecateService(PAY_ID);

        require(registry.isServiceActive(PAY_ID), "unauthorized deprecation changed state");
    }

    function test_REG_INV_008_deprecation_fails_closed_and_preserves_history() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryInvariantImplementation420 implementation = new RegistryInvariantImplementation420();

        _publish(
            registry, PAY_ID, address(implementation), 1, keccak256("manifest"), bytes32(0), keccak256("interface")
        );
        registry.deprecateService(PAY_ID);

        require(!registry.isServiceActive(PAY_ID), "service remains active");
        require(!registry.getServiceVersion(PAY_ID, 1).active, "history lifecycle not preserved");
        require(registry.getServiceVersion(PAY_ID, 1).implementation == address(implementation), "history lost");

        vm.expectRevert(ProtocolRegistry.UnknownService.selector);
        registry.resolveActive(PAY_ID);
    }

    function test_REG_INV_009_registry_publication_grants_no_real_resident_authority() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryInvariantImplementation420 publishedImplementation = new RegistryInvariantImplementation420();

        registry.approveServiceId(EXTENSION_ID, keccak256("descriptor"));
        _publish(
            registry,
            EXTENSION_ID,
            address(publishedImplementation),
            1,
            keccak256("manifest"),
            bytes32(0),
            keccak256("interface")
        );

        MerchantRegistry420 merchantRegistry =
            new MerchantRegistry420(address(this), address(registry), keccak256("merchant-config"));

        vm.expectRevert(SystemAccess.Unauthorized.selector);
        vm.prank(address(publishedImplementation));
        merchantRegistry.setStatus(keccak256("unknown-merchant"), MerchantRegistry420.Status.REGULATED, true);
    }

    function test_REG_INV_010_projection_can_reconstruct_from_events_and_reads() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryInvariantImplementation420 implementation = new RegistryInvariantImplementation420();
        bytes32 manifest = keccak256("projection-manifest");
        bytes32 dependencies = keccak256("projection-dependencies");
        bytes32 iface = keccak256("projection-interface");
        bytes32 metadata = keccak256("projection-metadata");

        vm.recordLogs();
        registry.publishRegisteredService(
            PAY_ID,
            address(implementation),
            metadata,
            1,
            true,
            ProtocolRegistry.ComponentType.APPLICATION,
            manifest,
            dependencies,
            iface
        );
        VmRegistryInvariant420.Log[] memory logs = vm.getRecordedLogs();

        bytes32 serviceEventSig = keccak256("ServiceVersionPublished(bytes32,uint32,address,bytes32,bytes32,bool)");
        bytes32 profileEventSig =
            keccak256("ServiceRegistrationProfilePublished(bytes32,uint32,uint8,bytes32,bytes32,bytes32)");

        bool sawService;
        bool sawProfile;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter != address(registry) || logs[i].topics.length == 0) continue;
            if (logs[i].topics[0] == serviceEventSig) {
                require(logs[i].topics[1] == PAY_ID, "service id topic");
                require(uint32(uint256(logs[i].topics[2])) == 1, "version topic");
                require(address(uint160(uint256(logs[i].topics[3]))) == address(implementation), "implementation topic");
                (bytes32 codeHash, bytes32 eventMetadata, bool active) =
                    abi.decode(logs[i].data, (bytes32, bytes32, bool));
                require(codeHash == address(implementation).codehash, "event code hash");
                require(eventMetadata == metadata && active, "event service fields");
                sawService = true;
            } else if (logs[i].topics[0] == profileEventSig) {
                require(logs[i].topics[1] == PAY_ID, "profile service id");
                require(uint32(uint256(logs[i].topics[2])) == 1, "profile version");
                (
                    ProtocolRegistry.ComponentType componentType,
                    bytes32 eventManifest,
                    bytes32 eventDependencies,
                    bytes32 eventInterface
                ) = abi.decode(logs[i].data, (ProtocolRegistry.ComponentType, bytes32, bytes32, bytes32));
                require(componentType == ProtocolRegistry.ComponentType.APPLICATION, "event type");
                require(eventManifest == manifest, "event manifest");
                require(eventDependencies == dependencies, "event dependencies");
                require(eventInterface == iface, "event interface");
                sawProfile = true;
            }
        }

        require(sawService && sawProfile, "projection events incomplete");
        ProtocolRegistry.Service memory service = registry.getService(PAY_ID);
        ProtocolRegistry.RegistrationProfile memory profile = registry.getRegistrationProfile(PAY_ID, 1);
        require(
            service.implementation == address(implementation) && service.metadataHash == metadata,
            "read service mismatch"
        );
        require(
            profile.manifestHash == manifest && profile.dependencyRoot == dependencies
                && profile.interfaceHash == iface,
            "read profile mismatch"
        );
    }

    function test_REG_INV_011_registry_metadata_cannot_overwrite_identity_state() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        RegistryInvariantImplementation420 implementation = new RegistryInvariantImplementation420();
        Identity420 identity = new Identity420(address(this));
        bytes32 profileId = keccak256("domain-owned-profile");

        vm.prank(ALICE);
        identity.createProfile(profileId, keccak256("identity-metadata"));
        (address beforeController,,,,,,) = identity.profiles(profileId);
        require(beforeController == ALICE, "identity setup");

        registry.publishRegisteredService(
            PAY_ID,
            address(implementation),
            profileId,
            1,
            true,
            ProtocolRegistry.ComponentType.APPLICATION,
            profileId,
            profileId,
            profileId
        );

        (address afterController,,,,,,) = identity.profiles(profileId);
        require(afterController == ALICE, "registry metadata altered identity authority");
    }

    function test_REG_INV_012_extension_approval_cannot_collide_with_canonical_id() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        bytes32 descriptor = keccak256("malicious extension descriptor");

        require(registry.isGenesisCanonicalServiceId(PAY_ID), "fixture not canonical");
        vm.expectRevert(ProtocolRegistry.CanonicalServiceIdImmutable.selector);
        registry.approveServiceId(PAY_ID, descriptor);

        require(!registry.approvedServiceIds(PAY_ID), "canonical id marked as extension");
        require(registry.serviceDescriptorHash(PAY_ID) == bytes32(0), "canonical descriptor overwritten");
        require(registry.isGenesisCanonicalServiceId(PAY_ID), "canonical identity changed");
    }
}
