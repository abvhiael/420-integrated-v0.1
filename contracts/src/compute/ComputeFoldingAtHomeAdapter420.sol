// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./IComputeExternalContributionAdapter420.sol";

/// @notice CMP-5.1 normalization adapter for Folding-at-home contribution records.
/// @dev This contract is deliberately stateless and non-authoritative. It commits externally supplied
/// Folding-at-home record material into stable 420Integrated identities; it does not attest that the
/// external record is true, query Folding-at-home, grant rewards, settle funds, or prevent duplicates.
contract ComputeFoldingAtHomeAdapter420 is I420System, IComputeExternalContributionAdapter420 {
    bytes32 public constant ADAPTER_KIND =
        keccak256("420/CMP/EXTERNAL_ADAPTER/FOLDING_AT_HOME/V1");
    bytes32 public constant EXTERNAL_SYSTEM_ID =
        keccak256("420/CMP/EXTERNAL_SYSTEM/FOLDING_AT_HOME/V1");
    bytes32 public constant CONTRIBUTION_DOMAIN =
        keccak256("420/CMP/FOLDING_AT_HOME/CONTRIBUTION_ID/V1");
    bytes32 public constant RECORD_DOMAIN =
        keccak256("420/CMP/FOLDING_AT_HOME/RECORD/V1");
    bytes32 public constant PROTOCOL_DOMAIN =
        keccak256("420/CMP/FOLDING_AT_HOME/ADAPTER_PROTOCOL/V1");

    struct FoldingRecord {
        uint32 projectNumber;
        bytes32 workUnitCommitment;
        bytes32 donorIdentityCommitment;
        bytes32 teamIdentityCommitment;
        bytes32 assignmentCommitment;
        bytes32 resultCommitment;
        uint64 assignedAt;
        uint64 completedAt;
        uint64 creditedPoints;
        bytes32 evidenceCommitment;
    }

    error InvalidFoldingRecord();

    function systemName() external pure returns (string memory) {
        return "ComputeFoldingAtHomeAdapter420";
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

    /// @notice Derive the stable external-contribution identity.
    /// @dev Team, points and result metadata are excluded so later observations cannot rewrite identity.
    function contributionId(FoldingRecord memory record)
        public pure returns (bytes32)
    {
        _validate(record);
        return keccak256(abi.encode(
            CONTRIBUTION_DOMAIN,
            EXTERNAL_SYSTEM_ID,
            record.projectNumber,
            record.workUnitCommitment,
            record.donorIdentityCommitment,
            record.assignmentCommitment
        ));
    }

    /// @notice Commit the complete normalized external record.
    /// @dev This is an unattested record commitment only. CMP-5.7 owns external-result attestation.
    function recordCommitment(FoldingRecord memory record)
        public pure returns (bytes32)
    {
        _validate(record);
        bytes32 contribution = contributionId(record);
        return keccak256(abi.encode(
            RECORD_DOMAIN,
            protocolCommitment(),
            contribution,
            record.projectNumber,
            record.workUnitCommitment,
            record.donorIdentityCommitment,
            record.teamIdentityCommitment,
            record.assignmentCommitment,
            record.resultCommitment,
            record.assignedAt,
            record.completedAt,
            record.creditedPoints,
            record.evidenceCommitment
        ));
    }

    /// @notice Normalize one Folding-at-home record into contribution and record commitments.
    function normalize(FoldingRecord calldata record)
        external pure returns (bytes32 contribution, bytes32 normalizedRecord)
    {
        contribution = contributionId(record);
        normalizedRecord = recordCommitment(record);
    }

    function _validate(FoldingRecord memory record) private pure {
        if (
            record.projectNumber == 0
                || record.workUnitCommitment == bytes32(0)
                || record.donorIdentityCommitment == bytes32(0)
                || record.assignmentCommitment == bytes32(0)
                || record.resultCommitment == bytes32(0)
                || record.assignedAt == 0
                || record.completedAt < record.assignedAt
                || record.creditedPoints == 0
                || record.evidenceCommitment == bytes32(0)
        ) revert InvalidFoldingRecord();
    }
}
