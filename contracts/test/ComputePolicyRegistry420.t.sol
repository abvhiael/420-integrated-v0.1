// SPDX-License-Identifier: GPL-3.0;
pragma solidity ^0.8.24;

import "../src/compute/ComputePolicyRegistry420.sol";

interface VmComputePolicy420 {
    function prank(address) external;
}

contract ComputePolicyRegistry420Test {
    VmComputePolicy420 private constant vm = VmComputePolicy420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant GOVERNANCE = address(0x420);
    bytes32 private constant POLICY_A = bytes32(uint256(101));
    bytes32 private constant POLICY_B = bytes32(uint256(102));
    bytes32 private constant TERMS_A = keccak256("price-ceiling/v1");
    bytes32 private constant TERMS_B = keccak256("price-ceiling/v2");
    bytes32 private constant SCHEMA = keccak256("compute-schema/v1");
    ComputePolicyRegistry420 private registry;

    function setUp() public { registry = new ComputePolicyRegistry420(GOVERNANCE); }

    function _publish(bytes32 id, bytes32 kind, bytes32 terms, uint64 duration, uint256 units, uint256 spend)
        private returns (uint32 revision) {
        vm.prank(GOVERNANCE);
        return registry.publish(id, kind, terms, SCHEMA, duration, units, spend);
    }

    function _selector(bytes memory payload) private pure returns (bytes4 result) {
        if (payload.length >= 4) assembly { result := mload(add(payload, 32)) }
    }

    function testDefaultDenyAndAuthorizedPublication() public {
        require(!registry.acceptingNew(POLICY_A), "unpublished policy active");
        require(!registry.isAcceptable(POLICY_A, 1, registry.KIND_PRICING(), TERMS_A, 1, 1, 1), "unknown policy accepted");
        (bool ok, bytes memory failure) = address(registry).call(abi.encodeCall(registry.publish,
            (POLICY_A, registry.KIND_PRICING(), TERMS_A, SCHEMA, 60, 5, 10)));
        require(!ok && _selector(failure) == SystemAccess.Unauthorized.selector, "non-governance publication");
        require(_publish(POLICY_A, registry.KIND_PRICING(), TERMS_A, 60, 5, 10) == 1, "initial revision");
        bytes32 digest = registry.commitment(POLICY_A, 1);
        require(registry.isAcceptable(POLICY_A, 1, registry.KIND_PRICING(), digest, 60, 5, 10), "valid policy rejected");
        require(!registry.isAcceptable(POLICY_A, 1, registry.KIND_VERIFICATION(), digest, 1, 1, 1), "cross-kind accepted");
        require(!registry.isAcceptable(POLICY_A, 1, registry.KIND_PRICING(), digest, 61, 5, 10), "duration overrun");
        require(!registry.isAcceptable(POLICY_A, 1, registry.KIND_PRICING(), digest, 60, 6, 10), "unit overrun");
        require(!registry.isAcceptable(POLICY_A, 1, registry.KIND_PRICING(), digest, 60, 5, 11), "spend overrun");
        require(!registry.isAcceptable(POLICY_A, 1, registry.KIND_PRICING(), digest, 0, 1, 1), "zero duration accepted");
        require(!registry.isAcceptable(POLICY_A, 1, registry.KIND_PRICING(), bytes32(uint256(7)), 1, 1, 1), "digest substitution");
    }

    function testImmutableRevisionAndNewAdmissionSuspension() public {
        _publish(POLICY_A, registry.KIND_PRICING(), TERMS_A, 60, 5, 10);
        bytes32 original = registry.commitment(POLICY_A, 1);
        _publish(POLICY_A, registry.KIND_PRICING(), TERMS_B, 30, 2, 4);
        require(registry.latestRevision(POLICY_A) == 2, "revision not advanced");
        require(registry.policy(POLICY_A, 1).termsHash == TERMS_A, "historical terms changed");
        require(registry.commitment(POLICY_A, 1) == original, "historical commitment changed");
        require(!registry.isAcceptable(POLICY_A, 1, registry.KIND_PRICING(), original, 1, 1, 1), "stale new acceptance");
        bytes32 next = registry.commitment(POLICY_A, 2);
        require(original != next, "revision digest identical");
        require(registry.isAcceptable(POLICY_A, 2, registry.KIND_PRICING(), next, 30, 2, 4), "new revision unavailable");
        vm.prank(GOVERNANCE);
        registry.setNewAcceptance(POLICY_A, false);
        require(!registry.isAcceptable(POLICY_A, 2, registry.KIND_PRICING(), next, 1, 1, 1), "paused admission accepted");
        require(registry.commitment(POLICY_A, 1) == original, "suspension mutated history");
        vm.prank(GOVERNANCE);
        registry.setNewAcceptance(POLICY_A, true);
        require(registry.isAcceptable(POLICY_A, 2, registry.KIND_PRICING(), next, 1, 1, 1), "resume failed");
    }

    function testUnknownPolicyInvalidBoundsKindAndCrossPolicy() public {
        (bool ok, bytes memory failure) = address(registry).staticcall(abi.encodeCall(registry.policy, (POLICY_A, uint32(1))));
        require(!ok && _selector(failure) == ComputePolicyRegistry420.UnknownPolicy.selector, "unknown revision readable");
        vm.prank(GOVERNANCE);
        (ok, failure) = address(registry).call(abi.encodeCall(registry.publish,
            (POLICY_A, bytes32(uint256(999)), TERMS_A, SCHEMA, 60, 5, 10)));
        require(!ok && _selector(failure) == ComputePolicyRegistry420.UnsupportedKind.selector, "unsupported policy kind");
        vm.prank(GOVERNANCE);
        (ok, failure) = address(registry).call(abi.encodeCall(registry.publish,
            (POLICY_A, registry.KIND_PRICING(), TERMS_A, SCHEMA, 0, 5, 10)));
        require(!ok && _selector(failure) == ComputePolicyRegistry420.InvalidPolicy.selector, "invalid bounds allowed");
        _publish(POLICY_A, registry.KIND_PRICING(), TERMS_A, 60, 5, 10);
        _publish(POLICY_B, registry.KIND_PRICING(), TERMS_A, 60, 5, 10);
        bytes32 first = registry.commitment(POLICY_A, 1);
        require(first != registry.commitment(POLICY_B, 1), "policy ID not bound");
        require(!registry.isAcceptable(POLICY_B, 1, registry.KIND_PRICING(), first, 1, 1, 1), "cross-policy replay");
        vm.prank(GOVERNANCE);
        (ok, failure) = address(registry).call(abi.encodeCall(registry.publish,
            (POLICY_A, registry.KIND_VERIFICATION(), TERMS_B, SCHEMA, 60, 5, 10)));
        require(!ok && _selector(failure) == ComputePolicyRegistry420.InvalidPolicy.selector, "kind rebinding");
    }
}
