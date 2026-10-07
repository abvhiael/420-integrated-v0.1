// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./IComputeExternalContributionAdapter420.sol";

/// @notice CMP-5.2 normalization adapter for BOINC contribution records.
/// @dev This contract is stateless and non-authoritative. It commits externally supplied BOINC
/// record material but does not query a BOINC project, prove server acceptance, create a verifier
/// verdict, grant rewards, move funds, slash stake, or prevent duplicate rewards.
contract ComputeBoincAdapter420 is I420System, IComputeExternalContributionAdapter420 {
    bytes32 public constant ADAPTER_KIND =
        keccak256("420/CMP/EXTERNAL_ADAPTER/BOINC/V1");
    bytes32 public constant EXTERNAL_SYSTEM_ID =
        keccak256("420/CMP/EXTERNAL_SYSTEM/BOINC/V1");
    bytes32 public constant CONTRIBUTION_DOMAIN =
        keccak256("420/CMP/BOINC/CONTRIBUTION_ID/V1");
    bytes32 public constant RECORD_DOMAIN =
        keccak256("420/CMP/BOINC/RECORD/V1");
    bytes32 public constant PROTOCOL_DOMAIN =
        keccak256("420/CMP/BOINC/ADAPTER_PROTOCOL/V1");

    struct BoincRecord {
        bytes32 projectIdentityCommitment;
        bytes32 applicationCommitment;
        bytes32 workUnitCommitment;
        bytes32 participantIdentityCommitment;
        bytes32 hostIdentityCommitment;
        bytes32 assignmentCommitment;
        bytes32 resultCommitment;
        uint64 issuedAt;
        uint64 reportDeadline;
        uint64 reportedAt;
        uint64 grantedCredit;
        bytes32 evidenceCommitment;
    }

    error InvalidBoincRecord();

    function systemName() external pure returns (string memory) {
        return "ComputeBoincAdapter420";
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

    /// @notice Derive the stable external contribution identity.
    /// @dev Application/result/credit/timing observations cannot redefine the underlying assignment.
    function contributionId(BoincRecord memory record) public pure returns (bytes32) {
        _validate(record);
        return keccak256(abi.encode(
            CONTRIBUTION_DOMAIN,
            EXTERNAL_SYSTEM_ID,
            record.projectIdentityCommitment,
            record.workUnitCommitment,
            record.participantIdentityCommitment,
            record.hostIdentityCommitment,
            record.assignmentCommitment
        ));
    }

    /// @notice Commit the complete normalized BOINC observation.
    /// @dev Zero granted credit is allowed because normalization is not reward eligibility.
    function recordCommitment(BoincRecord memory record) public pure returns (bytes32) {
        _validate(record);
        bytes32 contribution = contributionId(record);
        return keccak256(abi.encode(
            RECORD_DOMAIN,
            protocolCommitment(),
            contribution,
            record.projectIdentityCommitment,
            record.applicationCommitment,
            record.workUnitCommitment,
            record.participantIdentityCommitment,
            record.hostIdentityCommitment,
            record.assignmentCommitment,
            record.resultCommitment,
            record.issuedAt,
            record.reportDeadline,
            record.reportedAt,
            record.grantedCredit,
            record.evidenceCommitment
        ));
    }

    function normalize(BoincRecord calldata record)
        external pure returns (bytes32 contribution, bytes32 normalizedRecord)
    {
        contribution = contributionId(record);
        normalizedRecord = recordCommitment(record);
    }

    function _validate(BoincRecord memory record) private pure {
        if (
            record.projectIdentityCommitment == bytes32(0)
                || record.applicationCommitment == bytes32(0)
                || record.workUnitCommitment == bytes32(0)
                || record.participantIdentityCommitment == bytes32(0)
                || record.assignmentCommitment == bytes32(0)
                || record.resultCommitment == bytes32(0)
                || record.issuedAt == 0
                || record.reportDeadline < record.issuedAt
                || record.reportedAt < record.issuedAt
                || record.evidenceCommitment == bytes32(0)
        ) revert InvalidBoincRecord();
    }
}
