// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeResearchProjectRegistry420.sol";
import "./ComputeUsefulContributionPolicy420.sol";

interface IComputeUsefulRewardPoolFunding420 {
    function TARGET_POOL() external view returns (uint8);
    function fundedByTarget(bytes32 targetKey) external view returns (uint256);
}

interface IComputeUsefulContributionAccountingPool420 {
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

/// @notice CMP-6.4 research reward-pool registry bound to canonical research projects and metrics.
/// @dev Pools classify separately funded CMP-6.1 capital and compatible CMP-6.3 contributions.
///      They do not reserve, debit, match, calculate, obligate, release, claim or pay rewards.
contract ComputeResearchRewardPool420 is I420System {
    bytes32 public constant POOL_DOMAIN =
        keccak256("420Integrated.ComputeMarket.ResearchRewardPool.v1");

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

    ComputeResearchProjectRegistry420 public immutable projects;
    ComputeUsefulContributionPolicy420 public immutable policies;
    IComputeUsefulRewardPoolFunding420 public immutable funding;
    IComputeUsefulContributionAccountingPool420 public immutable accounting;
    uint8 public immutable poolTargetKind;

    mapping(bytes32 => Pool) private _pools;

    error InvalidConfiguration();
    error InvalidPool();
    error Unauthorized();

    event ResearchRewardPoolCreated(
        bytes32 indexed poolId,
        bytes32 indexed projectId,
        bytes32 indexed researchDomain,
        bytes32 policyId,
        uint32 policyRevision,
        bytes32 metricId,
        address owner
    );
    event ResearchRewardPoolAcceptanceSet(bytes32 indexed poolId, bool accepting);

    constructor(
        address projects_,
        address policies_,
        address funding_,
        address accounting_
    ) {
        if (
            projects_.code.length == 0
                || policies_.code.length == 0
                || funding_.code.length == 0
                || accounting_.code.length == 0
        ) revert InvalidConfiguration();

        projects = ComputeResearchProjectRegistry420(projects_);
        policies = ComputeUsefulContributionPolicy420(policies_);
        funding = IComputeUsefulRewardPoolFunding420(funding_);
        accounting = IComputeUsefulContributionAccountingPool420(accounting_);

        uint8 targetKind = funding.TARGET_POOL();
        if (targetKind == 0) revert InvalidConfiguration();
        poolTargetKind = targetKind;
    }

    function systemName() external pure returns (string memory) {
        return "ComputeResearchRewardPool420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    /// @notice Create one pool against an exact current research-project and metric-policy revision.
    /// @dev Only the canonical project owner can create the pool.
    function createPool(
        bytes32 projectId,
        uint64 projectRevision,
        bytes32 projectCommitment,
        bytes32 policyId,
        uint32 policyRevision
    ) external returns (bytes32 poolId) {
        if (
            projectId == bytes32(0)
                || projectRevision == 0
                || projectCommitment == bytes32(0)
                || policyId == bytes32(0)
                || policyRevision == 0
        ) revert InvalidPool();

        ComputeResearchProjectRegistry420.Project memory project =
            projects.project(projectId);
        if (
            project.owner != msg.sender
                || !projects.isCurrentAcceptable(
                    projectId,
                    projectRevision,
                    projectCommitment
                )
        ) revert Unauthorized();

        ComputeUsefulContributionPolicy420.Policy memory policy =
            policies.policy(policyId, policyRevision);
        bytes32 exactPolicyCommitment = policies.commitment(policyId, policyRevision);

        poolId = keccak256(
            abi.encode(
                POOL_DOMAIN,
                block.chainid,
                address(this),
                projectId,
                projectRevision,
                projectCommitment,
                project.researchDomain,
                policyId,
                policyRevision,
                exactPolicyCommitment,
                policy.metricKind,
                policy.metricId,
                msg.sender
            )
        );
        if (_pools[poolId].exists) revert InvalidPool();

        _pools[poolId] = Pool({
            poolId: poolId,
            projectId: projectId,
            projectRevision: projectRevision,
            projectCommitment: projectCommitment,
            researchDomain: project.researchDomain,
            policyId: policyId,
            policyRevision: policyRevision,
            policyCommitment: exactPolicyCommitment,
            metricKind: policy.metricKind,
            metricId: policy.metricId,
            owner: msg.sender,
            createdAt: uint64(block.timestamp),
            acceptingContributions: true,
            exists: true
        });

        emit ResearchRewardPoolCreated(
            poolId,
            projectId,
            project.researchDomain,
            policyId,
            policyRevision,
            policy.metricId,
            msg.sender
        );
    }

    /// @notice Pause/resume admission to this pool without changing its frozen project/metric semantics.
    function setAcceptance(bytes32 poolId, bool accepting) external {
        Pool storage p = _pools[poolId];
        if (!p.exists) revert InvalidPool();
        if (msg.sender != p.owner) revert Unauthorized();
        if (p.acceptingContributions == accepting) revert InvalidPool();
        p.acceptingContributions = accepting;
        emit ResearchRewardPoolAcceptanceSet(poolId, accepting);
    }

    /// @notice Total separately supplied CMP-6.1 capital currently attributed to this pool.
    /// @dev Reporting only; this contract has no authority to consume or reserve the amount.
    function fundedAmount(bytes32 poolId) public view returns (uint256) {
        if (!_pools[poolId].exists) revert InvalidPool();
        return funding.fundedByTarget(keccak256(abi.encode(poolTargetKind, poolId)));
    }

    /// @notice True when an already-recorded CMP-6.3 contribution matches the frozen pool semantics.
    /// @dev This is classification only, not reward allocation or payout entitlement.
    function eligibleContribution(bytes32 poolId, bytes32 contributionId)
        external
        view
        returns (bool)
    {
        Pool memory p = _pools[poolId];
        if (!p.exists || !p.acceptingContributions || fundedAmount(poolId) == 0) {
            return false;
        }

        try accounting.contribution(contributionId) returns (
            IComputeUsefulContributionAccountingPool420.ContributionRecord memory c
        ) {
            return c.exists
                && c.projectRef == p.projectId
                && c.policyId == p.policyId
                && c.policyRevision == p.policyRevision
                && c.policyCommitment == p.policyCommitment
                && c.metricKind == p.metricKind
                && c.metricId == p.metricId
                && c.amount != 0;
        } catch {
            return false;
        }
    }

    function pool(bytes32 poolId) external view returns (Pool memory p) {
        p = _pools[poolId];
        if (!p.exists) revert InvalidPool();
    }
}
