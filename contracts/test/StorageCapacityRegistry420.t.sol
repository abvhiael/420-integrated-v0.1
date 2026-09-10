// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/resource/ResourceAuthorization420.sol";
import "../src/resource/ResourceIds420.sol";
import "../src/resource/ResourceNodeRegistry420.sol";
import "../src/resource/ResourceProviderRegistry420.sol";
import "../src/resource/StorageCapacityRegistry420.sol";

interface VmStorageCapacity420 { function prank(address) external; function warp(uint256) external; }

contract MockStorageCapacityCaps420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) internal ok;
    function key(address p, bytes32 c, bytes32 a, bytes32 s) public pure returns (bytes32) { return keccak256(abi.encode(p,c,a,s)); }
    function set(address p, bytes32 c, bytes32 a, bytes32 s, bool v) external { ok[key(p,c,a,s)] = v; }
    function grant(bytes32) external pure returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address p, bytes32 c, bytes32 a, bytes32 s, uint256) external view returns (bool) { return ok[key(p,c,a,s)]; }
}

contract StorageCapacityRegistry420Test {
    VmStorageCapacity420 constant vm = VmStorageCapacity420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);

    struct Env {
        MockStorageCapacityCaps420 caps;
        ResourceAuthorization420 auth;
        ResourceProviderRegistry420 providers;
        ResourceNodeRegistry420 nodes;
        StorageCapacityRegistry420 capacity;
        bytes32 providerId;
        bytes32 nodeId;
    }

    function setup() internal returns (Env memory e) {
        e.caps = new MockStorageCapacityCaps420();
        e.auth = new ResourceAuthorization420(address(e.caps));
        e.providers = new ResourceProviderRegistry420(address(e.auth));
        e.nodes = new ResourceNodeRegistry420(address(e.auth), address(e.providers));
        e.capacity = new StorageCapacityRegistry420(address(e.auth), address(e.nodes), address(e.providers));
        e.providerId = keccak256("capacity-provider");
        e.nodeId = keccak256("capacity-store-node");

        vm.prank(ALICE); e.providers.registerProvider(e.providerId, ALICE, keccak256("provider-meta"), keccak256("stake"));
        vm.prank(ALICE); e.providers.setState(e.providerId, ResourceProviderRegistry420.State.ACTIVE);
        vm.prank(ALICE); e.nodes.registerNode(e.nodeId, e.providerId, ResourceIds420.SERVICE_STORE, ALICE, keccak256("endpoint"), keccak256("capacity-hash"));
        vm.prank(ALICE); e.nodes.setState(e.nodeId, ResourceNodeRegistry420.State.ACTIVE);
    }

    function testProviderConfiguresCapacityAndAvailability() public {
        Env memory e = setup();
        vm.prank(ALICE); e.capacity.configureCapacity(e.nodeId, 10_000, keccak256("capacity-meta"));
        StorageCapacityRegistry420.Capacity memory c = e.capacity.getCapacity(e.nodeId);
        require(c.totalBytes == 10_000 && c.reservedBytes == 0, "capacity mismatch");
        require(c.revision == 1 && c.exists, "capacity state");
        require(e.capacity.availableBytes(e.nodeId) == 10_000, "available mismatch");
    }

    function testUnrelatedActorCannotConfigureOrReserve() public {
        Env memory e = setup();
        vm.prank(BOB);
        (bool configured,) = address(e.capacity).call(abi.encodeWithSelector(e.capacity.configureCapacity.selector, e.nodeId, uint128(10_000), keccak256("meta")));
        require(!configured, "unauthorized capacity configuration");

        vm.prank(ALICE); e.capacity.configureCapacity(e.nodeId, 10_000, keccak256("meta"));
        vm.prank(BOB);
        (bool reserved,) = address(e.capacity).call(abi.encodeWithSelector(e.capacity.reserveCapacity.selector, e.nodeId, keccak256("agreement"), uint128(1_000), uint64(block.timestamp + 1 days)));
        require(!reserved, "unauthorized reservation");
    }

    function testReservationsPreventOverselling() public {
        Env memory e = setup();
        vm.prank(ALICE); e.capacity.configureCapacity(e.nodeId, 10_000, keccak256("meta"));

        vm.prank(ALICE);
        bytes32 first = e.capacity.reserveCapacity(e.nodeId, keccak256("agreement-1"), 7_000, uint64(block.timestamp + 1 days));
        require(e.capacity.availableBytes(e.nodeId) == 3_000, "reservation not accounted");
        require(e.capacity.isReservationActive(first), "reservation inactive");

        vm.prank(ALICE);
        (bool oversold,) = address(e.capacity).call(abi.encodeWithSelector(e.capacity.reserveCapacity.selector, e.nodeId, keccak256("agreement-2"), uint128(3_001), uint64(block.timestamp + 1 days)));
        require(!oversold, "oversold capacity");

        vm.prank(ALICE);
        bytes32 second = e.capacity.reserveCapacity(e.nodeId, keccak256("agreement-2"), 3_000, uint64(block.timestamp + 1 days));
        require(second != first, "reservation collision");
        require(e.capacity.availableBytes(e.nodeId) == 0, "capacity should be full");
    }

    function testCapacityCannotShrinkBelowReservations() public {
        Env memory e = setup();
        vm.prank(ALICE); e.capacity.configureCapacity(e.nodeId, 10_000, keccak256("meta"));
        vm.prank(ALICE); e.capacity.reserveCapacity(e.nodeId, keccak256("agreement"), 6_000, uint64(block.timestamp + 1 days));

        vm.prank(ALICE);
        (bool shrunk,) = address(e.capacity).call(abi.encodeWithSelector(e.capacity.configureCapacity.selector, e.nodeId, uint128(5_999), keccak256("smaller")));
        require(!shrunk, "capacity shrank below reservations");

        vm.prank(ALICE); e.capacity.configureCapacity(e.nodeId, 6_000, keccak256("exact"));
        require(e.capacity.availableBytes(e.nodeId) == 0, "exact shrink incorrect");
    }

    function testReservationCannotReleaseBeforeStorageTerm() public {
        Env memory e = setup();
        vm.prank(ALICE); e.capacity.configureCapacity(e.nodeId, 10_000, keccak256("meta"));
        uint64 releaseAfter = uint64(block.timestamp + 1 days);
        vm.prank(ALICE);
        bytes32 reservationId = e.capacity.reserveCapacity(e.nodeId, keccak256("agreement"), 4_000, releaseAfter);

        (bool early,) = address(e.capacity).call(abi.encodeWithSelector(e.capacity.releaseCapacity.selector, reservationId));
        require(!early, "capacity released early");
        require(e.capacity.availableBytes(e.nodeId) == 6_000, "early release changed accounting");

        vm.warp(releaseAfter);
        e.capacity.releaseCapacity(reservationId);
        require(e.capacity.availableBytes(e.nodeId) == 10_000, "capacity not restored");
        require(!e.capacity.isReservationActive(reservationId), "reservation still active");
    }

    function testReservationIdIsCanonicalAndReplaySafe() public {
        Env memory e = setup();
        vm.prank(ALICE); e.capacity.configureCapacity(e.nodeId, 10_000, keccak256("meta"));
        bytes32 agreementId = keccak256("agreement");
        vm.prank(ALICE);
        bytes32 reservationId = e.capacity.reserveCapacity(e.nodeId, agreementId, 1_000, uint64(block.timestamp + 1 days));
        require(reservationId == e.capacity.canonicalReservationId(e.nodeId, agreementId), "noncanonical reservation");

        vm.prank(ALICE);
        (bool replay,) = address(e.capacity).call(abi.encodeWithSelector(e.capacity.reserveCapacity.selector, e.nodeId, agreementId, uint128(1_000), uint64(block.timestamp + 1 days)));
        require(!replay, "duplicate reservation accepted");
    }
}
