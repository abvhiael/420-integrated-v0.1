// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeIdentityGuard420.sol";

interface VmComputeGuard420 {
    function prank(address) external;
    function warp(uint256) external;
}

contract ComputeIdentityGuard420Test {
    VmComputeGuard420 private constant vm = VmComputeGuard420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant GOV = address(0x420);
    address private constant OP = address(0xA11CE);
    address private constant BENEFICIARY = address(0xB0B);
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
    ComputeIdentitySnapshot420 private resolver;
    ComputeIdentityGuard420 private guard;
    bytes32 private providerId;
    bytes32 private nodeId;
    bytes32 private resourceId;

    function setUp() public {
        p = new ComputeProviderRegistry420(GOV);
        n = new ComputeNodeRegistry420(address(p), GOV);
        r = new ComputeResourceRegistry420(address(n), GOV);
        resolver = new ComputeIdentitySnapshot420(address(r));
        guard = new ComputeIdentityGuard420(address(resolver));
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

    function _expected() private view returns (ComputeIdentityGuard420.Expected memory e) {
        ComputeIdentitySnapshot420.Snapshot memory s = resolver.snapshot(resourceId, GPU, 1);
        e = ComputeIdentityGuard420.Expected(s.providerRevision, s.nodeRevision, s.resourceRevision, guard.commitment(s));
    }

    function _reject(ComputeIdentityGuard420.Expected memory e, bytes4 selector) private view {
        (bool ok, bytes memory failure) = address(guard).staticcall(
            abi.encodeCall(guard.requireCurrent, (resourceId, GPU, uint256(1), e))
        );
        require(!ok && failure.length >= 4 && bytes4(failure) == selector, "incorrect or missing denial");
    }

    function testCurrentSnapshotReturnsCanonicalParentsAndUnchangedCommitment() public view {
        ComputeIdentityGuard420.Expected memory e = _expected();
        ComputeIdentitySnapshot420.Snapshot memory s = guard.requireCurrent(resourceId, GPU, 1, e);
        require(s.providerId == providerId && s.nodeId == nodeId && s.resourceId == resourceId, "wrong parentage");
        require(s.settlementAccount == OP && guard.commitment(s) == e.snapshotCommitment, "wrong snapshot digest");
        require(guard.commitment(s) != keccak256(abi.encodePacked(s.providerId, s.nodeId, s.resourceId)), "weak digest");
    }

    function testRejectInvalidExpectationAndWrongDomain() public view {
        ComputeIdentityGuard420.Expected memory e = _expected();
        e.snapshotCommitment = bytes32(0);
        _reject(e, ComputeIdentityGuard420.InvalidExpectation.selector);
        e = _expected();
        e.snapshotCommitment = keccak256("another contract or chain");
        _reject(e, ComputeIdentityGuard420.StaleIdentitySnapshot.selector);
        e = _expected();
        e.nodeRevision = 0;
        _reject(e, ComputeIdentityGuard420.InvalidExpectation.selector);
    }

    function testProviderBeneficiaryRevisionInvalidatesObservedSnapshot() public {
        ComputeIdentityGuard420.Expected memory e = _expected();
        vm.prank(OP);
        p.update(providerId, MANIFEST, SECURITY, BENEFICIARY);
        _reject(e, ComputeIdentitySnapshot420.IneligibleIdentity.selector);
        vm.prank(GOV);
        p.activate(providerId);
        _reject(e, ComputeIdentityGuard420.StaleIdentitySnapshot.selector);
        ComputeIdentitySnapshot420.Snapshot memory s = guard.requireCurrent(resourceId, GPU, 1, _expected());
        require(s.settlementAccount == BENEFICIARY, "beneficiary revision not bound");
        require(p.revision(providerId, 2).settlementAccount == OP, "historical record changed");
    }

    function testEndpointResourceAndAncestorStatusChangesFailClosed() public {
        ComputeIdentityGuard420.Expected memory e = _expected();
        vm.prank(OP);
        n.updateEndpoint(nodeId, MANIFEST, keccak256("new endpoint"), uint64(block.timestamp + 100));
        _reject(e, ComputeIdentitySnapshot420.IneligibleIdentity.selector);
        vm.prank(OP);
        n.activate(nodeId);
        _reject(e, ComputeIdentityGuard420.StaleIdentitySnapshot.selector);
        e = _expected();
        vm.prank(OP);
        r.update(resourceId, HARDWARE, RUNTIME, CAPABILITY, 4);
        _reject(e, ComputeIdentitySnapshot420.IneligibleIdentity.selector);
        vm.prank(OP);
        r.activate(resourceId);
        _reject(e, ComputeIdentityGuard420.StaleIdentitySnapshot.selector);
        e = _expected();
        vm.warp(block.timestamp + 101);
        _reject(e, ComputeIdentitySnapshot420.IneligibleIdentity.selector);
    }
}
