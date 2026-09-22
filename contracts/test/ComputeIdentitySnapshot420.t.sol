// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeIdentitySnapshot420.sol";

interface VmComputeSnapshot420 {
    function prank(address) external;
    function warp(uint256) external;
}

contract ComputeIdentitySnapshot420Test {
    VmComputeSnapshot420 private constant vm = VmComputeSnapshot420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant GOV = address(0x420);
    address private constant OP = address(0xA11CE);
    address private constant NEW_BENEFICIARY = address(0xB0B);
    bytes32 private constant MANIFEST = keccak256("manifest");
    bytes32 private constant SECURITY = keccak256("security");
    bytes32 private constant ENDPOINT = keccak256("endpoint");
    bytes32 private constant HARDWARE = keccak256("hardware");
    bytes32 private constant RUNTIME = keccak256("runtime");
    bytes32 private constant CAPABILITY = keccak256("capability");
    bytes32 private constant GPU = keccak256("GPU_INFERENCE");
    bytes32 private constant CPU = keccak256("CPU_GENERAL");

    ComputeProviderRegistry420 private p;
    ComputeNodeRegistry420 private n;
    ComputeResourceRegistry420 private r;
    ComputeIdentitySnapshot420 private viewRegistry;
    bytes32 private providerId;
    bytes32 private nodeId;
    bytes32 private resourceId;

    function setUp() public {
        p = new ComputeProviderRegistry420(GOV);
        n = new ComputeNodeRegistry420(address(p), GOV);
        r = new ComputeResourceRegistry420(address(n), GOV);
        viewRegistry = new ComputeIdentitySnapshot420(address(r));
        vm.prank(OP);
        providerId = p.register(MANIFEST, SECURITY, OP);
        vm.prank(GOV);
        p.activate(providerId);
        vm.prank(OP);
        nodeId = n.register(providerId, MANIFEST, ENDPOINT, uint64(block.timestamp + 100));
        vm.prank(OP);
        n.activate(nodeId);
        vm.prank(OP);
        resourceId = r.register(nodeId, GPU, HARDWARE, RUNTIME, CAPABILITY, 8);
        vm.prank(OP);
        r.activate(resourceId);
    }

    function _reject(bytes32 id, bytes32 classId, uint256 units) private view {
        (bool ok, bytes memory failure) = address(viewRegistry).staticcall(
            abi.encodeCall(viewRegistry.snapshot, (id, classId, units))
        );
        require(!ok && failure.length >= 4, "invalid request unexpectedly accepted");
    }

    function testCanonicalSnapshotAndHistoricalBeneficiary() public {
        ComputeIdentitySnapshot420.Snapshot memory first = viewRegistry.snapshot(resourceId, GPU, 8);
        require(first.providerId == providerId && first.nodeId == nodeId && first.resourceId == resourceId,
            "incorrect canonical parentage");
        require(first.providerRevision == 2 && first.nodeRevision == 2 && first.resourceRevision == 2,
            "incorrect initial revisions");
        require(first.settlementAccount == OP && first.computeClass == GPU && first.advertisedCapacityUnits == 8,
            "incorrect snapshot fields");
        vm.prank(OP);
        p.update(providerId, MANIFEST, SECURITY, NEW_BENEFICIARY);
        _reject(resourceId, GPU, 1);
        require(first.settlementAccount == OP, "prior snapshot changed");
        require(p.revision(providerId, 2).settlementAccount == OP, "historical provider record changed");
        vm.prank(GOV);
        p.activate(providerId);
        ComputeIdentitySnapshot420.Snapshot memory next = viewRegistry.snapshot(resourceId, GPU, 1);
        require(next.providerRevision > first.providerRevision && next.settlementAccount == NEW_BENEFICIARY,
            "new revision not resolved");
    }

    function testClassBoundsExpiryAndAncestorSuspension() public {
        _reject(resourceId, CPU, 1);
        _reject(resourceId, GPU, 9);
        _reject(resourceId, GPU, 0);
        _reject(bytes32(0), GPU, 1);
        vm.prank(GOV);
        p.suspend(providerId);
        _reject(resourceId, GPU, 1);
        vm.prank(GOV);
        p.activate(providerId);
        vm.warp(block.timestamp + 101);
        _reject(resourceId, GPU, 1);
    }

    function testResourceRevisionAndRetirementDeny() public {
        vm.prank(OP);
        r.update(resourceId, HARDWARE, RUNTIME, CAPABILITY, 4);
        _reject(resourceId, GPU, 1);
        vm.prank(OP);
        r.activate(resourceId);
        ComputeIdentitySnapshot420.Snapshot memory current = viewRegistry.snapshot(resourceId, GPU, 4);
        require(current.resourceRevision == 4 && current.advertisedCapacityUnits == 4, "revision not bound");
        _reject(resourceId, GPU, 5);
        vm.prank(GOV);
        n.retire(nodeId);
        _reject(resourceId, GPU, 1);
    }
}
