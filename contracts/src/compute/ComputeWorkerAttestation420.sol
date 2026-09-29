// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";
import "../accounts/ECDSA420.sol";
import "./ComputeWorkerRegistry420.sol";

/// @notice Provider-neutral provenance registry for independently qualified ComputeMarket worker capabilities.
/// @dev Evidence is immutable and bound to one exact worker/resource/profile/key subject and policy/schema revision.
///      Capability evidence is admission evidence only; it is never proof of job-result correctness and grants no
///      worker, verifier, custody, settlement, staking, slashing, governance, bridge, validator, or wallet authority.
contract ComputeWorkerAttestation420 is SystemAccess, I420System {
    bytes32 public constant ATTESTATION_DOMAIN_V1 = keccak256("420Integrated.ComputeMarket.WorkerAttestation.v1");
    bytes32 public constant PROVENANCE_DOMAIN_V1 = keccak256("420Integrated.ComputeMarket.WorkerProvenance.v1");
    bytes32 public constant ATTESTATION_TAG = keccak256("WORKER_ATTESTATION");
    bytes32 public constant PROVENANCE_AUTH_TX_V1 = keccak256("420/COMPUTE/PROVENANCE/AUTH/TX/V1");
    bytes32 public constant PROVENANCE_AUTH_ECDSA_V1 = keccak256("420/COMPUTE/PROVENANCE/AUTH/ECDSA/V1");
    bytes32 public constant EVIDENCE_BENCHMARK_V1 = keccak256("420/COMPUTE/ATTESTATION/BENCHMARK/V1");
    bytes32 public constant EVIDENCE_TEE_V1 = keccak256("420/COMPUTE/ATTESTATION/TEE/V1");
    bytes32 public constant EVIDENCE_INSPECTION_V1 = keccak256("420/COMPUTE/ATTESTATION/INSPECTION/V1");

    struct Policy {
        bytes32 evidenceType;
        bytes32 schemaHash;
        uint32 schemaRevision;
        uint64 maxValiditySeconds;
        uint32 revision;
        bool exists;
    }

    struct ProvenanceClaim {
        bytes32 evidenceType;
        uint32 schemaRevision;
        bytes32 sourceCommitment;
        bytes32 evidenceHash;
        uint64 issuedAt;
        uint64 validAfter;
        uint64 expiresAt;
        address issuer;
    }

    struct Attestation {
        bytes32 workerId;
        uint64 workerRevision;
        bytes32 resourceId;
        uint64 resourceRevision;
        bytes32 capabilityProfileHash;
        bytes32 executionKeyCommitment;
        bytes32 policyId;
        uint32 policyRevision;
        bytes32 evidenceHash;
        address attester;
        uint64 validAfter;
        uint64 expiresAt;
        bool revoked;
        bool exists;
    }

    struct Provenance {
        bytes32 evidenceType;
        bytes32 schemaHash;
        uint32 schemaRevision;
        bytes32 sourceCommitment;
        bytes32 provenanceDigest;
        bytes32 authorizationMode;
        bytes32 signatureHash;
        uint64 issuedAt;
        bool exists;
    }

    ComputeWorkerRegistry420 public immutable workers;
    uint64 public nextEvidenceSerial;

    mapping(bytes32 => uint32) public latestPolicyRevision;
    mapping(bytes32 => mapping(uint32 => Policy)) private _policies;
    mapping(bytes32 => bool) public acceptingNew;
    mapping(bytes32 => mapping(address => bool)) public trustedAttester;
    mapping(bytes32 => Attestation) private _attestations;
    mapping(bytes32 => Provenance) private _provenance;
    mapping(bytes32 => bool) public usedEvidenceCommitment;
    mapping(bytes32 => bool) public usedProvenanceDigest;

    error InvalidPolicy();
    error UnknownPolicy();
    error InvalidAttestation();
    error UnknownAttestation();
    error UnauthorizedAttester();
    error EvidenceReplayed();
    error SerialExhausted();

    event PolicyPublished(
        bytes32 indexed policyId,
        uint32 indexed revision,
        bytes32 indexed evidenceType,
        bytes32 schemaHash,
        uint32 schemaRevision,
        uint64 maxValiditySeconds
    );
    event PolicyAcceptanceSet(bytes32 indexed policyId, bool accepting);
    event AttesterSet(bytes32 indexed policyId, address indexed attester, bool trusted);
    event WorkerAttested(
        bytes32 indexed attestationId,
        bytes32 indexed workerId,
        uint64 indexed workerRevision,
        bytes32 policyId,
        uint32 policyRevision,
        address attester,
        bytes32 evidenceHash,
        uint64 expiresAt
    );
    event WorkerProvenanceAttested(
        bytes32 indexed attestationId,
        bytes32 indexed provenanceDigest,
        bytes32 indexed evidenceType,
        uint32 schemaRevision,
        bytes32 sourceCommitment,
        bytes32 authorizationMode
    );
    event WorkerAttestationRevoked(bytes32 indexed attestationId, address indexed actor);

    constructor(address workerRegistry_, address timelock_) SystemAccess(timelock_) {
        if (workerRegistry_ == address(0) || workerRegistry_.code.length == 0) revert InvalidAttestation();
        workers = ComputeWorkerRegistry420(workerRegistry_);
    }

    function systemName() external pure returns (string memory) { return "ComputeWorkerAttestation420"; }
    function protocolVersion() external pure returns (uint32) { return 2; }

    function supportedEvidenceType(bytes32 evidenceType) public pure returns (bool) {
        return evidenceType == EVIDENCE_BENCHMARK_V1
            || evidenceType == EVIDENCE_TEE_V1
            || evidenceType == EVIDENCE_INSPECTION_V1;
    }

    /// @notice Compatibility publisher that advances the explicit schema revision by one.
    function publishPolicy(
        bytes32 policyId,
        bytes32 evidenceType,
        bytes32 schemaHash,
        uint64 maxValiditySeconds
    ) external onlyGovernance returns (uint32 revision) {
        uint32 previous = latestPolicyRevision[policyId];
        uint32 schemaRevision = previous == 0 ? 1 : _policies[policyId][previous].schemaRevision + 1;
        return _publishPolicy(policyId, evidenceType, schemaHash, schemaRevision, maxValiditySeconds);
    }

    /// @notice Publishes a policy with an explicit monotonically increasing evidence-schema revision.
    function publishPolicyVersioned(
        bytes32 policyId,
        bytes32 evidenceType,
        bytes32 schemaHash,
        uint32 schemaRevision,
        uint64 maxValiditySeconds
    ) external onlyGovernance returns (uint32 revision) {
        return _publishPolicy(policyId, evidenceType, schemaHash, schemaRevision, maxValiditySeconds);
    }

    function _publishPolicy(
        bytes32 policyId,
        bytes32 evidenceType,
        bytes32 schemaHash,
        uint32 schemaRevision,
        uint64 maxValiditySeconds
    ) private returns (uint32 revision) {
        if (
            policyId == bytes32(0)
                || !supportedEvidenceType(evidenceType)
                || schemaHash == bytes32(0)
                || schemaRevision == 0
                || maxValiditySeconds == 0
        ) revert InvalidPolicy();

        uint32 previous = latestPolicyRevision[policyId];
        if (previous == type(uint32).max) revert InvalidPolicy();
        if (previous != 0) {
            Policy storage prior = _policies[policyId][previous];
            if (prior.evidenceType != evidenceType || schemaRevision <= prior.schemaRevision) {
                revert InvalidPolicy();
            }
        }

        revision = previous + 1;
        _policies[policyId][revision] = Policy({
            evidenceType: evidenceType,
            schemaHash: schemaHash,
            schemaRevision: schemaRevision,
            maxValiditySeconds: maxValiditySeconds,
            revision: revision,
            exists: true
        });
        latestPolicyRevision[policyId] = revision;
        acceptingNew[policyId] = true;

        emit PolicyPublished(policyId, revision, evidenceType, schemaHash, schemaRevision, maxValiditySeconds);
        emit PolicyAcceptanceSet(policyId, true);
    }

    function setPolicyAcceptance(bytes32 policyId, bool accepting) external onlyGovernance {
        if (latestPolicyRevision[policyId] == 0) revert UnknownPolicy();
        acceptingNew[policyId] = accepting;
        emit PolicyAcceptanceSet(policyId, accepting);
    }

    function setAttester(bytes32 policyId, address attester, bool trusted) external onlyGovernance {
        if (latestPolicyRevision[policyId] == 0 || attester == address(0)) revert InvalidPolicy();
        trustedAttester[policyId][attester] = trusted;
        emit AttesterSet(policyId, attester, trusted);
    }

    function policy(bytes32 policyId, uint32 revision) public view returns (Policy memory p) {
        p = _policies[policyId][revision];
        if (!p.exists) revert UnknownPolicy();
    }

    function attestation(bytes32 attestationId) public view returns (Attestation memory a) {
        a = _attestations[attestationId];
        if (!a.exists) revert UnknownAttestation();
    }

    function provenance(bytes32 attestationId) public view returns (Provenance memory p) {
        if (!_attestations[attestationId].exists) revert UnknownAttestation();
        p = _provenance[attestationId];
        if (!p.exists) revert UnknownAttestation();
    }

    /// @notice Legacy replay key retained for backwards-compatible reconstruction.
    function evidenceCommitment(
        bytes32 workerId,
        uint64 workerRevision,
        bytes32 policyId,
        uint32 policyRevision,
        bytes32 evidenceHash,
        address attester
    ) public view returns (bytes32) {
        if (
            workerId == bytes32(0)
                || workerRevision == 0
                || policyId == bytes32(0)
                || policyRevision == 0
                || evidenceHash == bytes32(0)
                || attester == address(0)
        ) revert InvalidAttestation();

        return keccak256(
            abi.encode(
                ATTESTATION_DOMAIN_V1,
                block.chainid,
                address(this),
                workerId,
                workerRevision,
                policyId,
                policyRevision,
                evidenceHash,
                attester
            )
        );
    }

    /// @notice Canonical provenance digest signed by an issuer or authenticated by its on-chain transaction.
    /// @dev It binds evidence type/schema/source plus the exact canonical worker/resource/profile/key subject.
    function provenanceDigest(
        bytes32 workerId,
        uint64 workerRevision,
        bytes32 policyId,
        uint32 policyRevision,
        ProvenanceClaim memory claim
    ) public view returns (bytes32) {
        if (
            workerId == bytes32(0)
                || workerRevision == 0
                || policyId == bytes32(0)
                || policyRevision == 0
                || claim.evidenceType == bytes32(0)
                || claim.schemaRevision == 0
                || claim.sourceCommitment == bytes32(0)
                || claim.evidenceHash == bytes32(0)
                || claim.issuer == address(0)
        ) revert InvalidAttestation();

        Policy memory p = policy(policyId, policyRevision);
        ComputeWorkerRegistry420.Worker memory w = workers.revision(workerId, workerRevision);

        bytes32 subjectCommitment = keccak256(
            abi.encode(
                workerId,
                workerRevision,
                w.resourceId,
                w.resourceRevision,
                w.capabilityProfileHash,
                w.executionKeyCommitment
            )
        );
        bytes32 claimCommitment = keccak256(
            abi.encode(
                claim.evidenceType,
                p.schemaHash,
                claim.schemaRevision,
                claim.sourceCommitment,
                claim.evidenceHash,
                policyId,
                policyRevision,
                claim.issuedAt,
                claim.validAfter,
                claim.expiresAt,
                claim.issuer
            )
        );

        return keccak256(
            abi.encode(
                PROVENANCE_DOMAIN_V1,
                block.chainid,
                address(this),
                subjectCommitment,
                claimCommitment
            )
        );
    }

    function deriveAttestationId(uint64 serial, bytes32 provenanceDigest_) public view returns (bytes32) {
        if (serial == 0 || provenanceDigest_ == bytes32(0)) revert InvalidAttestation();
        return keccak256(
            abi.encode(
                ATTESTATION_DOMAIN_V1,
                block.chainid,
                address(this),
                ATTESTATION_TAG,
                serial,
                provenanceDigest_
            )
        );
    }

    /// @notice Direct trusted-issuer publication. The issuer's Ethereum transaction authenticates the provenance.
    /// @dev For compatibility, evidenceHash is also the source/content commitment in this direct path.
    function attest(
        bytes32 workerId,
        uint64 workerRevision,
        bytes32 policyId,
        bytes32 evidenceHash,
        uint64 validAfter,
        uint64 expiresAt
    ) external returns (bytes32 attestationId) {
        uint32 policyRevision = latestPolicyRevision[policyId];
        if (
            policyRevision == 0
                || !acceptingNew[policyId]
                || !trustedAttester[policyId][msg.sender]
        ) revert UnauthorizedAttester();

        Policy memory p = policy(policyId, policyRevision);
        ProvenanceClaim memory claim = ProvenanceClaim({
            evidenceType: p.evidenceType,
            schemaRevision: p.schemaRevision,
            sourceCommitment: evidenceHash,
            evidenceHash: evidenceHash,
            issuedAt: uint64(block.timestamp),
            validAfter: validAfter,
            expiresAt: expiresAt,
            issuer: msg.sender
        });
        bytes32 digest = provenanceDigest(workerId, workerRevision, policyId, policyRevision, claim);
        return _record(workerId, workerRevision, policyId, policyRevision, claim, digest, PROVENANCE_AUTH_TX_V1, bytes32(0));
    }

    /// @notice Relayed publication of an independently signed, content-addressed provenance envelope.
    function attestProvenance(
        bytes32 workerId,
        uint64 workerRevision,
        bytes32 policyId,
        uint32 expectedPolicyRevision,
        ProvenanceClaim calldata claim,
        bytes calldata issuerSignature
    ) external returns (bytes32 attestationId) {
        if (
            expectedPolicyRevision == 0
                || expectedPolicyRevision != latestPolicyRevision[policyId]
                || !acceptingNew[policyId]
                || !trustedAttester[policyId][claim.issuer]
        ) revert UnauthorizedAttester();

        Policy memory p = policy(policyId, expectedPolicyRevision);
        if (claim.evidenceType != p.evidenceType || claim.schemaRevision != p.schemaRevision) {
            revert InvalidAttestation();
        }

        bytes32 digest = provenanceDigest(workerId, workerRevision, policyId, expectedPolicyRevision, claim);
        if (ECDSA420.tryRecover(digest, issuerSignature) != claim.issuer) revert UnauthorizedAttester();

        return _record(
            workerId,
            workerRevision,
            policyId,
            expectedPolicyRevision,
            claim,
            digest,
            PROVENANCE_AUTH_ECDSA_V1,
            keccak256(issuerSignature)
        );
    }

    function _record(
        bytes32 workerId,
        uint64 workerRevision,
        bytes32 policyId,
        uint32 policyRevision,
        ProvenanceClaim memory claim,
        bytes32 digest,
        bytes32 authorizationMode,
        bytes32 signatureHash
    ) private returns (bytes32 attestationId) {
        Policy memory p = policy(policyId, policyRevision);
        if (
            claim.evidenceType != p.evidenceType
                || claim.schemaRevision != p.schemaRevision
                || claim.sourceCommitment == bytes32(0)
                || claim.evidenceHash == bytes32(0)
                || claim.issuer == address(0)
                || claim.issuedAt > block.timestamp
                || claim.issuedAt > claim.validAfter
                || claim.expiresAt <= claim.validAfter
                || claim.expiresAt <= block.timestamp
                || uint256(claim.expiresAt) - uint256(claim.validAfter) > p.maxValiditySeconds
        ) revert InvalidAttestation();

        ComputeWorkerRegistry420.Worker memory w = workers.revision(workerId, workerRevision);
        bytes32 evidenceKey = evidenceCommitment(
            workerId,
            workerRevision,
            policyId,
            policyRevision,
            claim.evidenceHash,
            claim.issuer
        );
        if (usedEvidenceCommitment[evidenceKey] || usedProvenanceDigest[digest]) revert EvidenceReplayed();
        if (nextEvidenceSerial == type(uint64).max) revert SerialExhausted();

        uint64 serial = nextEvidenceSerial + 1;
        attestationId = deriveAttestationId(serial, digest);

        usedEvidenceCommitment[evidenceKey] = true;
        usedProvenanceDigest[digest] = true;
        nextEvidenceSerial = serial;
        _attestations[attestationId] = Attestation({
            workerId: workerId,
            workerRevision: workerRevision,
            resourceId: w.resourceId,
            resourceRevision: w.resourceRevision,
            capabilityProfileHash: w.capabilityProfileHash,
            executionKeyCommitment: w.executionKeyCommitment,
            policyId: policyId,
            policyRevision: policyRevision,
            evidenceHash: claim.evidenceHash,
            attester: claim.issuer,
            validAfter: claim.validAfter,
            expiresAt: claim.expiresAt,
            revoked: false,
            exists: true
        });
        _provenance[attestationId] = Provenance({
            evidenceType: claim.evidenceType,
            schemaHash: p.schemaHash,
            schemaRevision: claim.schemaRevision,
            sourceCommitment: claim.sourceCommitment,
            provenanceDigest: digest,
            authorizationMode: authorizationMode,
            signatureHash: signatureHash,
            issuedAt: claim.issuedAt,
            exists: true
        });

        emit WorkerAttested(
            attestationId,
            workerId,
            workerRevision,
            policyId,
            policyRevision,
            claim.issuer,
            claim.evidenceHash,
            claim.expiresAt
        );
        emit WorkerProvenanceAttested(
            attestationId,
            digest,
            claim.evidenceType,
            claim.schemaRevision,
            claim.sourceCommitment,
            authorizationMode
        );
    }

    function revoke(bytes32 attestationId) external {
        Attestation storage a = _attestations[attestationId];
        if (!a.exists) revert UnknownAttestation();
        if (msg.sender != a.attester && msg.sender != governanceTimelock) revert UnauthorizedAttester();
        if (a.revoked) revert InvalidAttestation();
        a.revoked = true;
        emit WorkerAttestationRevoked(attestationId, msg.sender);
    }

    /// @notice Fail-closed proof for NEW admission under the current policy revision.
    /// @dev Historical provenance remains readable after policy/issuer acceptance is later withdrawn.
    function isAcceptable(
        bytes32 attestationId,
        bytes32 workerId,
        uint64 workerRevision,
        bytes32 resourceId,
        uint64 resourceRevision,
        bytes32 capabilityProfileHash,
        bytes32 executionKeyCommitment,
        bytes32 policyId
    ) external view returns (bool) {
        Attestation storage a = _attestations[attestationId];
        Provenance storage pr = _provenance[attestationId];
        if (
            !a.exists
                || a.revoked
                || !pr.exists
                || pr.provenanceDigest == bytes32(0)
                || pr.sourceCommitment == bytes32(0)
                || a.evidenceHash == bytes32(0)
                || policyId == bytes32(0)
                || a.policyId != policyId
                || a.workerId != workerId
                || a.workerRevision != workerRevision
                || a.resourceId != resourceId
                || a.resourceRevision != resourceRevision
                || a.capabilityProfileHash != capabilityProfileHash
                || a.executionKeyCommitment != executionKeyCommitment
        ) return false;

        if (
            block.timestamp < a.validAfter
                || block.timestamp >= a.expiresAt
                || !acceptingNew[policyId]
                || a.policyRevision == 0
                || a.policyRevision != latestPolicyRevision[policyId]
                || !trustedAttester[policyId][a.attester]
        ) return false;

        Policy storage p = _policies[policyId][a.policyRevision];
        return p.exists
            && pr.evidenceType == p.evidenceType
            && pr.schemaHash == p.schemaHash
            && pr.schemaRevision == p.schemaRevision;
    }
}
