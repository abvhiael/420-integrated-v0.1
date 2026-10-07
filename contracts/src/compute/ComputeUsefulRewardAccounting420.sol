// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeUsefulRewardPolicy420.sol";

interface IComputeUsefulRewardPoolAccounting420 {
    struct Pool {
        bytes32 poolId;
        bytes32 projectId;
        uint64 projectRevision;
        bytes32 projectCommitment;
        bytes32 researchDomain;
        bytes32 policyId;
        uint32 policyRevision;
        bytes32 policyCommitment;
        uint8 metricKind;
        bytes32 metricId;
        address owner;
        uint64 createdAt;
        bool acceptingContributions;
        bool exists;
    }

    function pool(bytes32 poolId) external view returns (Pool memory p);
    function fundedAmount(bytes32 poolId) external view returns (uint256);
    function eligibleContribution(bytes32 poolId, bytes32 contributionId)
        external
        view
        returns (bool);
}

interface IComputeUsefulContributionReward420 {
    struct ContributionRecord {
        bytes32 contributionId;
        bytes32 contributionRef;
        bytes32 gateId;
        bytes32 jobId;
        address contributor;
        bytes32 projectRef;
        bytes32 policyId;
        uint32 policyRevision;
        bytes32 policyCommitment;
        uint8 metricKind;
        bytes32 metricId;
        uint256 amount;
        uint64 observedAt;
        bytes32 evidenceCommitment;
        uint64 recordedAt;
        bool exists;
    }

    function contribution(bytes32 contributionId)
        external
        view
        returns (ContributionRecord memory r);
}

/// @notice CMP-6.7 transparent useful-compute reward accounting.
/// @dev Converts one already-verified CMP-6.3 contribution into a deterministic native-$420
///      accounting amount under an append-only policy, capped by observable CMP-6.1 pool funding.
///      It does not reserve, transfer, release, claim or otherwise move Vault value.
contract ComputeUsefulRewardAccounting420 is I420System {
    bytes32 public constant REWARD_DOMAIN =
        keccak256("420Integrated.ComputeMarket.UsefulRewardAccounting.v1");

    struct RewardRecord {
        bytes32 rewardId;
        bytes32 contributionId;
        bytes32 poolId;
        address beneficiary;
        bytes32 projectRef;
        bytes32 metricId;
        uint256 contributionAmount;
        bytes32 rewardPolicyId;
        uint32 rewardPolicyRevision;
        bytes32 rewardPolicyCommitment;
        uint256 numerator;
        uint256 denominator;
        uint256 amount;
        uint256 poolFundingSnapshot;
        uint64 creditedAt;
        bool exists;
    }

    ComputeUsefulRewardPolicy420 public immutable policies;
    IComputeUsefulRewardPoolAccounting420 public immutable pools;
    IComputeUsefulContributionReward420 public immutable contributions;

    mapping(bytes32 => RewardRecord) private _rewards;
    mapping(bytes32 => bool) public contributionRewardConsumed;
    mapping(bytes32 => uint256) public creditedByPool;
    mapping(address => uint256) public creditedByBeneficiary;
    mapping(bytes32 => uint256) public creditedByMetric;

    error InvalidConfiguration();
    error InvalidReward();
    error Replay();

    event UsefulRewardAccounted(
        bytes32 indexed rewardId,
        bytes32 indexed contributionId,
        bytes32 indexed poolId,
        address beneficiary,
        bytes32 metricId,
        uint256 contributionAmount,
        uint256 amount,
        bytes32 rewardPolicyId,
        uint32 rewardPolicyRevision,
        uint256 poolFundingSnapshot
    );

    constructor(address policies_, address pools_, address contributions_) {
        if (
            policies_.code.length == 0
                || pools_.code.length == 0
                || contributions_.code.length == 0
        ) revert InvalidConfiguration();

        policies = ComputeUsefulRewardPolicy420(policies_);
        pools = IComputeUsefulRewardPoolAccounting420(pools_);
        contributions = IComputeUsefulContributionReward420(contributions_);
    }

    function systemName() external pure returns (string memory) {
        return "ComputeUsefulRewardAccounting420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    /// @notice Record one deterministic reward-accounting entry for one CMP-6.3 contribution.
    /// @dev Permissionless relay. Beneficiary, metric and contribution amount come only from
    ///      canonical contribution accounting; reward arithmetic comes only from frozen policy.
    function accountReward(
        bytes32 rewardPolicyId,
        uint32 rewardPolicyRevision,
        bytes32 contributionId
    ) external returns (bytes32 rewardId) {
        if (
            rewardPolicyId == bytes32(0)
                || rewardPolicyRevision == 0
                || contributionId == bytes32(0)
        ) revert InvalidReward();
        if (contributionRewardConsumed[contributionId]) revert Replay();

        ComputeUsefulRewardPolicy420.Policy memory p =
            policies.policy(rewardPolicyId, rewardPolicyRevision);
        if (
            p.policyId != rewardPolicyId
                || p.poolId == bytes32(0)
                || p.metricId == bytes32(0)
                || p.numerator == 0
                || p.denominator == 0
                || p.perContributionCap == 0
        ) revert InvalidReward();

        if (!pools.eligibleContribution(p.poolId, contributionId)) {
            revert InvalidReward();
        }

        IComputeUsefulRewardPoolAccounting420.Pool memory poolRecord =
            pools.pool(p.poolId);
        IComputeUsefulContributionReward420.ContributionRecord memory c =
            contributions.contribution(contributionId);

        if (
            !poolRecord.exists
                || !c.exists
                || c.contributor == address(0)
                || c.projectRef != poolRecord.projectId
                || c.metricId != p.metricId
                || c.metricId != poolRecord.metricId
                || c.amount == 0
        ) revert InvalidReward();

        if (c.amount > type(uint256).max / p.numerator) revert InvalidReward();
        uint256 amount = c.amount * p.numerator / p.denominator;
        if (amount == 0) revert InvalidReward();
        if (amount > p.perContributionCap) amount = p.perContributionCap;

        uint256 fundingSnapshot = pools.fundedAmount(p.poolId);
        uint256 alreadyCredited = creditedByPool[p.poolId];
        if (
            fundingSnapshot == 0
                || alreadyCredited > fundingSnapshot
                || amount > fundingSnapshot - alreadyCredited
        ) revert InvalidReward();

        bytes32 policyCommitment =
            policies.commitment(rewardPolicyId, rewardPolicyRevision);

        rewardId = keccak256(
            abi.encode(
                REWARD_DOMAIN,
                block.chainid,
                address(this),
                contributionId,
                p.poolId,
                c.contributor,
                c.projectRef,
                c.metricId,
                c.amount,
                rewardPolicyId,
                rewardPolicyRevision,
                policyCommitment,
                p.numerator,
                p.denominator,
                amount,
                fundingSnapshot
            )
        );
        if (_rewards[rewardId].exists) revert Replay();

        contributionRewardConsumed[contributionId] = true;
        creditedByPool[p.poolId] = alreadyCredited + amount;
        creditedByBeneficiary[c.contributor] += amount;
        creditedByMetric[c.metricId] += amount;

        _rewards[rewardId] = RewardRecord({
            rewardId: rewardId,
            contributionId: contributionId,
            poolId: p.poolId,
            beneficiary: c.contributor,
            projectRef: c.projectRef,
            metricId: c.metricId,
            contributionAmount: c.amount,
            rewardPolicyId: rewardPolicyId,
            rewardPolicyRevision: rewardPolicyRevision,
            rewardPolicyCommitment: policyCommitment,
            numerator: p.numerator,
            denominator: p.denominator,
            amount: amount,
            poolFundingSnapshot: fundingSnapshot,
            creditedAt: uint64(block.timestamp),
            exists: true
        });

        emit UsefulRewardAccounted(
            rewardId,
            contributionId,
            p.poolId,
            c.contributor,
            c.metricId,
            c.amount,
            amount,
            rewardPolicyId,
            rewardPolicyRevision,
            fundingSnapshot
        );
    }

    function remainingAccountableFunding(bytes32 poolId) external view returns (uint256) {
        uint256 funded = pools.fundedAmount(poolId);
        uint256 credited = creditedByPool[poolId];
        return funded > credited ? funded - credited : 0;
    }

    function rewardRecord(bytes32 rewardId)
        external
        view
        returns (RewardRecord memory r)
    {
        r = _rewards[rewardId];
        if (!r.exists) revert InvalidReward();
    }
}
