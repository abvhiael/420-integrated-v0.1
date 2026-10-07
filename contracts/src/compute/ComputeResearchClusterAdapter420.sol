// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./IComputeExternalContributionAdapter420.sol";

/// @notice CMP-5.3 normalization adapter for institution- or lab-operated research clusters.
/// @dev This contract is stateless and non-authoritative. It commits externally supplied cluster
/// execution records without asserting scheduler truth, scientific correctness, payment entitlement,
/// external attestation, stake consequences, or duplicate-reward prevention.
contract ComputeResearchClusterAdapter420 is I420System, IComputeExternalContributionAdapter420 {
    bytes32 public constant ADAPTER_KIND =
        keccak256("420/CMP/EXTERNAL_ADAPTER/RESEARCH_CLUSTER/V1");
    bytes32 public constant EXTERNAL_SYSTEM_ID =
        keccak256("420/CMP/EXTERNAL_SYSTEM/RESEARCH_CLUSTER/V1");
    bytes32 public constant CONTRIBUTION_DOMAIN =
        keccak256("420/CMP/RESEARCH_CLUSTER/CONTRIBUTION_ID/V1");
    bytes32 public constant RECORD_DOMAIN =
        keccak256("420/CMP/RESEARCH_CLUSTER/RECORD/V1");
    bytes32 public constant PROTOCOL_DOMAIN =
        keccak256("420/CMP/RESEARCH_CLUSTER/ADAPTER_PROTOCOL/V1");

    struct ClusterRecord {
        bytes32 clusterIdentityCommitment;
        bytes32 schedulerIdentityCommitment;
        bytes32 researchProjectCommitment;
        bytes32 workloadCommitment;
        bytes32 submitterIdentityCommitment;
        bytes32 allocationCommitment;
        bytes32 nodeSetCommitment;
        bytes32 resultCommitment;
        uint64 submittedAt;
        uint64 startedAt;
        uint64 completedAt;
        bytes32 resourceUsageCommitment;
        bytes32 evidenceCommitment;
    }

    error InvalidClusterRecord();

    function systemName() external pure returns (string memory) {
        return "ComputeResearchClusterAdapter420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function adapterKind() external pure returns (bytes32) {
        return ADAPTER_KIND;
    }

    function externalSystemId() external pure returns (bytes32) {
        return EXTERNAL_SYSTEM_ID;
    }

    function protocolCommitment() public pure returns (bytes32) {
        return keccak256(abi.encode(
            PROTOCOL_DOMAIN,
            ADAPTER_KIND,
            EXTERNAL_SYSTEM_ID,
            CONTRIBUTION_DOMAIN,
            RECORD_DOMAIN,
            uint32(1)
        ));
    }

    /// @notice Stable external contribution identity for one cluster allocation/work item.
    /// @dev Node-set/result/timing/resource observations do not redefine assignment identity.
    function contributionId(ClusterRecord memory record) public pure returns (bytes32) {
        _validate(record);
        return keccak256(abi.encode(
            CONTRIBUTION_DOMAIN,
            EXTERNAL_SYSTEM_ID,
            record.clusterIdentityCommitment,
            record.schedulerIdentityCommitment,
            record.researchProjectCommitment,
            record.workloadCommitment,
            record.submitterIdentityCommitment,
            record.allocationCommitment
        ));
    }

    /// @notice Commit the complete normalized research-cluster observation.
    function recordCommitment(ClusterRecord memory record) public pure returns (bytes32) {
        _validate(record);
        bytes32 contribution = contributionId(record);
        return keccak256(abi.encode(
            RECORD_DOMAIN,
            protocolCommitment(),
            contribution,
            record.clusterIdentityCommitment,
            record.schedulerIdentityCommitment,
            record.researchProjectCommitment,
            record.workloadCommitment,
            record.submitterIdentityCommitment,
            record.allocationCommitment,
            record.nodeSetCommitment,
            record.resultCommitment,
            record.submittedAt,
            record.startedAt,
            record.completedAt,
            record.resourceUsageCommitment,
            record.evidenceCommitment
        ));
    }

    function normalize(ClusterRecord calldata record)
        external pure returns (bytes32 contribution, bytes32 normalizedRecord)
    {
        contribution = contributionId(record);
        normalizedRecord = recordCommitment(record);
    }

    function _validate(ClusterRecord memory record) private pure {
        if (
            record.clusterIdentityCommitment == bytes32(0)
                || record.schedulerIdentityCommitment == bytes32(0)
                || record.researchProjectCommitment == bytes32(0)
                || record.workloadCommitment == bytes32(0)
                || record.submitterIdentityCommitment == bytes32(0)
                || record.allocationCommitment == bytes32(0)
                || record.resultCommitment == bytes32(0)
                || record.submittedAt == 0
                || record.startedAt < record.submittedAt
                || record.completedAt < record.startedAt
                || record.resourceUsageCommitment == bytes32(0)
                || record.evidenceCommitment == bytes32(0)
        ) revert InvalidClusterRecord();
    }
}
