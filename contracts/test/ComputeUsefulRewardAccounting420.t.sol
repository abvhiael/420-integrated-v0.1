// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeUsefulRewardAccounting420.sol";

contract MockUsefulRewardPool420 is IComputeUsefulRewardPoolAccounting420 {
    mapping(bytes32 => Pool) private _pools;
    mapping(bytes32 => uint256) private _funded;
    mapping(bytes32 => mapping(bytes32 => bool)) private _eligible;

    function setPool(
        bytes32 poolId,
        bytes32 projectId,
        bytes32 metricId,
        bool accepting
    ) external {
        _pools[poolId] = Pool({
            poolId: poolId,
            projectId: projectId,
            projectRevision: 1,
            projectCommitment: keccak256(abi.encode("project", projectId)),
            researchDomain: keccak256("research"),
            policyId: keccak256("contribution-policy"),
            policyRevision: 1,
            policyCommitment: keccak256("contribution-policy-commitment"),
            metricKind: 4,
            metricId: metricId,
            owner: address(this),
            createdAt: uint64(block.timestamp),
            acceptingContributions: accepting,
            exists: true
        });
    }

    function setFunded(bytes32 poolId, uint256 amount) external {
        _funded[poolId] = amount;
    }

    function setEligible(bytes32 poolId, bytes32 contributionId, bool ok) external {
        _eligible[poolId][contributionId] = ok;
    }

    function pool(bytes32 poolId) external view returns (Pool memory p) {
        p = _pools[poolId];
        require(p.exists, "unknown pool");
    }

    function fundedAmount(bytes32 poolId) external view returns (uint256) {
        require(_pools[poolId].exists, "unknown pool");
        return _funded[poolId];
    }

    function eligibleContribution(bytes32 poolId, bytes32 contributionId)
        external
        view
        returns (bool)
    {
        return _eligible[poolId][contributionId];
    }
}

contract MockUsefulContributionReward420 is IComputeUsefulContributionReward420 {
    mapping(bytes32 => ContributionRecord) private _records;

    function setContribution(
        bytes32 contributionId,
        address contributor,
        bytes32 projectRef,
        bytes32 metricId,
        uint256 amount
    ) external {
        _records[contributionId] = ContributionRecord({
            contributionId: contributionId,
            contributionRef: keccak256(abi.encode("source", contributionId)),
            gateId: keccak256(abi.encode("gate", contributionId)),
            jobId: keccak256(abi.encode("job", contributionId)),
            contributor: contributor,
            projectRef: projectRef,
            policyId: keccak256("contribution-policy"),
            policyRevision: 1,
            policyCommitment: keccak256("contribution-policy-commitment"),
            metricKind: 4,
            metricId: metricId,
            amount: amount,
            observedAt: uint64(block.timestamp),
            evidenceCommitment: keccak256(abi.encode("evidence", contributionId)),
            recordedAt: uint64(block.timestamp),
            exists: true
        });
    }

    function contribution(bytes32 contributionId)
        external
        view
        returns (ContributionRecord memory r)
    {
        r = _records[contributionId];
        require(r.exists, "unknown contribution");
    }
}

contract ComputeUsefulRewardAccounting420Test {
    bytes32 private constant POOL = keccak256("cmp6/reward-pool");
    bytes32 private constant PROJECT = keccak256("cmp6/project");
    bytes32 private constant METRIC = keccak256("cmp6/metric/project-credit");
    bytes32 private constant POLICY = keccak256("cmp6/reward-policy");
    bytes32 private constant C1 = keccak256("cmp6/contribution/1");
    bytes32 private constant C2 = keccak256("cmp6/contribution/2");
    bytes32 private constant C3 = keccak256("cmp6/contribution/3");

    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);

    ComputeUsefulRewardPolicy420 private policies;
    MockUsefulRewardPool420 private pools;
    MockUsefulContributionReward420 private contributions;
    ComputeUsefulRewardAccounting420 private rewards;

    function setUp() public {
        policies = new ComputeUsefulRewardPolicy420(address(this));
        pools = new MockUsefulRewardPool420();
        contributions = new MockUsefulContributionReward420();
        rewards = new ComputeUsefulRewardAccounting420(
            address(policies),
            address(pools),
            address(contributions)
        );

        pools.setPool(POOL, PROJECT, METRIC, true);
        pools.setFunded(POOL, 100 ether);
        policies.publish(POLICY, POOL, METRIC, 2 ether, 100, 25 ether);
    }

    function _set(bytes32 id, address who, uint256 amount, bool eligible) private {
        contributions.setContribution(id, who, PROJECT, METRIC, amount);
        pools.setEligible(POOL, id, eligible);
    }

    function testTransparentRewardRecordFreezesAllArithmeticInputs() public {
        _set(C1, ALICE, 1_000, true);

        bytes32 rewardId = rewards.accountReward(POLICY, 1, C1);
        ComputeUsefulRewardAccounting420.RewardRecord memory r =
            rewards.rewardRecord(rewardId);

        require(r.contributionId == C1, "contribution drift");
        require(r.poolId == POOL, "pool drift");
        require(r.beneficiary == ALICE, "beneficiary drift");
        require(r.projectRef == PROJECT, "project drift");
        require(r.metricId == METRIC, "metric drift");
        require(r.contributionAmount == 1_000, "contribution amount drift");
        require(r.rewardPolicyId == POLICY, "policy drift");
        require(r.rewardPolicyRevision == 1, "policy revision drift");
        require(r.rewardPolicyCommitment == policies.commitment(POLICY, 1), "policy commitment drift");
        require(r.numerator == 2 ether, "numerator drift");
        require(r.denominator == 100, "denominator drift");
        require(r.amount == 20 ether, "reward arithmetic drift");
        require(r.poolFundingSnapshot == 100 ether, "funding snapshot drift");
    }

    function testPerContributionCapIsDeterministic() public {
        _set(C1, ALICE, 10_000, true);
        bytes32 rewardId = rewards.accountReward(POLICY, 1, C1);
        require(rewards.rewardRecord(rewardId).amount == 25 ether, "cap not applied");
    }

    function testAggregateCreditsAndRemainingFundingAreTransparent() public {
        _set(C1, ALICE, 500, true);
        _set(C2, BOB, 1_000, true);

        rewards.accountReward(POLICY, 1, C1);
        rewards.accountReward(POLICY, 1, C2);

        require(rewards.creditedByPool(POOL) == 30 ether, "pool aggregate drift");
        require(rewards.creditedByBeneficiary(ALICE) == 10 ether, "alice aggregate drift");
        require(rewards.creditedByBeneficiary(BOB) == 20 ether, "bob aggregate drift");
        require(rewards.creditedByMetric(METRIC) == 30 ether, "metric aggregate drift");
        require(rewards.remainingAccountableFunding(POOL) == 70 ether, "remaining funding drift");
    }

    function testPoolFundingBudgetCannotBeOvercredited() public {
        pools.setFunded(POOL, 30 ether);
        _set(C1, ALICE, 1_000, true);
        _set(C2, BOB, 1_000, true);

        rewards.accountReward(POLICY, 1, C1);
        (bool ok,) = address(rewards).call(
            abi.encodeCall(rewards.accountReward, (POLICY, uint32(1), C2))
        );
        require(!ok, "pool overcredit accepted");
        require(rewards.creditedByPool(POOL) == 20 ether, "failed credit mutated total");
    }

    function testContributionCanNeverBeRewardedTwiceAcrossPolicyRevisions() public {
        _set(C1, ALICE, 1_000, true);
        rewards.accountReward(POLICY, 1, C1);

        policies.publish(POLICY, POOL, METRIC, 3 ether, 100, 30 ether);

        (bool ok,) = address(rewards).call(
            abi.encodeCall(rewards.accountReward, (POLICY, uint32(2), C1))
        );
        require(!ok, "contribution double reward accepted");
    }

    function testIneligibleContributionFailsClosed() public {
        _set(C1, ALICE, 1_000, false);
        (bool ok,) = address(rewards).call(
            abi.encodeCall(rewards.accountReward, (POLICY, uint32(1), C1))
        );
        require(!ok, "ineligible contribution rewarded");
    }

    function testMetricMismatchFailsClosed() public {
        bytes32 otherMetric = keccak256("other-metric");
        contributions.setContribution(C1, ALICE, PROJECT, otherMetric, 1_000);
        pools.setEligible(POOL, C1, true);

        (bool ok,) = address(rewards).call(
            abi.encodeCall(rewards.accountReward, (POLICY, uint32(1), C1))
        );
        require(!ok, "wrong metric rewarded");
    }

    function testZeroAfterIntegerDivisionFailsClosed() public {
        bytes32 tinyPolicy = keccak256("tiny-policy");
        policies.publish(tinyPolicy, POOL, METRIC, 1, 1_000_000, 1 ether);
        _set(C1, ALICE, 1, true);

        (bool ok,) = address(rewards).call(
            abi.encodeCall(rewards.accountReward, (tinyPolicy, uint32(1), C1))
        );
        require(!ok, "zero-sized reward accounted");
    }

    function testOverflowingRewardArithmeticFailsClosed() public {
        bytes32 hugePolicy = keccak256("huge-policy");
        policies.publish(hugePolicy, POOL, METRIC, type(uint256).max, 1, 25 ether);
        _set(C1, ALICE, 2, true);

        (bool ok,) = address(rewards).call(
            abi.encodeCall(rewards.accountReward, (hugePolicy, uint32(1), C1))
        );
        require(!ok, "overflowing arithmetic accepted");
    }

    function testRewardPoliciesAreAppendOnlyAndHistoricCommitmentStable() public {
        bytes32 first = policies.commitment(POLICY, 1);
        uint32 revision = policies.publish(POLICY, POOL, METRIC, 1 ether, 100, 10 ether);

        require(revision == 2, "revision drift");
        require(policies.commitment(POLICY, 1) == first, "historic policy mutated");
        require(policies.commitment(POLICY, 2) != first, "new policy not distinct");
    }
}
