// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./IComputeExternalContributionAdapter420.sol";

/// @notice CMP-5.4 normalization gateway for university and institutional HPC execution records.
/// @dev This contract is stateless and non-authoritative. It binds institution/gateway/allocation
/// evidence without asserting scheduler truth, credential validity, scientific correctness, payment,
/// external attestation, stake consequences, or duplicate-reward prevention.
contract ComputeUniversityHpcGateway420 is I420System, IComputeExternalContributionAdapter420 {
    bytes32 public constant ADAPTER_KIND =
        keccak256("420/CMP/EXTERNAL_ADAPTER/UNIVERSITY_HPC_GATEWAY/V1");
    bytes32 public constant EXTERNAL_SYSTEM_ID =
        keccak256("420/CMP/EXTERNAL_SYSTEM/UNIVERSITY_HPC/V1");
    bytes32 public constant CONTRIBUTION_DOMAIN =
        keccak256("420/CMP/UNIVERSITY_HPC/CONTRIBUTION_ID/V1");
    bytes32 public constant RECORD_DOMAIN =
        keccak256("420/CMP/UNIVERSITY_HPC/RECORD/V1");
    bytes32 public constant PROTOCOL_DOMAIN =
        keccak256("420/CMP/UNIVERSITY_HPC/GATEWAY_PROTOCOL/V1");

    struct HpcRecord {
        bytes32 institutionIdentityCommitment;
        bytes32 gatewayIdentityCommitment;
        bytes32 schedulerIdentityCommitment;
        bytes32 accountIdentityCommitment;
        bytes32 researchProjectCommitment;
        bytes32 workloadCommitment;
        bytes32 allocationCommitment;
        bytes32 queueOrPartitionCommitment;
        bytes32 resultCommitment;
        uint64 submittedAt;
        uint64 startedAt;
        uint64 completedAt;
        bytes32 resourceUsageCommitment;
        bytes32 accountingCommitment;
        bytes32 evidenceCommitment;
    }

    error InvalidHpcRecord();

    function systemName() external pure returns (string memory) {
        return "ComputeUniversityHpcGateway420";
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

    /// @notice Stable identity for one institution-scoped external HPC allocation.
    function contributionId(HpcRecord memory record) public pure returns (bytes32) {
        _validate(record);
        return keccak256(abi.encode(
            CONTRIBUTION_DOMAIN,
            EXTERNAL_SYSTEM_ID,
            record.institutionIdentityCommitment,
            record.gatewayIdentityCommitment,
            record.schedulerIdentityCommitment,
            record.accountIdentityCommitment,
            record.researchProjectCommitment,
            record.workloadCommitment,
            record.allocationCommitment
        ));
    }

    /// @notice Commit the complete normalized university/HPC gateway observation.
    function recordCommitment(HpcRecord memory record) public pure returns (bytes32) {
        _validate(record);
        bytes32 contribution = contributionId(record);
        return keccak256(abi.encode(
            RECORD_DOMAIN,
            protocolCommitment(),
            contribution,
            record.institutionIdentityCommitment,
            record.gatewayIdentityCommitment,
            record.schedulerIdentityCommitment,
            record.accountIdentityCommitment,
            record.researchProjectCommitment,
            record.workloadCommitment,
            record.allocationCommitment,
            record.queueOrPartitionCommitment,
            record.resultCommitment,
            record.submittedAt,
            record.startedAt,
            record.completedAt,
            record.resourceUsageCommitment,
            record.accountingCommitment,
            record.evidenceCommitment
        ));
    }

    function normalize(HpcRecord calldata record)
        external pure returns (bytes32 contribution, bytes32 normalizedRecord)
    {
        contribution = contributionId(record);
        normalizedRecord = recordCommitment(record);
    }

    function _validate(HpcRecord memory record) private pure {
        if (
            record.institutionIdentityCommitment == bytes32(0)
                || record.gatewayIdentityCommitment == bytes32(0)
                || record.schedulerIdentityCommitment == bytes32(0)
                || record.accountIdentityCommitment == bytes32(0)
                || record.researchProjectCommitment == bytes32(0)
                || record.workloadCommitment == bytes32(0)
                || record.allocationCommitment == bytes32(0)
                || record.resultCommitment == bytes32(0)
                || record.submittedAt == 0
                || record.startedAt < record.submittedAt
                || record.completedAt < record.startedAt
                || record.resourceUsageCommitment == bytes32(0)
                || record.accountingCommitment == bytes32(0)
                || record.evidenceCommitment == bytes32(0)
        ) revert InvalidHpcRecord();
    }
}
