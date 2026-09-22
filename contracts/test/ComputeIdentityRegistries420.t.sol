// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeResourceRegistry420.sol";

interface VmComputeIdentity420 {
    function prank(address) external;
    function warp(uint256) external;
}

contract ComputeIdentityRegistries420Test {
    VmComputeIdentity420 private constant vm = VmComputeIdentity420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant GOV = address(0x420);
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    ComputeProviderRegistry420 private p;
    ComputeNodeRegistry420 private n;
    ComputeResourceRegistry420 private r;
    bytes32 private constant HASH_A = keccak256("manifest/a");
    bytes32 private constant HASH_B = keccak256("manifest/b");
    bytes32 private constant CLASS_CPU = keccak256("CPU_GENERAL");
    bytes32 private constant CLASS_GPU_INFERENCE = keccak256("GPU_INFERENCE");

    function setUp() public {
        p = new ComputeProviderRegistry420(GOV);
        n = new ComputeNodeRegistry420(address(p), GOV);
        r = new ComputeResourceRegistry420(address(n), GOV);
    }
    function _provider(address actor) private returns (bytes32 id) {
        vm.prank(actor);
        id = p.register(HASH_A, HASH_B, actor);
        vm.prank(GOV);
        p.activate(id);
    }
    function _node(address actor, bytes32 providerId) private returns (bytes32 id) {
        vm.prank(actor);
        id = n.register(providerId, HASH_A, HASH_B, uint64(block.timestamp + 100));
        vm.prank(actor);
        n.activate(id);
    }
    function _resource(address actor, bytes32 nodeId) private returns (bytes32 id) {
        vm.prank(actor);
        id = r.register(nodeId, CLASS_GPU_INFERENCE, HASH_A, HASH_B, HASH_A, 8);
        vm.prank(actor);
        r.activate(id);
    }
    function testCanonicalIdsParentageAndIndependentRegistries() public {
        bytes32 providerId = _provider(ALICE);
        bytes32 nodeId = _node(ALICE, providerId);
        bytes32 resourceId = _resource(ALICE, nodeId);
        require(providerId == p.deriveId(1), "provider ID mismatch");
        require(nodeId == n.deriveId(1, providerId), "node ID mismatch");
        require(resourceId == r.deriveId(1, providerId, nodeId), "resource ID mismatch");
        require(providerId != nodeId && nodeId != resourceId && providerId != resourceId, "identity collision");
        require(n.node(nodeId).providerId == providerId, "node parent");
        require(r.resource(resourceId).nodeId == nodeId && r.resource(resourceId).providerId == providerId, "resource ancestors");
        require(r.isAvailable(resourceId), "eligible resource missing");
    }
    function testCrossProviderAndUnauthorizedActionsFailClosed() public {
        bytes32 alice = _provider(ALICE);
        bytes32 bob = _provider(BOB);
        bytes32 nodeId = _node(ALICE, alice);
        vm.prank(BOB);
        (bool ok,) = address(n).call(abi.encodeCall(n.register, (alice, HASH_A, HASH_B, uint64(block.timestamp + 100))));
        require(!ok, "foreign provider registered node");
        vm.prank(BOB);
        (ok,) = address(r).call(abi.encodeCall(r.register, (nodeId, CLASS_CPU, HASH_A, HASH_B, HASH_A, 3)));
        require(!ok, "foreign provider registered resource");
        require(n.node(nodeId).providerId == alice && p.isActive(bob), "canonical parent changed");
        require(n.nextSerial() == 1 && r.nextSerial() == 0, "failed registration consumed identity");
    }
    function testSuspensionExpiryRevisionAndTerminalRetirement() public {
        bytes32 providerId = _provider(ALICE);
        bytes32 nodeId = _node(ALICE, providerId);
        bytes32 resourceId = _resource(ALICE, nodeId);
        vm.prank(ALICE);
        p.update(providerId, HASH_B, HASH_A, BOB);
        require(!r.isAvailable(resourceId), "provider suspension ignored");
        require(p.revision(providerId, 2).settlementAccount == ALICE, "historical beneficiary rewritten");
        vm.prank(GOV);
        p.activate(providerId);
        require(r.isAvailable(resourceId), "reactivation failed");
        vm.warp(block.timestamp + 101);
        require(!n.isActive(nodeId) && !r.isAvailable(resourceId), "expired endpoint eligible");
        vm.prank(ALICE);
        n.updateEndpoint(nodeId, HASH_B, HASH_A, uint64(block.timestamp + 100));
        require(!n.isActive(nodeId), "unactivated endpoint became eligible");
        require(n.revision(nodeId, 2).endpointHash == HASH_B, "old endpoint overwritten");
        vm.prank(ALICE);
        n.activate(nodeId);
        require(r.isAvailable(resourceId), "endpoint update changed resource identity");
        vm.prank(ALICE);
        r.update(resourceId, HASH_B, HASH_A, HASH_B, 5);
        require(!r.isAvailable(resourceId), "resource revision bypassed admission pause");
        require(r.revision(resourceId, 2).capacityUnits == 8, "old capacity overwritten");
        vm.prank(ALICE);
        r.activate(resourceId);
        vm.prank(GOV);
        p.retire(providerId);
        require(!r.isAvailable(resourceId), "retired parent eligible");
        vm.prank(GOV);
        (bool ok,) = address(p).call(abi.encodeCall(p.activate, (providerId)));
        require(!ok, "retired provider revived");
    }
    function testInvalidClassCapacityAndIdentityFailClosed() public {
        bytes32 providerId = _provider(ALICE);
        bytes32 nodeId = _node(ALICE, providerId);
        vm.prank(ALICE);
        (bool ok,) = address(r).call(abi.encodeCall(r.register, (nodeId, bytes32(uint256(999)), HASH_A, HASH_B, HASH_A, 1)));
        require(!ok, "unknown compute class accepted");
        vm.prank(ALICE);
        (ok,) = address(r).call(abi.encodeCall(r.register, (nodeId, CLASS_CPU, HASH_A, HASH_B, HASH_A, 0)));
        require(!ok && r.nextSerial() == 0, "zero capacity accepted");
        (ok,) = address(n).staticcall(abi.encodeCall(n.deriveId, (uint64(0), providerId)));
        require(!ok, "zero node serial accepted");
        (ok,) = address(r).staticcall(abi.encodeCall(r.deriveId, (uint64(1), bytes32(0), nodeId)));
        require(!ok, "zero parent accepted");
    }
}
