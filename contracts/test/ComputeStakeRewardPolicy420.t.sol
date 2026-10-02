// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeStakeRewardPolicy420.sol";

interface VmComputeStakeRewardPolicy420 {
    function prank(address caller) external;
}

contract MockRewardPolicySource420 {}

contract ComputeStakeRewardPolicy420Test {
    VmComputeStakeRewardPolicy420 private constant vm =
        VmComputeStakeRewardPolicy420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant OUTSIDER = address(0xBAD);
    bytes32 private constant STAKE_POLICY = keccak256("cmp/stake/reward/policy");

    ComputeStakeRewardPolicy420 private policies;
    MockRewardPolicySource420 private sourceA;
    MockRewardPolicySource420 private sourceB;

    function setUp() public {
        policies = new ComputeStakeRewardPolicy420(GOV);
        sourceA = new MockRewardPolicySource420();
        sourceB = new MockRewardPolicySource420();
    }

    function testOnlyGovernanceCanPublishAndShapeIsBounded() public {
        (bool ok,) = address(policies).call(
            abi.encodeCall(
                policies.publish,
                (STAKE_POLICY, uint8(1), address(sourceA), 10 ether)
            )
        );
        require(!ok, "outsider published reward policy");

        vm.prank(GOV);
        uint32 revision =
            policies.publish(STAKE_POLICY, 1, address(sourceA), 10 ether);
        require(revision == 1, "wrong revision");

        vm.prank(GOV);
        (ok,) = address(policies).call(
            abi.encodeCall(
                policies.publish,
                (bytes32(0), uint8(1), address(sourceA), 10 ether)
            )
        );
        require(!ok, "zero stake policy accepted");

        vm.prank(GOV);
        (ok,) = address(policies).call(
            abi.encodeCall(
                policies.publish,
                (STAKE_POLICY, uint8(3), address(sourceA), 10 ether)
            )
        );
        require(!ok, "unknown subject kind accepted");

        vm.prank(GOV);
        (ok,) = address(policies).call(
            abi.encodeCall(
                policies.publish,
                (STAKE_POLICY, uint8(1), OUTSIDER, 10 ether)
            )
        );
        require(!ok, "EOA reward source accepted");

        vm.prank(GOV);
        (ok,) = address(policies).call(
            abi.encodeCall(
                policies.publish,
                (STAKE_POLICY, uint8(1), address(sourceA), 0)
            )
        );
        require(!ok, "zero reward cap accepted");
    }

    function testRevisionsAndCommitmentsAreAppendOnly() public {
        vm.prank(GOV);
        uint32 r1 =
            policies.publish(STAKE_POLICY, 1, address(sourceA), 10 ether);
        bytes32 c1 = policies.commitment(STAKE_POLICY, 1, r1);

        vm.prank(GOV);
        uint32 r2 =
            policies.publish(STAKE_POLICY, 1, address(sourceB), 20 ether);
        bytes32 c2 = policies.commitment(STAKE_POLICY, 1, r2);

        require(r1 == 1 && r2 == 2, "revision sequence");
        require(c1 != c2, "commitment did not change");

        ComputeStakeRewardPolicy420.Policy memory p1 =
            policies.policy(STAKE_POLICY, 1, r1);
        require(p1.rewardSource == address(sourceA), "old source rewritten");
        require(p1.maxRewardAmount == 10 ether, "old cap rewritten");

        (
            ComputeStakeRewardPolicy420.Policy memory current,
            bytes32 currentCommitment
        ) = policies.currentPolicy(STAKE_POLICY, 1);
        require(current.revision == r2, "current revision");
        require(current.rewardSource == address(sourceB), "current source");
        require(currentCommitment == c2, "current commitment");
    }

    function testWorkerAndVerifierPoliciesAreIndependent() public {
        vm.prank(GOV);
        policies.publish(STAKE_POLICY, 1, address(sourceA), 10 ether);
        vm.prank(GOV);
        policies.publish(STAKE_POLICY, 2, address(sourceB), 5 ether);

        ComputeStakeRewardPolicy420.Policy memory worker =
            policies.policy(STAKE_POLICY, 1, 1);
        ComputeStakeRewardPolicy420.Policy memory verifier =
            policies.policy(STAKE_POLICY, 2, 1);

        require(worker.rewardSource == address(sourceA), "worker source");
        require(verifier.rewardSource == address(sourceB), "verifier source");
        require(worker.maxRewardAmount == 10 ether, "worker cap");
        require(verifier.maxRewardAmount == 5 ether, "verifier cap");
    }
}
