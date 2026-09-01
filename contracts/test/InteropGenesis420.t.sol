// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/SystemAccess.sol";
import "../src/interop/InteropIds420.sol";
import "../src/interfaces/I420IS.sol";
import "../src/interop/InteropProviderRegistry420.sol";
import "../src/interop/InteropNamespaceRegistry420.sol";
import "../src/interop/InteropCheckpointRegistry420.sol";
import "../src/interop/InteropRouter420.sol";

interface VmInterop420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockInteropAdapter420 is I420ISAdapter {
    bytes32 public immutable kind;
    bytes32 public immutable manifest;
    mapping(bytes32 => bool) public supported;
    constructor(bytes32 kind_, bytes32 manifest_) { kind = kind_; manifest = manifest_; }
    function standardVersion() external pure override returns (uint32) { return 1; }
    function adapterType() external view override returns (bytes32) { return kind; }
    function supportsDomain(bytes32 domainId) external view override returns (bool) { return supported[domainId]; }
    function adapterManifestHash() external view override returns (bytes32) { return manifest; }
    function setSupported(bytes32 domainId, bool value) external { supported[domainId] = value; }
    function map(InteropNamespaceRegistry420 registry, bytes32 ns, bytes32 externalHash, bytes32 canonicalId, bytes32 attestation) external returns (bytes32) {
        return registry.publishMapping(ns, externalHash, canonicalId, attestation);
    }
    function supersede(InteropNamespaceRegistry420 registry, bytes32 ns, bytes32 externalHash, uint64 oldRevision, bytes32 canonicalId, bytes32 attestation) external returns (bytes32) {
        return registry.supersedeMapping(ns, externalHash, oldRevision, canonicalId, attestation);
    }
    function checkpoint(InteropCheckpointRegistry420 registry, bytes32 providerId, bytes32 domainId, uint64 sequence, bytes32 stateHash, bytes32 previousHash) external returns (bytes32) {
        return registry.publishCheckpoint(providerId, domainId, sequence, stateHash, previousHash);
    }
}

contract InteropGenesis420Test {
    VmInterop420 constant vm = VmInterop420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    bytes32 constant PROVIDER = keccak256("provider/one");
    bytes32 constant TYPE = keccak256("adapter/type");
    bytes32 constant MANIFEST = keccak256("adapter/manifest");
    bytes32 constant NS = keccak256("namespace/isrc");

    InteropProviderRegistry420 providers;
    InteropNamespaceRegistry420 namespaces;
    InteropCheckpointRegistry420 checkpoints;
    MockInteropAdapter420 adapter;

    function setUp() public {
        providers = new InteropProviderRegistry420(address(this));
        adapter = new MockInteropAdapter420(TYPE, MANIFEST);
        providers.registerProvider(PROVIDER, address(adapter), TYPE, MANIFEST);
        namespaces = new InteropNamespaceRegistry420(address(this), address(providers));
        namespaces.registerNamespace(NS, PROVIDER, keccak256("schema/isrc"));
        checkpoints = new InteropCheckpointRegistry420(address(providers));
    }

    function testProviderRegistrationIsGovernanceBoundAndVersioned() public {
        MockInteropAdapter420 second = new MockInteropAdapter420(TYPE, keccak256("second"));
        vm.prank(ALICE);
        vm.expectRevert(SystemAccess.Unauthorized.selector);
        providers.registerProvider(keccak256("other"), address(second), TYPE, keccak256("second"));
        InteropProviderRegistry420.Provider memory p = providers.provider(PROVIDER);
        require(p.active && p.standardVersion == 1 && p.revision == 1, "provider registered");
    }

    function testExternalMappingCannotBeSilentlyOverwritten() public {
        bytes32 externalHash = keccak256("US-ABC-26-00001");
        bytes32 canonicalId = keccak256("recording/1");
        bytes32 first = adapter.map(namespaces, NS, externalHash, canonicalId, keccak256("attestation/1"));
        vm.expectRevert(InteropNamespaceRegistry420.AlreadyExists.selector);
        adapter.map(namespaces, NS, externalHash, keccak256("recording/evil"), keccak256("attestation/evil"));
        bytes32 second = adapter.supersede(namespaces, NS, externalHash, 1, canonicalId, keccak256("attestation/2"));
        require(namespaces.externalMapping(first).status == InteropNamespaceRegistry420.MappingStatus.SUPERSEDED, "old superseded");
        require(namespaces.externalMapping(second).canonicalId == canonicalId, "canonical identity preserved");
    }

    function testUnregisteredCallerCannotPublishMapping() public {
        vm.prank(ALICE);
        vm.expectRevert(InteropNamespaceRegistry420.UnauthorizedAdapter.selector);
        namespaces.publishMapping(NS, keccak256("external"), keccak256("canonical"), keccak256("proof"));
    }

    function testCheckpointSequenceAndHashChainAreStrict() public {
        bytes32 domain = keccak256("domain/app-state");
        bytes32 first = adapter.checkpoint(checkpoints, PROVIDER, domain, 1, keccak256("state/1"), bytes32(0));
        vm.expectRevert(InteropCheckpointRegistry420.InvalidSequence.selector);
        adapter.checkpoint(checkpoints, PROVIDER, domain, 3, keccak256("state/3"), first);
        vm.expectRevert(InteropCheckpointRegistry420.InvalidPreviousCheckpoint.selector);
        adapter.checkpoint(checkpoints, PROVIDER, domain, 2, keccak256("state/2"), keccak256("wrong"));
        bytes32 second = adapter.checkpoint(checkpoints, PROVIDER, domain, 2, keccak256("state/2"), first);
        require(second != bytes32(0), "second checkpoint");
    }

    function testInactiveProviderFailsClosed() public {
        providers.setActive(PROVIDER, false);
        vm.expectRevert(InteropNamespaceRegistry420.UnauthorizedAdapter.selector);
        adapter.map(namespaces, NS, keccak256("external"), keccak256("canonical"), keccak256("proof"));
    }
}
