// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";
import "./ComputeExternalProofCreditAdapter420.sol";

/// @notice CMP-5.7 trusted external-result attestation and canonical-work mapping.
/// @dev Attests external-result identity only. It grants no reward, settlement, stake/slash,
/// verifier, proof-validation, credit-issuance, or custody authority.
contract ComputeExternalResultAttestation420 is SystemAccess, I420System {
    bytes32 public constant ATTESTATION_DOMAIN =
        keccak256("420/CMP/EXTERNAL_RESULT_ATTESTATION/V1");
    bytes32 public constant EXTERNAL_RESULT_DOMAIN =
        keccak256("420/CMP/EXTERNAL_RESULT_ATTESTATION/RESULT/V1");
    bytes32 public constant EVIDENCE_BINDING_DOMAIN =
        keccak256("420/CMP/EXTERNAL_RESULT_ATTESTATION/EVIDENCE/V1");

    struct ResultClaim {
        ComputeExternalProofCreditAdapter420.ExternalSource source;
        bytes32 resultCommitment;
        bytes32 proofRecordCommitment;
        bytes32 creditRecordCommitment;
        bytes32 canonicalWorkCommitment;
        bytes32 attestationSchemeCommitment;
        bytes32 evidenceCommitment;
        uint64 observedAt;
        uint64 validAfter;
        uint64 expiresAt;
    }

    struct Attestation {
        bytes32 attestationId;
        bytes32 externalResultKey;
        bytes32 sourceBinding;
        bytes32 evidenceBinding;
        bytes32 canonicalWorkCommitment;
        bytes32 resultCommitment;
        bytes32 attestationSchemeCommitment;
        bytes32 evidenceCommitment;
        address attester;
        uint64 observedAt;
        uint64 validAfter;
        uint64 expiresAt;
        bool revoked;
        bool exists;
    }

    ComputeExternalProofCreditAdapter420 public immutable proofCreditAdapter;

    mapping(address => bool) public trustedAttester;
    mapping(bytes32 => Attestation) private _attestations;
    mapping(bytes32 => bytes32) public attestationForDigest;
    mapping(bytes32 => bytes32) public canonicalWorkForSource;
    mapping(bytes32 => bytes32) public canonicalWorkForExternalResult;
    mapping(bytes32 => bytes32) public canonicalWorkForEvidence;

    error InvalidConfiguration();
    error InvalidAttester();
    error UnauthorizedAttester();
    error InvalidAttestation();
    error UnknownAttestation();
    error ConflictingAttestation();

    event AttesterSet(address indexed attester, bool trusted);
    event ExternalResultAttested(
        bytes32 indexed attestationId,
        bytes32 indexed canonicalWorkCommitment,
        bytes32 indexed sourceBinding,
        bytes32 externalResultKey,
        bytes32 evidenceBinding,
        address attester,
        uint64 expiresAt
    );
    event ExternalResultAttestationRevoked(bytes32 indexed attestationId, address indexed actor);

    constructor(address timelock_, address proofCreditAdapter_)
        SystemAccess(timelock_)
    {
        if (proofCreditAdapter_.code.length == 0) revert InvalidConfiguration();
        proofCreditAdapter = ComputeExternalProofCreditAdapter420(proofCreditAdapter_);
    }

    function systemName() external pure returns (string memory) {
        return "ComputeExternalResultAttestation420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function setAttester(address attester, bool trusted) external onlyGovernance {
        if (attester == address(0)) revert InvalidAttester();
        trustedAttester[attester] = trusted;
        emit AttesterSet(attester, trusted);
    }

    function externalResultKey(
        bytes32 sourceBinding,
        bytes32 resultCommitment
    ) public pure returns (bytes32) {
        if (sourceBinding == bytes32(0) || resultCommitment == bytes32(0)) {
            revert InvalidAttestation();
        }
        return keccak256(abi.encode(
            EXTERNAL_RESULT_DOMAIN,
            sourceBinding,
            resultCommitment
        ));
    }

    function evidenceBinding(
        bytes32 proofRecordCommitment,
        bytes32 creditRecordCommitment
    ) public pure returns (bytes32) {
        if (
            proofRecordCommitment == bytes32(0)
                && creditRecordCommitment == bytes32(0)
        ) revert InvalidAttestation();
        return keccak256(abi.encode(
            EVIDENCE_BINDING_DOMAIN,
            proofRecordCommitment,
            creditRecordCommitment
        ));
    }

    function attestationDigest(ResultClaim calldata claim)
        public view returns (bytes32)
    {
        bytes32 sourceBinding = proofCreditAdapter.sourceBinding(claim.source);
        bytes32 resultKey = externalResultKey(sourceBinding, claim.resultCommitment);
        bytes32 evidence = evidenceBinding(
            claim.proofRecordCommitment,
            claim.creditRecordCommitment
        );
        _validateClaim(claim);
        return keccak256(abi.encode(
            ATTESTATION_DOMAIN,
            block.chainid,
            address(this),
            address(proofCreditAdapter),
            sourceBinding,
            resultKey,
            evidence,
            claim.canonicalWorkCommitment,
            claim.attestationSchemeCommitment,
            claim.evidenceCommitment,
            claim.observedAt,
            claim.validAfter,
            claim.expiresAt,
            msg.sender
        ));
    }

    /// @notice Trusted attesters bind one external result/evidence envelope to one canonical work identity.
    /// @dev Equivalent external source wrappers may intentionally map to the same canonicalWorkCommitment.
    function attest(ResultClaim calldata claim)
        external returns (bytes32 attestationId)
    {
        if (!trustedAttester[msg.sender]) revert UnauthorizedAttester();

        bytes32 sourceBinding = proofCreditAdapter.sourceBinding(claim.source);
        bytes32 resultKey = externalResultKey(sourceBinding, claim.resultCommitment);
        bytes32 evidence = evidenceBinding(
            claim.proofRecordCommitment,
            claim.creditRecordCommitment
        );
        _validateClaim(claim);

        _bind(canonicalWorkForSource, sourceBinding, claim.canonicalWorkCommitment);
        _bind(canonicalWorkForExternalResult, resultKey, claim.canonicalWorkCommitment);
        _bind(canonicalWorkForEvidence, evidence, claim.canonicalWorkCommitment);

        bytes32 digest = keccak256(abi.encode(
            ATTESTATION_DOMAIN,
            block.chainid,
            address(this),
            address(proofCreditAdapter),
            sourceBinding,
            resultKey,
            evidence,
            claim.canonicalWorkCommitment,
            claim.attestationSchemeCommitment,
            claim.evidenceCommitment,
            claim.observedAt,
            claim.validAfter,
            claim.expiresAt,
            msg.sender
        ));

        bytes32 existing = attestationForDigest[digest];
        if (existing != bytes32(0)) return existing;

        attestationId = digest;
        _attestations[attestationId] = Attestation({
            attestationId: attestationId,
            externalResultKey: resultKey,
            sourceBinding: sourceBinding,
            evidenceBinding: evidence,
            canonicalWorkCommitment: claim.canonicalWorkCommitment,
            resultCommitment: claim.resultCommitment,
            attestationSchemeCommitment: claim.attestationSchemeCommitment,
            evidenceCommitment: claim.evidenceCommitment,
            attester: msg.sender,
            observedAt: claim.observedAt,
            validAfter: claim.validAfter,
            expiresAt: claim.expiresAt,
            revoked: false,
            exists: true
        });
        attestationForDigest[digest] = attestationId;

        emit ExternalResultAttested(
            attestationId,
            claim.canonicalWorkCommitment,
            sourceBinding,
            resultKey,
            evidence,
            msg.sender,
            claim.expiresAt
        );
    }

    function revoke(bytes32 attestationId) external {
        Attestation storage a = _attestations[attestationId];
        if (!a.exists) revert UnknownAttestation();
        if (msg.sender != a.attester && msg.sender != governanceTimelock) {
            revert UnauthorizedAttester();
        }
        if (a.revoked) revert InvalidAttestation();
        a.revoked = true;
        emit ExternalResultAttestationRevoked(attestationId, msg.sender);
    }

    function attestation(bytes32 attestationId)
        external view returns (Attestation memory a)
    {
        a = _attestations[attestationId];
        if (!a.exists) revert UnknownAttestation();
    }

    function isAcceptable(bytes32 attestationId) public view returns (bool) {
        Attestation storage a = _attestations[attestationId];
        return a.exists
            && !a.revoked
            && trustedAttester[a.attester]
            && block.timestamp >= a.validAfter
            && block.timestamp < a.expiresAt
            && canonicalWorkForSource[a.sourceBinding] == a.canonicalWorkCommitment
            && canonicalWorkForExternalResult[a.externalResultKey] == a.canonicalWorkCommitment
            && canonicalWorkForEvidence[a.evidenceBinding] == a.canonicalWorkCommitment;
    }

    /// @notice Resolve a currently acceptable attestation into the canonical-work identity
    /// consumed by CMP-5.6.
    function resolve(bytes32 attestationId)
        external view
        returns (
            bytes32 canonicalWorkCommitment,
            bytes32 sourceBinding,
            bytes32 resultCommitment,
            bytes32 evidenceCommitment
        )
    {
        if (!isAcceptable(attestationId)) revert InvalidAttestation();
        Attestation storage a = _attestations[attestationId];
        return (
            a.canonicalWorkCommitment,
            a.sourceBinding,
            a.resultCommitment,
            a.evidenceCommitment
        );
    }

    function _validateClaim(ResultClaim calldata claim) private view {
        if (
            claim.resultCommitment == bytes32(0)
                || claim.canonicalWorkCommitment == bytes32(0)
                || claim.attestationSchemeCommitment == bytes32(0)
                || claim.evidenceCommitment == bytes32(0)
                || claim.observedAt == 0
                || claim.observedAt > block.timestamp
                || claim.validAfter < claim.observedAt
                || claim.expiresAt <= claim.validAfter
                || claim.expiresAt <= block.timestamp
        ) revert InvalidAttestation();
    }

    function _bind(
        mapping(bytes32 => bytes32) storage bindings,
        bytes32 key,
        bytes32 canonicalWorkCommitment
    ) private {
        bytes32 existing = bindings[key];
        if (existing != bytes32(0) && existing != canonicalWorkCommitment) {
            revert ConflictingAttestation();
        }
        if (existing == bytes32(0)) {
            bindings[key] = canonicalWorkCommitment;
        }
    }
}
