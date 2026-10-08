// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeUsefulContributionPolicy420.sol";

interface IComputeUsefulRewardGate420 {
    struct RewardGate {
        bytes32 gateId;
        bytes32 jobId;
        bytes32 verificationRef;
        bytes32 resultCommitment;
        address verifier;
        uint64 jobRevision;
        uint256 fundedSnapshot;
        uint64 gatedAt;
        bool exists;
    }

    function rewardGate(bytes32 gateId) external view returns (RewardGate memory g);
    function currentlyVerified(bytes32 gateId) external view returns (bool);
}

interface IComputeUsefulContributionSource420 {
    struct ContributionEvidence {
        bytes32 gateId;
        address contributor;
        bytes32 projectRef;
        uint8 metricKind;
        bytes32 metricId;
        uint256 amount;
        uint64 observedAt;
        bytes32 evidenceCommitment;
        bool finalMeasured;
    }

    function contributionEvidence(bytes32 contributionRef)
        external
        view
        returns (ContributionEvidence memory evidence);
}

/// @notice CMP-6.3 typed contribution accounting over currently verified CMP-6.2 reward gates.
/// @dev Records policy-authorized measurements only. It owns no reward rate, pool allocation,
///      beneficiary payout, Vault authority, minting, payer-escrow or consensus authority.
contract ComputeUsefulContributionAccounting420 is I420System {
    bytes32 public constant CONTRIBUTION_DOMAIN =
        keccak256("420Integrated.ComputeMarket.UsefulContributionAccounting.v1");

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

    ComputeUsefulContributionPolicy420 public immutable policies;
    IComputeUsefulRewardGate420 public immutable verificationGate;

    mapping(bytes32 => ContributionRecord) private _contributions;
    mapping(bytes32 => bool) public sourceContributionConsumed;
    mapping(address => mapping(bytes32 => uint256)) public totalByContributorMetric;
    mapping(bytes32 => mapping(bytes32 => uint256)) public totalByProjectMetric;
    mapping(bytes32 => mapping(bytes32 => uint256)) public totalByJobMetric;
    mapping(bytes32 => uint256) public totalByMetric;

    error InvalidConfiguration();
    error InvalidContribution();
    error Replay();

    event ContributionRecorded(
        bytes32 indexed contributionId,
        bytes32 indexed jobId,
        address indexed contributor,
        bytes32 projectRef,
        bytes32 policyId,
        uint32 policyRevision,
        uint8 metricKind,
        bytes32 metricId,
        uint256 amount,
        bytes32 gateId
    );

    constructor(address policies_, address verificationGate_) {
        if (policies_.code.length == 0 || verificationGate_.code.length == 0) {
            revert InvalidConfiguration();
        }
        policies = ComputeUsefulContributionPolicy420(policies_);
        verificationGate = IComputeUsefulRewardGate420(verificationGate_);
    }

    function systemName() external pure returns (string memory) {
        return "ComputeUsefulContributionAccounting420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    /// @notice Record one final contribution measurement authorized by a frozen policy revision.
    /// @dev Permissionless relay. Caller cannot choose contributor, metric, project or amount.
    function recordContribution(
        bytes32 policyId,
        uint32 policyRevision,
        bytes32 contributionRef
    ) external returns (bytes32 contributionId) {
        if (policyId == bytes32(0) || policyRevision == 0 || contributionRef == bytes32(0)) {
            revert InvalidContribution();
        }

        ComputeUsefulContributionPolicy420.Policy memory p =
            policies.policy(policyId, policyRevision);
        if (
            p.policyId != policyId
                || p.source.code.length == 0
                || p.source.codehash != p.sourceCodeHash
        ) revert InvalidContribution();

        IComputeUsefulContributionSource420.ContributionEvidence memory e =
            IComputeUsefulContributionSource420(p.source).contributionEvidence(contributionRef);

        if (
            !e.finalMeasured
                || e.gateId == bytes32(0)
                || e.contributor == address(0)
                || e.projectRef == bytes32(0)
                || e.metricKind != p.metricKind
                || e.metricId != p.metricId
                || e.amount == 0
                || e.amount > p.maxAmount
                || e.observedAt == 0
                || e.evidenceCommitment == bytes32(0)
        ) revert InvalidContribution();

        if (!verificationGate.currentlyVerified(e.gateId)) revert InvalidContribution();

        IComputeUsefulRewardGate420.RewardGate memory g =
            verificationGate.rewardGate(e.gateId);
        if (!g.exists || g.jobId == bytes32(0) || e.observedAt < g.gatedAt) {
            revert InvalidContribution();
        }

        bytes32 consumedKey = keccak256(abi.encode(p.source, contributionRef));
        if (sourceContributionConsumed[consumedKey]) revert Replay();

        bytes32 exactPolicyCommitment = policies.commitment(policyId, policyRevision);
        contributionId = keccak256(
            abi.encode(
                CONTRIBUTION_DOMAIN,
                block.chainid,
                address(this),
                p.source,
                contributionRef,
                e.gateId,
                g.jobId,
                e.contributor,
                e.projectRef,
                e.metricKind,
                e.metricId,
                e.amount,
                e.observedAt,
                e.evidenceCommitment,
                policyId,
                policyRevision,
                exactPolicyCommitment
            )
        );
        if (_contributions[contributionId].exists) revert Replay();

        sourceContributionConsumed[consumedKey] = true;
        totalByContributorMetric[e.contributor][e.metricId] += e.amount;
        totalByProjectMetric[e.projectRef][e.metricId] += e.amount;
        totalByJobMetric[g.jobId][e.metricId] += e.amount;
        totalByMetric[e.metricId] += e.amount;

        _contributions[contributionId] = ContributionRecord({
            contributionId: contributionId,
            contributionRef: contributionRef,
            gateId: e.gateId,
            jobId: g.jobId,
            contributor: e.contributor,
            projectRef: e.projectRef,
            policyId: policyId,
            policyRevision: policyRevision,
            policyCommitment: exactPolicyCommitment,
            metricKind: e.metricKind,
            metricId: e.metricId,
            amount: e.amount,
            observedAt: e.observedAt,
            evidenceCommitment: e.evidenceCommitment,
            recordedAt: uint64(block.timestamp),
            exists: true
        });

        emit ContributionRecorded(
            contributionId,
            g.jobId,
            e.contributor,
            e.projectRef,
            policyId,
            policyRevision,
            e.metricKind,
            e.metricId,
            e.amount,
            e.gateId
        );
    }

    function contribution(bytes32 contributionId)
        external
        view
        returns (ContributionRecord memory r)
    {
        r = _contributions[contributionId];
        if (!r.exists) revert InvalidContribution();
    }
}
