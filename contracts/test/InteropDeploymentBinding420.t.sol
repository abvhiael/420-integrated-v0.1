// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/interfaces/genesis/Types420.sol";
import "../src/interop/InteropIds420.sol";
import "../src/interfaces/I420IS.sol";
import "../src/interop/InteropProviderRegistry420.sol";
import "../src/interop/InteropNamespaceRegistry420.sol";
import "../src/interop/InteropCheckpointRegistry420.sol";
import "../src/interop/InteropRouter420.sol";

contract InteropReleaseAdapter420 is I420ISAdapter {
    bytes32 public immutable kind;
    bytes32 public immutable manifest;
    mapping(bytes32 => bool) public supported;

    constructor(bytes32 kind_, bytes32 manifest_) {
        kind = kind_;
        manifest = manifest_;
    }

    function standardVersion() external pure override returns (uint32) { return 1; }
    function adapterType() external view override returns (bytes32) { return kind; }
    function supportsDomain(bytes32 domainId) external view override returns (bool) { return supported[domainId]; }
    function adapterManifestHash() external view override returns (bytes32) { return manifest; }
    function setSupported(bytes32 domainId, bool value) external { supported[domainId] = value; }

    function publish(
        InteropNamespaceRegistry420 registry,
        bytes32 namespaceId,
        bytes32 externalIdHash,
        bytes32 canonicalId,
        bytes32 attestationHash
    ) external returns (bytes32) {
        return registry.publishMapping(namespaceId, externalIdHash, canonicalId, attestationHash);
    }

    function checkpoint(
        InteropCheckpointRegistry420 registry,
        bytes32 providerId,
        bytes32 domainId,
        uint64 sequence,
        bytes32 stateHash,
        bytes32 previousHash
    ) external returns (bytes32) {
        return registry.publishCheckpoint(providerId, domainId, sequence, stateHash, previousHash);
    }
}

contract InteropDeploymentBinding420Test {
    bytes32 internal constant INTEROP_SERVICE_ID = keccak256("420/service/420-is/v1");
    bytes32 internal constant METADATA_HASH = keccak256("420/IS/RELEASE/METADATA/LOCAL-QUALIFICATION/V1");
    bytes32 internal constant MANIFEST_HASH = keccak256("420/IS/AUDIT-4/RELEASE-MATERIALIZATION/V1");
    bytes32 internal constant INTERFACE_HASH = keccak256("420/IS/INTEROP_ROUTER/INTERFACE/V1");

    bytes32 internal constant PROVIDER = keccak256("420/IS/LOCAL/PROVIDER/V1");
    bytes32 internal constant ADAPTER_TYPE = keccak256("420/IS/LOCAL/ADAPTER-TYPE/V1");
    bytes32 internal constant ADAPTER_MANIFEST = keccak256("420/IS/LOCAL/ADAPTER-MANIFEST/V1");
    bytes32 internal constant NAMESPACE = keccak256("420/IS/LOCAL/NAMESPACE/V1");
    bytes32 internal constant DOMAIN = keccak256("420/IS/LOCAL/DOMAIN/V1");

    event DeploymentAddress(string name, address implementation);
    event RuntimeCodeHash(string name, bytes32 codeHash);
    event ReleaseCommitment(string name, bytes32 value);

    struct Env {
        ProtocolRegistry registry;
        InteropProviderRegistry420 providers;
        InteropNamespaceRegistry420 namespaces;
        InteropCheckpointRegistry420 checkpoints;
        InteropRouter420 router;
        InteropReleaseAdapter420 adapter;
        bytes32 dependencyRoot;
    }

    function _deploy() internal returns (Env memory e) {
        e.registry = new ProtocolRegistry(address(this));
        e.providers = new InteropProviderRegistry420(address(this));
        e.namespaces = new InteropNamespaceRegistry420(address(this), address(e.providers));
        e.checkpoints = new InteropCheckpointRegistry420(address(e.providers));
        e.router = new InteropRouter420(address(e.providers), address(e.namespaces), address(e.checkpoints));

        e.dependencyRoot = keccak256(
            abi.encode(
                address(e.providers),
                address(e.namespaces),
                address(e.checkpoints),
                address(e.router),
                address(e.providers).codehash,
                address(e.namespaces).codehash,
                address(e.checkpoints).codehash,
                address(e.router).codehash
            )
        );

        e.registry.registerComponent(
            InteropIds420.COMPONENT_420_IS,
            address(e.router),
            Types420.Version({major: 1, minor: 0, patch: 0}),
            Types420.Lifecycle.ACTIVE
        );
        e.registry.publishRegisteredService(
            INTEROP_SERVICE_ID,
            address(e.router),
            METADATA_HASH,
            1,
            true,
            ProtocolRegistry.ComponentType.SERVICE,
            MANIFEST_HASH,
            e.dependencyRoot,
            INTERFACE_HASH
        );

        emit DeploymentAddress("InteropProviderRegistry420", address(e.providers));
        emit DeploymentAddress("InteropNamespaceRegistry420", address(e.namespaces));
        emit DeploymentAddress("InteropCheckpointRegistry420", address(e.checkpoints));
        emit DeploymentAddress("InteropRouter420", address(e.router));
        emit RuntimeCodeHash("InteropProviderRegistry420", address(e.providers).codehash);
        emit RuntimeCodeHash("InteropNamespaceRegistry420", address(e.namespaces).codehash);
        emit RuntimeCodeHash("InteropCheckpointRegistry420", address(e.checkpoints).codehash);
        emit RuntimeCodeHash("InteropRouter420", address(e.router).codehash);
        emit ReleaseCommitment("dependencyRoot", e.dependencyRoot);
        emit ReleaseCommitment("manifestHash", MANIFEST_HASH);
        emit ReleaseCommitment("interfaceHash", INTERFACE_HASH);
    }

    function testDeploymentOrderAndConstructorBindings() public {
        Env memory e = _deploy();

        require(e.providers.governanceTimelock() == address(this), "provider/timelock");
        require(e.namespaces.governanceTimelock() == address(this), "namespace/timelock");
        require(address(e.namespaces.providers()) == address(e.providers), "namespace/providers");
        require(address(e.checkpoints.providers()) == address(e.providers), "checkpoint/providers");
        require(address(e.router.providers()) == address(e.providers), "router/providers");
        require(address(e.router.namespaces()) == address(e.namespaces), "router/namespaces");
        require(address(e.router.checkpoints()) == address(e.checkpoints), "router/checkpoints");
    }

    function testProtocolRegistryPublicationBindsRouterCodeAndProfile() public {
        Env memory e = _deploy();

        ProtocolRegistry.Service memory service = e.registry.getService(INTEROP_SERVICE_ID);
        require(service.implementation == address(e.router), "service implementation");
        require(service.codeHash == address(e.router).codehash, "service codehash");
        require(service.version == 1 && service.active, "service lifecycle");

        ProtocolRegistry.RegistrationProfile memory profile =
            e.registry.getRegistrationProfile(INTEROP_SERVICE_ID, 1);
        require(profile.componentType == ProtocolRegistry.ComponentType.SERVICE, "component type");
        require(profile.manifestHash == MANIFEST_HASH, "manifest");
        require(profile.interfaceHash == INTERFACE_HASH, "interface");
        require(profile.dependencyRoot == e.dependencyRoot, "dependencies");

        require(e.registry.resolve(InteropIds420.COMPONENT_420_IS) == address(e.router), "component resolve");
        require(
            e.registry.runtimeCodeHash(InteropIds420.COMPONENT_420_IS) == address(e.router).codehash,
            "component codehash"
        );
    }

    function testLocalSmokeProviderNamespaceMappingCheckpointAndRouter() public {
        Env memory e = _deploy();
        e.adapter = new InteropReleaseAdapter420(ADAPTER_TYPE, ADAPTER_MANIFEST);
        e.adapter.setSupported(DOMAIN, true);

        e.providers.registerProvider(PROVIDER, address(e.adapter), ADAPTER_TYPE, ADAPTER_MANIFEST);
        e.namespaces.registerNamespace(NAMESPACE, PROVIDER, keccak256("420/IS/LOCAL/SCHEMA/V1"));

        bytes32 externalIdHash = keccak256("external/local/1");
        bytes32 canonicalId = keccak256("canonical/local/1");
        bytes32 attestationHash = keccak256("attestation/local/1");
        e.adapter.publish(e.namespaces, NAMESPACE, externalIdHash, canonicalId, attestationHash);

        (bytes32 resolved, bytes32 attestation, InteropNamespaceRegistry420.MappingStatus status) =
            e.router.resolve(NAMESPACE, externalIdHash, 1);
        require(resolved == canonicalId, "mapping canonical");
        require(attestation == attestationHash, "mapping attestation");
        require(status == InteropNamespaceRegistry420.MappingStatus.ACTIVE, "mapping active");
        require(e.router.providerSupports(PROVIDER, DOMAIN), "provider domain");

        bytes32 checkpointHash =
            e.adapter.checkpoint(e.checkpoints, PROVIDER, DOMAIN, 1, keccak256("state/local/1"), bytes32(0));
        (uint64 sequence, bytes32 stateHash, bytes32 latestHash) = e.checkpoints.latestCheckpoint(PROVIDER, DOMAIN);
        require(sequence == 1, "checkpoint sequence");
        require(stateHash == keccak256("state/local/1"), "checkpoint state");
        require(latestHash == checkpointHash, "checkpoint hash");
    }

    function testServiceDeprecationFailsClosedAndSequentialPublicationRecovers() public {
        Env memory e = _deploy();

        e.registry.deprecateService(INTEROP_SERVICE_ID);
        (bool staleOk,) =
            address(e.registry).call(abi.encodeWithSelector(e.registry.resolveActive.selector, INTEROP_SERVICE_ID));
        require(!staleOk, "deprecated service resolved");

        e.registry.publishRegisteredService(
            INTEROP_SERVICE_ID,
            address(e.router),
            METADATA_HASH,
            2,
            true,
            ProtocolRegistry.ComponentType.SERVICE,
            MANIFEST_HASH,
            e.dependencyRoot,
            INTERFACE_HASH
        );

        (address resolved, uint32 version) = e.registry.resolveActive(INTEROP_SERVICE_ID);
        require(resolved == address(e.router), "recovery implementation");
        require(version == 2, "recovery version");
    }
}
