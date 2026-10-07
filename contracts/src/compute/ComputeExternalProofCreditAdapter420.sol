// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";

/// @notice CMP-5.5 provider-neutral normalization for externally supplied proof and credit records.
/// @dev Stateless and non-authoritative: no truth attestation, duplicate prevention, reward,
/// settlement, credential validation, or stake/slash authority is created here.
contract ComputeExternalProofCreditAdapter420 is I420System {
    bytes32 public constant SOURCE_BINDING_DOMAIN =
        keccak256("420/CMP/EXTERNAL_PROOF_CREDIT/SOURCE_BINDING/V1");
    bytes32 public constant PROOF_ID_DOMAIN =
        keccak256("420/CMP/EXTERNAL_PROOF_CREDIT/PROOF_ID/V1");
    bytes32 public constant PROOF_RECORD_DOMAIN =
        keccak256("420/CMP/EXTERNAL_PROOF_CREDIT/PROOF_RECORD/V1");
    bytes32 public constant CREDIT_ID_DOMAIN =
        keccak256("420/CMP/EXTERNAL_PROOF_CREDIT/CREDIT_ID/V1");
    bytes32 public constant CREDIT_RECORD_DOMAIN =
        keccak256("420/CMP/EXTERNAL_PROOF_CREDIT/CREDIT_RECORD/V1");
    bytes32 public constant PROTOCOL_DOMAIN =
        keccak256("420/CMP/EXTERNAL_PROOF_CREDIT/PROTOCOL/V1");

    struct ExternalSource {
        bytes32 adapterKind;
        bytes32 externalSystemId;
        bytes32 contributionId;
    }

    struct ProofRecord {
        ExternalSource source;
        bytes32 proofSchemeCommitment;
        bytes32 issuerIdentityCommitment;
        bytes32 proofCommitment;
        uint64 observedAt;
        uint64 expiresAt;
        bytes32 evidenceCommitment;
    }

    struct CreditRecord {
        ExternalSource source;
        bytes32 creditSchemeCommitment;
        bytes32 issuerIdentityCommitment;
        bytes32 creditUnitCommitment;
        uint128 creditAmount;
        uint64 observedAt;
        bytes32 evidenceCommitment;
    }

    error InvalidExternalSource();
    error InvalidProofRecord();
    error InvalidCreditRecord();

    function systemName() external pure returns (string memory) {
        return "ComputeExternalProofCreditAdapter420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function protocolCommitment() public pure returns (bytes32) {
        return keccak256(abi.encode(
            PROTOCOL_DOMAIN,
            SOURCE_BINDING_DOMAIN,
            PROOF_ID_DOMAIN,
            PROOF_RECORD_DOMAIN,
            CREDIT_ID_DOMAIN,
            CREDIT_RECORD_DOMAIN,
            uint32(1)
        ));
    }

    function sourceBinding(ExternalSource memory source) public pure returns (bytes32) {
        _validateSource(source);
        return keccak256(abi.encode(
            SOURCE_BINDING_DOMAIN,
            source.adapterKind,
            source.externalSystemId,
            source.contributionId
        ));
    }

    function proofId(ProofRecord memory record) public pure returns (bytes32) {
        _validateProof(record);
        return keccak256(abi.encode(
            PROOF_ID_DOMAIN,
            sourceBinding(record.source),
            record.proofSchemeCommitment,
            record.issuerIdentityCommitment,
            record.proofCommitment
        ));
    }

    function proofRecordCommitment(ProofRecord memory record) public pure returns (bytes32) {
        _validateProof(record);
        return keccak256(abi.encode(
            PROOF_RECORD_DOMAIN,
            protocolCommitment(),
            proofId(record),
            sourceBinding(record.source),
            record.proofSchemeCommitment,
            record.issuerIdentityCommitment,
            record.proofCommitment,
            record.observedAt,
            record.expiresAt,
            record.evidenceCommitment
        ));
    }

    function creditId(CreditRecord memory record) public pure returns (bytes32) {
        _validateCredit(record);
        return keccak256(abi.encode(
            CREDIT_ID_DOMAIN,
            sourceBinding(record.source),
            record.creditSchemeCommitment,
            record.issuerIdentityCommitment,
            record.creditUnitCommitment
        ));
    }

    function creditRecordCommitment(CreditRecord memory record) public pure returns (bytes32) {
        _validateCredit(record);
        return keccak256(abi.encode(
            CREDIT_RECORD_DOMAIN,
            protocolCommitment(),
            creditId(record),
            sourceBinding(record.source),
            record.creditSchemeCommitment,
            record.issuerIdentityCommitment,
            record.creditUnitCommitment,
            record.creditAmount,
            record.observedAt,
            record.evidenceCommitment
        ));
    }

    function normalizeProof(ProofRecord calldata record)
        external pure returns (bytes32 id, bytes32 normalizedRecord)
    {
        id = proofId(record);
        normalizedRecord = proofRecordCommitment(record);
    }

    function normalizeCredit(CreditRecord calldata record)
        external pure returns (bytes32 id, bytes32 normalizedRecord)
    {
        id = creditId(record);
        normalizedRecord = creditRecordCommitment(record);
    }

    function _validateSource(ExternalSource memory source) private pure {
        if (
            source.adapterKind == bytes32(0)
                || source.externalSystemId == bytes32(0)
                || source.contributionId == bytes32(0)
        ) revert InvalidExternalSource();
    }

    function _validateProof(ProofRecord memory record) private pure {
        _validateSource(record.source);
        if (
            record.proofSchemeCommitment == bytes32(0)
                || record.issuerIdentityCommitment == bytes32(0)
                || record.proofCommitment == bytes32(0)
                || record.observedAt == 0
                || (record.expiresAt != 0 && record.expiresAt < record.observedAt)
                || record.evidenceCommitment == bytes32(0)
        ) revert InvalidProofRecord();
    }

    function _validateCredit(CreditRecord memory record) private pure {
        _validateSource(record.source);
        if (
            record.creditSchemeCommitment == bytes32(0)
                || record.issuerIdentityCommitment == bytes32(0)
                || record.creditUnitCommitment == bytes32(0)
                || record.creditAmount == 0
                || record.observedAt == 0
                || record.evidenceCommitment == bytes32(0)
        ) revert InvalidCreditRecord();
    }
}
