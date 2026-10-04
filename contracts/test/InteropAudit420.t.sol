// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/SystemAccess.sol";
import "../src/interfaces/I420IS.sol";
import "../src/interop/InteropProviderRegistry420.sol";
import "../src/interop/InteropNamespaceRegistry420.sol";
import "../src/interop/InteropCheckpointRegistry420.sol";
import "../src/interop/InteropRouter420.sol";

interface VmInteropAudit420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract InteropAuditAdapter420 is I420ISAdapter {
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

    function supersede(
        InteropNamespaceRegistry420 registry,
        bytes32 namespaceId,
        bytes32 externalIdHash,
        uint64 oldRevision,
        bytes32 canonicalId,
        bytes32 attestationHash
    ) external returns (bytes32) {
        return registry.supersedeMapping(namespaceId, externalIdHash, oldRevision, canonicalId, attestationHash);
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

contract InteropWrongVersionAdapter420 is I420ISAdapter {
    function standardVersion() external pure override returns (uint32) { return 2; }
    function adapterType() external pure override returns (bytes32) { return keccak256("wrong/type"); }
    function supportsDomain(bytes32) external pure override returns (bool) { return true; }
    function adapterManifestHash() external pure override returns (bytes32) { return keccak256("wrong/manifest"); }
}

contract InteropAudit420Test {
    VmInteropAudit420 constant vm =
        VmInteropAudit420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ALICE = address(0xA11CE);
    bytes32 constant PROVIDER = keccak256("provider/audit");
    bytes32 constant TYPE = keccak256("adapter/audit");
    bytes32 constant MANIFEST = keccak256("manifest/audit");
    bytes32 constant NS = keccak256("namespace/audit");
    bytes32 constant DOMAIN = keccak256("domain/audit");

    InteropProviderRegistry420 providers;
    InteropNamespaceRegistry420 namespaces;
    InteropCheckpointRegistry420 checkpoints;
    InteropRouter420 router;
    InteropAuditAdapter420 adapter;

    function setUp() public {
        providers = new InteropProviderRegistry420(address(this));
        adapter = new InteropAuditAdapter420(TYPE, MANIFEST);
        adapter.setSupported(DOMAIN, true);
        providers.registerProvider(PROVIDER, address(adapter), TYPE, MANIFEST);
        namespaces = new InteropNamespaceRegistry420(address(this), address(providers));
        namespaces.registerNamespace(NS, PROVIDER, keccak256("schema/audit"));
        checkpoints = new InteropCheckpointRegistry420(address(providers));
        router = new InteropRouter420(address(providers), address(namespaces), address(checkpoints));
    }

    function testProviderRegistrationRejectsWrongStandardVersion() public {
        InteropWrongVersionAdapter420 wrong = new InteropWrongVersionAdapter420();
        vm.expectRevert(InteropProviderRegistry420.VersionMismatch.selector);
        providers.registerProvider(
            keccak256("provider/wrong"),
            address(wrong),
            keccak256("wrong/type"),
            keccak256("wrong/manifest")
        );
    }

    function testProviderRevisionPreservesTypeAndAdvancesRevision() public {
        bytes32 secondManifest = keccak256("manifest/audit/v2");
        InteropAuditAdapter420 second = new InteropAuditAdapter420(TYPE, secondManifest);
        providers.reviseProvider(PROVIDER, address(second), secondManifest);

        InteropProviderRegistry420.Provider memory p = providers.provider(PROVIDER);
        require(p.adapter == address(second), "adapter revised");
        require(p.adapterType == TYPE, "type preserved");
        require(p.manifestHash == secondManifest, "manifest revised");
        require(p.revision == 2, "revision advanced");
        require(p.active, "provider remains active");
    }

    function testProviderRevisionRejectsTypeDrift() public {
        bytes32 secondManifest = keccak256("manifest/other");
        InteropAuditAdapter420 wrongType =
            new InteropAuditAdapter420(keccak256("adapter/other"), secondManifest);
        vm.expectRevert(InteropProviderRegistry420.InvalidProvider.selector);
        providers.reviseProvider(PROVIDER, address(wrongType), secondManifest);
    }

    function testNamespaceAdministrationIsGovernanceBound() public {
        vm.prank(ALICE);
        vm.expectRevert(SystemAccess.Unauthorized.selector);
        namespaces.setNamespaceActive(NS, false);
    }

    function testInactiveNamespaceBlocksMappingPublication() public {
        namespaces.setNamespaceActive(NS, false);
        vm.expectRevert(InteropNamespaceRegistry420.NamespaceInactive.selector);
        adapter.publish(
            namespaces,
            NS,
            keccak256("external/1"),
            keccak256("canonical/1"),
            keccak256("attestation/1")
        );
    }

    function testMappingRevocationIsExplicitAndTerminalForThatRevision() public {
        bytes32 key = adapter.publish(
            namespaces,
            NS,
            keccak256("external/2"),
            keccak256("canonical/2"),
            keccak256("attestation/2")
        );
        namespaces.revokeMapping(key);
        require(
            namespaces.externalMapping(key).status == InteropNamespaceRegistry420.MappingStatus.REVOKED,
            "revoked"
        );
        vm.expectRevert(InteropNamespaceRegistry420.NotFound.selector);
        namespaces.revokeMapping(key);
    }

    function testSupersessionChainPreservesHistory() public {
        bytes32 externalId = keccak256("external/3");
        bytes32 canonicalId = keccak256("canonical/3");
        bytes32 first = adapter.publish(
            namespaces, NS, externalId, canonicalId, keccak256("attestation/3/1")
        );
        bytes32 second = adapter.supersede(
            namespaces, NS, externalId, 1, canonicalId, keccak256("attestation/3/2")
        );
        bytes32 third = adapter.supersede(
            namespaces, NS, externalId, 2, canonicalId, keccak256("attestation/3/3")
        );

        require(
            namespaces.externalMapping(first).status == InteropNamespaceRegistry420.MappingStatus.SUPERSEDED,
            "first superseded"
        );
        require(
            namespaces.externalMapping(second).status == InteropNamespaceRegistry420.MappingStatus.SUPERSEDED,
            "second superseded"
        );
        InteropNamespaceRegistry420.ExternalMapping memory latest = namespaces.externalMapping(third);
        require(latest.status == InteropNamespaceRegistry420.MappingStatus.ACTIVE, "third active");
        require(latest.supersedesKey == second, "history linked");
        require(latest.revision == 3, "revision three");
    }

    function testProviderDeactivationFailsClosedAcrossWritesAndRouterReads() public {
        providers.setActive(PROVIDER, false);

        vm.expectRevert(InteropNamespaceRegistry420.UnauthorizedAdapter.selector);
        adapter.publish(
            namespaces,
            NS,
            keccak256("external/4"),
            keccak256("canonical/4"),
            keccak256("attestation/4")
        );

        vm.expectRevert(InteropCheckpointRegistry420.UnauthorizedAdapter.selector);
        adapter.checkpoint(
            checkpoints, PROVIDER, DOMAIN, 1, keccak256("state/4"), bytes32(0)
        );

        require(!router.providerSupports(PROVIDER, DOMAIN), "router fails closed");
    }

    function testCheckpointRejectsSequenceAndPreviousHashDrift() public {
        bytes32 first =
            adapter.checkpoint(checkpoints, PROVIDER, DOMAIN, 1, keccak256("state/5/1"), bytes32(0));

        vm.expectRevert(InteropCheckpointRegistry420.InvalidSequence.selector);
        adapter.checkpoint(checkpoints, PROVIDER, DOMAIN, 3, keccak256("state/5/3"), first);

        vm.expectRevert(InteropCheckpointRegistry420.InvalidPreviousCheckpoint.selector);
        adapter.checkpoint(
            checkpoints,
            PROVIDER,
            DOMAIN,
            2,
            keccak256("state/5/2"),
            keccak256("wrong/previous")
        );
    }

    function testRouterResolvesExactRevisionAndStandardVersion() public {
        bytes32 externalId = keccak256("external/6");
        bytes32 canonicalId = keccak256("canonical/6");
        bytes32 attestation = keccak256("attestation/6");
        adapter.publish(namespaces, NS, externalId, canonicalId, attestation);

        (
            bytes32 resolvedCanonical,
            bytes32 resolvedAttestation,
            InteropNamespaceRegistry420.MappingStatus status
        ) = router.resolve(NS, externalId, 1);

        require(router.standardVersion() == 1, "standard v1");
        require(resolvedCanonical == canonicalId, "canonical resolved");
        require(resolvedAttestation == attestation, "attestation resolved");
        require(status == InteropNamespaceRegistry420.MappingStatus.ACTIVE, "active revision");
        require(router.providerSupports(PROVIDER, DOMAIN), "domain support");
    }
}
