// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeIdentityHistory420.sol";

interface VmComputeHistory420 {
    function prank(address) external;
    function warp(uint256) external;
}

contract ComputeIdentityHistory420Test {
    VmComputeHistory420 private constant vm = VmComputeHistory420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant GOV = address(0x420);
    address private constant OP = address(0xA11CE);
    address private constant OTHER = address(0xB0B);
    bytes32 private constant MANIFEST = keccak256("manifest");
    bytes32 private constant SECURITY = keccak256("security");
    bytes32 private constant ENDPOINT = keccak256("endpoint");
    bytes32 private constant HARDWARE = keccak256("hardware");
    bytes32 private constant RUNTIME = keccak256("runtime");
    bytes32 private constant CAPABILITY = keccak256("capability");
    bytes32 private constant GPU = keccak256("GPU_INFERENCE");
    ComputeProviderRegistry420 private p;
    ComputeNodeRegistry420 private n;
    ComputeResourceRegistry420 private r;
    ComputeIdentitySnapshot420 private snapshots;
    ComputeIdentityGuard420 private guard;
    ComputeIdentityHistory420 private history;
    bytes32 private providerId;
    bytes32 private nodeId;
    bytes32 private resourceId;

    function setUp() public {
        p = new ComputeProviderRegistry420(GOV);
        n = new ComputeNodeRegistry420(address(p), GOV);
        r = new ComputeResourceRegistry420(address(n), GOV);
        snapshots = new ComputeIdentitySnapshot420(address(r));
        guard = new ComputeIdentityGuard420(address(snapshots));
        history = new ComputeIdentityHistory420(address(guard));
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

    function _reject(ComputeIdentitySnapshot420.Snapshot memory s, bytes32 expected) private view {
        (bool ok,) = address(history).staticcall(abi.encodeCall(history.verifyHistorical, (s, expected)));
        require(!ok, "forged historical record accepted");
    }

    function testAuthenticRevisionRemainsReadableAfterRotationAndRetirement() public {
        ComputeIdentitySnapshot420.Snapshot memory first = snapshots.snapshot(resourceId, GPU, 1);
        bytes32 original = guard.commitment(first);
        require(history.verifyHistorical(first, original), "original identity absent");
        vm.prank(OP);
        p.update(providerId, MANIFEST, SECURITY, OTHER);
        vm.prank(GOV);
        p.activate(providerId);
        vm.prank(OP);
        n.updateEndpoint(nodeId, MANIFEST, keccak256("new endpoint"), uint64(block.timestamp + 200));
        vm.prank(OP);
        n.activate(nodeId);
        vm.prank(OP);
        r.update(resourceId, HARDWARE, RUNTIME, CAPABILITY, 4);
        vm.prank(OP);
        r.activate(resourceId);
        ComputeIdentitySnapshot420.Snapshot memory second = snapshots.snapshot(resourceId, GPU, 1);
        require(history.verifyHistorical(first, original), "rotation erased historical record");
        require(history.verifyHistorical(second, guard.commitment(second)), "latest record absent");
        require(first.settlementAccount == OP && second.settlementAccount == OTHER, "beneficiary revisions mixed");
        vm.prank(GOV);
        p.retire(providerId);
        require(history.verifyHistorical(first, original), "retirement erased history");
        (bool ok,) = address(snapshots).staticcall(abi.encodeCall(snapshots.snapshot, (resourceId, GPU, uint256(1))));
        require(!ok, "retired resource remained eligible");
    }

    function testRejectForgedBeneficiaryParentProfileAndRevisionEvenWithRecomputedDigest() public {
        ComputeIdentitySnapshot420.Snapshot memory s = snapshots.snapshot(resourceId, GPU, 1);
        s.settlementAccount = OTHER;
        _reject(s, guard.commitment(s));
        s = snapshots.snapshot(resourceId, GPU, 1);
        s.nodeId = bytes32(uint256(123));
        _reject(s, guard.commitment(s));
        s = snapshots.snapshot(resourceId, GPU, 1);
        s.hardwareProfileHash = keccak256("fake hardware");
        _reject(s, guard.commitment(s));
        s = snapshots.snapshot(resourceId, GPU, 1);
        s.resourceRevision = s.resourceRevision + 1;
        _reject(s, guard.commitment(s));
        s = snapshots.snapshot(resourceId, GPU, 1);
        _reject(s, bytes32(0));
        _reject(s, keccak256("wrong chain or registry"));
    }
}
