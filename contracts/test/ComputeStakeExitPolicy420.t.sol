// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeStakeExitPolicy420.sol";

interface VmComputeStakeExitPolicy420 {
    function prank(address caller) external;
}

contract ComputeStakeExitPolicy420Test {
    VmComputeStakeExitPolicy420 private constant vm =
        VmComputeStakeExitPolicy420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant OUTSIDER = address(0xBAD);
    bytes32 private constant POLICY = keccak256("cmp/stake/exit-policy");

    ComputeStakeExitPolicy420 private policies;

    function setUp() public {
        policies = new ComputeStakeExitPolicy420(GOV);
    }

    function testOnlyGovernanceCanPublishNonzeroDelay() public {
        vm.prank(OUTSIDER);
        (bool ok,) = address(policies).call(
            abi.encodeCall(policies.publish, (POLICY, uint64(7 days)))
        );
        require(!ok, "outsider published");

        vm.prank(GOV);
        (ok,) = address(policies).call(
            abi.encodeCall(policies.publish, (POLICY, uint64(0)))
        );
        require(!ok, "zero delay accepted");

        vm.prank(GOV);
        uint32 revision = policies.publish(POLICY, 7 days);
        require(revision == 1, "revision");
    }

    function testRevisionsAreAppendOnlyAndCommitmentBound() public {
        vm.prank(GOV);
        uint32 r1 = policies.publish(POLICY, 7 days);
        bytes32 c1 = policies.commitment(POLICY, r1);

        vm.prank(GOV);
        uint32 r2 = policies.publish(POLICY, 2 days);
        bytes32 c2 = policies.commitment(POLICY, r2);

        require(r1 == 1 && r2 == 2, "revision sequence");
        require(c1 != c2, "commitment collision");
        require(policies.policy(POLICY, r1).withdrawalDelaySeconds == 7 days, "r1 rewritten");
        require(policies.policy(POLICY, r2).withdrawalDelaySeconds == 2 days, "r2 wrong");
        require(policies.commitment(POLICY, r1) == c1, "historical commitment changed");
    }

    function testCurrentPolicyReturnsExactRevisionAndCommitment() public {
        vm.prank(GOV);
        policies.publish(POLICY, 7 days);
        vm.prank(GOV);
        uint32 revision = policies.publish(POLICY, 3 days);

        (ComputeStakeExitPolicy420.Policy memory p, bytes32 exactCommitment) =
            policies.currentPolicy(POLICY);
        require(p.revision == revision && p.withdrawalDelaySeconds == 3 days, "current policy");
        require(exactCommitment == policies.commitment(POLICY, revision), "commitment");
    }
}
