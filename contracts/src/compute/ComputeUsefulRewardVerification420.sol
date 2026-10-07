// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ComputeJobRegistry420.sol";

interface IComputeUsefulRewardFundingGate420 {
    function TARGET_JOB() external view returns (uint8);
    function rewardVaultId() external view returns (bytes32);
    function fundedByTarget(bytes32 targetKey) external view returns (uint256);
}

/// @notice CMP-6.2 verification gate for useful-computation job reward opportunities.
/// @dev This contract records that a funded canonical Compute job is VERIFIED under the job's
///      bound verification evidence. It does not calculate a reward, choose a beneficiary,
///      create a Vault obligation, consume funding, settle a job, or move value.
contract ComputeUsefulRewardVerification420 is I420System {
    bytes32 public constant GATE_DOMAIN =
        keccak256("420Integrated.ComputeMarket.UsefulRewardVerification.v1");

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

    IComputeUsefulRewardFundingGate420 public immutable funding;
    ComputeJobRegistry420 public immutable jobs;
    IComputeJobVerificationEvidence420 public immutable verificationEvidence;
    uint8 public immutable jobTargetKind;

    mapping(bytes32 => RewardGate) private _gates;
    mapping(bytes32 => bytes32) public gateForJob;

    error InvalidConfiguration();
    error InvalidVerification();
    error Replay();

    event UsefulRewardVerificationGated(
        bytes32 indexed gateId,
        bytes32 indexed jobId,
        bytes32 indexed verificationRef,
        bytes32 resultCommitment,
        address verifier,
        uint64 jobRevision,
        uint256 fundedSnapshot
    );

    constructor(address funding_, address jobs_) {
        if (funding_.code.length == 0 || jobs_.code.length == 0) {
            revert InvalidConfiguration();
        }

        funding = IComputeUsefulRewardFundingGate420(funding_);
        jobs = ComputeJobRegistry420(jobs_);

        uint8 targetKind = funding.TARGET_JOB();
        if (targetKind == 0 || funding.rewardVaultId() == bytes32(0)) {
            revert InvalidConfiguration();
        }
        jobTargetKind = targetKind;

        IComputeJobVerificationEvidence420 evidence = jobs.verificationEvidence();
        if (address(evidence).code.length == 0) revert InvalidConfiguration();
        verificationEvidence = evidence;
    }

    function systemName() external pure returns (string memory) {
        return "ComputeUsefulRewardVerification420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    /// @notice Freeze a verification-gate snapshot for one funded canonical job.
    /// @dev Permissionless relay. No caller-supplied amount or beneficiary exists.
    function gateJobReward(bytes32 jobId, uint64 expectedRevision)
        external
        returns (bytes32 gateId)
    {
        if (jobId == bytes32(0) || gateForJob[jobId] != bytes32(0)) revert Replay();

        bytes32 fundingTargetKey = keccak256(abi.encode(jobTargetKind, jobId));
        uint256 fundedSnapshot = funding.fundedByTarget(fundingTargetKey);
        if (fundedSnapshot == 0) revert InvalidVerification();

        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (
            j.status != ComputeJobRegistry420.Status.VERIFIED
                || j.revision != expectedRevision
                || j.resultCommitment == bytes32(0)
                || j.verificationRef == bytes32(0)
                || j.verifier == address(0)
        ) revert InvalidVerification();

        if (
            !verificationEvidence.verified(
                jobId,
                j.resultCommitment,
                j.verifier,
                j.verificationRef,
                true
            )
        ) revert InvalidVerification();

        gateId = keccak256(
            abi.encode(
                GATE_DOMAIN,
                block.chainid,
                address(this),
                address(funding),
                address(jobs),
                jobId,
                j.verificationRef,
                j.resultCommitment,
                j.verifier,
                j.revision,
                fundedSnapshot
            )
        );
        if (_gates[gateId].exists) revert Replay();

        _gates[gateId] = RewardGate({
            gateId: gateId,
            jobId: jobId,
            verificationRef: j.verificationRef,
            resultCommitment: j.resultCommitment,
            verifier: j.verifier,
            jobRevision: j.revision,
            fundedSnapshot: fundedSnapshot,
            gatedAt: uint64(block.timestamp),
            exists: true
        });
        gateForJob[jobId] = gateId;

        emit UsefulRewardVerificationGated(
            gateId,
            jobId,
            j.verificationRef,
            j.resultCommitment,
            j.verifier,
            j.revision,
            fundedSnapshot
        );
    }

    /// @notice True only while the canonical job still carries the same approved verification.
    /// @dev Later dispute/failure/state drift therefore cannot be silently treated as reward-ready.
    function currentlyVerified(bytes32 gateId) external view returns (bool) {
        RewardGate storage g = _gates[gateId];
        if (!g.exists) return false;

        ComputeJobRegistry420.Job memory j = jobs.job(g.jobId);
        if (
            j.status != ComputeJobRegistry420.Status.VERIFIED
                || j.verificationRef != g.verificationRef
                || j.resultCommitment != g.resultCommitment
                || j.verifier != g.verifier
        ) return false;

        return verificationEvidence.verified(
            g.jobId,
            g.resultCommitment,
            g.verifier,
            g.verificationRef,
            true
        );
    }

    function rewardGate(bytes32 gateId) external view returns (RewardGate memory g) {
        g = _gates[gateId];
        if (!g.exists) revert InvalidVerification();
    }
}
