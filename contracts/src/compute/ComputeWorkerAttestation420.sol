// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";
import "./ComputeWorkerRegistry420.sol";

/// @notice Provider-neutral evidence registry for independently qualified ComputeMarket worker capabilities.
/// @dev Evidence is immutable and bound to one exact worker revision/profile/key/resource revision.
///      This contract grants no worker, verifier, custody, settlement, staking, or slashing authority.
contract ComputeWorkerAttestation420 is SystemAccess, I420System {
    bytes32 public constant ATTESTATION_DOMAIN_V1 = keccak256("420Integrated.ComputeMarket.WorkerAttestation.v1");
    bytes32 public constant ATTESTATION_TAG = keccak256("WORKER_ATTESTATION");
    bytes32 public constant EVIDENCE_BENCHMARK_V1 = keccak256("420/COMPUTE/ATTESTATION/BENCHMARK/V1");
    bytes32 public constant EVIDENCE_TEE_V1 = keccak256("420/COMPUTE/ATTESTATION/TEE/V1");
    bytes32 public constant EVIDENCE_INSPECTION_V1 = keccak256("420/COMPUTE/ATTESTATION/INSPECTION/V1");

    struct Policy {
        bytes32 evidenceType;
        bytes32 schemaHash;
        uint64 maxValiditySeconds;
        uint32 revision;
        bool exists;
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

    ComputeWorkerRegistry420 public immutable workers;
    uint64 public nextEvidenceSerial;

    mapping(bytes32 => uint32) public latestPolicyRevision;
    mapping(bytes32 => mapping(uint32 => Policy)) private _policies;
    mapping(bytes32 => bool) public acceptingNew;
    mapping(bytes32 => mapping(address => bool)) public trustedAttester;
    mapping(bytes32 => Attestation) private _attestations;
    mapping(bytes32 => bool) public usedEvidenceCommitment;

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
    event WorkerAttestationRevoked(bytes32 indexed attestationId, address indexed actor);

    constructor(address workerRegistry_, address timelock_) SystemAccess(timelock_) {
        if (workerRegistry_ == address(0) || workerRegistry_.code.length == 0) revert InvalidAttestation();
        workers = ComputeWorkerRegistry420(workerRegistry_);
    }

    function systemName() external pure returns (string memory) { return "ComputeWorkerAttestation420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function supportedEvidenceType(bytes32 evidenceType) public pure returns (bool) {
        return evidenceType == EVIDENCE_BENCHMARK_V1
            || evidenceType == EVIDENCE_TEE_V1
            || evidenceType == EVIDENCE_INSPECTION_V1;
    }

    function publishPolicy(
        bytes32 policyId,
        bytes32 evidenceType,
        bytes32 schemaHash,
        uint64 maxValiditySeconds
    ) external onlyGovernance returns (uint32 revision) {
        if (
            policyId == bytes32(0)
                || !supportedEvidenceType(evidenceType)
                || schemaHash == bytes32(0)
                || maxValiditySeconds == 0
        ) revert InvalidPolicy();

        uint32 previous = latestPolicyRevision[policyId];
        if (previous == type(uint32).max) revert InvalidPolicy();
        if (previous != 0 && _policies[policyId][previous].evidenceType != evidenceType) {
            revert InvalidPolicy();
        }

        revision = previous + 1;
        _policies[policyId][revision] = Policy({
            evidenceType: evidenceType,
            schemaHash: schemaHash,
            maxValiditySeconds: maxValiditySeconds,
            revision: revision,
            exists: true
        });
        latestPolicyRevision[policyId] = revision;
        acceptingNew[policyId] = true;

        emit PolicyPublished(policyId, revision, evidenceType, schemaHash, maxValiditySeconds);
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

    function deriveAttestationId(
        uint64 serial,
        bytes32 workerId,
        uint64 workerRevision,
        bytes32 policyId,
        uint32 policyRevision,
        bytes32 evidenceHash,
        address attester
    ) public view returns (bytes32) {
        if (serial == 0) revert InvalidAttestation();
        return keccak256(
            abi.encode(
                ATTESTATION_DOMAIN_V1,
                block.chainid,
                address(this),
                ATTESTATION_TAG,
                serial,
                evidenceCommitment(workerId, workerRevision, policyId, policyRevision, evidenceHash, attester)
            )
        );
    }

    /// @notice Publishes independently produced evidence for one exact canonical worker revision.
    /// @dev Canonical worker/resource/key/profile fields are read from the worker history; the attester
    ///      cannot substitute a different subject into the evidence record.
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
        if (
            evidenceHash == bytes32(0)
                || expiresAt <= validAfter
                || expiresAt <= block.timestamp
        ) revert InvalidAttestation();

        Policy memory p = policy(policyId, policyRevision);
        if (uint256(expiresAt) - uint256(validAfter) > p.maxValiditySeconds) {
            revert InvalidAttestation();
        }

        ComputeWorkerRegistry420.Worker memory w = workers.revision(workerId, workerRevision);
        bytes32 evidenceKey = evidenceCommitment(
            workerId,
            workerRevision,
            policyId,
            policyRevision,
            evidenceHash,
            msg.sender
        );
        if (usedEvidenceCommitment[evidenceKey]) revert EvidenceReplayed();
        if (nextEvidenceSerial == type(uint64).max) revert SerialExhausted();

        uint64 serial = nextEvidenceSerial + 1;
        attestationId = deriveAttestationId(
            serial,
            workerId,
            workerRevision,
            policyId,
            policyRevision,
            evidenceHash,
            msg.sender
        );

        usedEvidenceCommitment[evidenceKey] = true;
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
            evidenceHash: evidenceHash,
            attester: msg.sender,
            validAfter: validAfter,
            expiresAt: expiresAt,
            revoked: false,
            exists: true
        });

        emit WorkerAttested(
            attestationId,
            workerId,
            workerRevision,
            policyId,
            policyRevision,
            msg.sender,
            evidenceHash,
            expiresAt
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
    /// @dev Historical evidence remains readable even if policy/attester acceptance is later withdrawn.
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
        if (
            !a.exists
                || a.revoked
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

        return _policies[policyId][a.policyRevision].exists;
    }
}
