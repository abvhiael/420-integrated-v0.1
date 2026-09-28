// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/ITrust420.sol";
import "../system/SystemAccess.sol";
import "./ComputeWorkerRegistry420.sol";

/// @notice Policy-scoped 420Trust reputation references for ComputeMarket workers.
/// @dev There is deliberately no universal worker score. Each admission policy selects exactly one
///      Trust metric/domain/unit tuple. This contract grants no correctness, custody, settlement,
///      matching, staking, slashing, governance, bridge, validator, or wallet authority.
contract ComputeWorkerTrust420 is SystemAccess, I420System {
    bytes32 public constant REFERENCE_DOMAIN_V1 =
        keccak256("420Integrated.ComputeMarket.WorkerTrustReference.v1");

    struct Policy {
        bytes32 subjectType;
        bytes32 metricId;
        bytes32 domainId;
        bytes32 unitId;
        int256 minimumTotal;
        uint64 minimumActiveSignals;
        uint32 revision;
        bool acceptingNew;
        bool exists;
    }

    struct ReputationReference {
        bytes32 workerId;
        uint64 workerRevision;
        bytes32 policyId;
        uint32 policyRevision;
        uint32 metricRevision;
        int256 total;
        uint64 activeSignals;
        bytes32 metricSnapshotCommitment;
        uint64 capturedAt;
        bool exists;
    }

    ComputeWorkerRegistry420 public immutable workers;
    ITrust420 public immutable trust;

    uint64 public nextReferenceSerial;
    mapping(bytes32 => uint32) public latestPolicyRevision;
    mapping(bytes32 => mapping(uint32 => Policy)) private _policies;
    mapping(bytes32 => ReputationReference) private _references;

    error InvalidConfiguration();
    error InvalidPolicy();
    error UnknownPolicy();
    error InvalidReference();
    error UnknownReference();
    error UnauthorizedOperator();
    error SerialExhausted();

    event ReputationPolicyPublished(
        bytes32 indexed policyId,
        uint32 indexed revision,
        bytes32 indexed metricId,
        bytes32 subjectType,
        bytes32 domainId,
        bytes32 unitId,
        int256 minimumTotal,
        uint64 minimumActiveSignals
    );
    event ReputationPolicyAcceptanceSet(bytes32 indexed policyId, bool acceptingNew);
    event ReputationReferenceCaptured(
        bytes32 indexed referenceId,
        bytes32 indexed workerId,
        uint64 indexed workerRevision,
        bytes32 policyId,
        uint32 policyRevision,
        uint32 metricRevision,
        int256 total,
        uint64 activeSignals
    );

    constructor(address workerRegistry_, address trust_, address timelock_) SystemAccess(timelock_) {
        if (
            workerRegistry_ == address(0)
                || workerRegistry_.code.length == 0
                || trust_ == address(0)
                || trust_.code.length == 0
        ) revert InvalidConfiguration();

        workers = ComputeWorkerRegistry420(workerRegistry_);
        trust = ITrust420(trust_);
    }

    function systemName() external pure returns (string memory) {
        return "ComputeWorkerTrust420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function publishPolicy(
        bytes32 policyId,
        bytes32 subjectType,
        bytes32 metricId,
        bytes32 domainId,
        bytes32 unitId,
        int256 minimumTotal,
        uint64 minimumActiveSignals
    ) external onlyGovernance returns (uint32 revision) {
        if (
            policyId == bytes32(0)
                || subjectType == bytes32(0)
                || metricId == bytes32(0)
                || domainId == bytes32(0)
                || unitId == bytes32(0)
                || minimumActiveSignals == 0
        ) revert InvalidPolicy();

        uint32 previous = latestPolicyRevision[policyId];
        if (previous == type(uint32).max) revert InvalidPolicy();

        revision = previous + 1;
        _policies[policyId][revision] = Policy({
            subjectType: subjectType,
            metricId: metricId,
            domainId: domainId,
            unitId: unitId,
            minimumTotal: minimumTotal,
            minimumActiveSignals: minimumActiveSignals,
            revision: revision,
            acceptingNew: true,
            exists: true
        });
        latestPolicyRevision[policyId] = revision;

        emit ReputationPolicyPublished(
            policyId,
            revision,
            metricId,
            subjectType,
            domainId,
            unitId,
            minimumTotal,
            minimumActiveSignals
        );
        emit ReputationPolicyAcceptanceSet(policyId, true);
    }

    function setPolicyAcceptance(bytes32 policyId, bool acceptingNew) external onlyGovernance {
        uint32 revision = latestPolicyRevision[policyId];
        if (revision == 0) revert UnknownPolicy();
        _policies[policyId][revision].acceptingNew = acceptingNew;
        emit ReputationPolicyAcceptanceSet(policyId, acceptingNew);
    }

    function policy(bytes32 policyId, uint32 revision) public view returns (Policy memory p) {
        p = _policies[policyId][revision];
        if (!p.exists) revert UnknownPolicy();
    }

    function reputationReference(bytes32 referenceId)
        external
        view
        returns (ReputationReference memory r)
    {
        r = _references[referenceId];
        if (!r.exists) revert UnknownReference();
    }

    function currentMetric(bytes32 workerId, bytes32 policyId)
        public
        view
        returns (ITrust420.MetricRead memory metric)
    {
        uint32 revision = latestPolicyRevision[policyId];
        if (revision == 0) revert UnknownPolicy();
        Policy memory p = _policies[policyId][revision];
        metric = trust.readMetric(p.subjectType, workerId, p.metricId);
    }

    function metricPasses(ITrust420.MetricRead memory metric, Policy memory p)
        public
        pure
        returns (bool)
    {
        return metric.metricActive
            && metric.domainId == p.domainId
            && metric.unitId == p.unitId
            && metric.total >= p.minimumTotal
            && metric.activeSignals >= p.minimumActiveSignals;
    }

    /// @notice Captures an immutable, policy-scoped Trust snapshot for one exact worker revision.
    /// @dev The worker operator may bind the snapshot; it cannot alter the Trust metric.
    function captureReference(bytes32 workerId, uint64 workerRevision, bytes32 policyId)
        external
        returns (bytes32 referenceId)
    {
        ComputeWorkerRegistry420.Worker memory w = workers.revision(workerId, workerRevision);
        if (msg.sender != w.operator) revert UnauthorizedOperator();

        uint32 policyRevision = latestPolicyRevision[policyId];
        if (policyRevision == 0) revert UnknownPolicy();
        Policy memory p = _policies[policyId][policyRevision];
        if (!p.acceptingNew) revert InvalidPolicy();

        ITrust420.MetricRead memory metric = trust.readMetric(p.subjectType, workerId, p.metricId);
        if (
            !metric.metricActive
                || metric.domainId != p.domainId
                || metric.unitId != p.unitId
                || metric.metricRevision == 0
        ) revert InvalidReference();

        if (nextReferenceSerial == type(uint64).max) revert SerialExhausted();
        uint64 serial = nextReferenceSerial + 1;

        bytes32 snapshotCommitment = keccak256(
            abi.encode(
                REFERENCE_DOMAIN_V1,
                block.chainid,
                address(this),
                address(trust),
                workerId,
                workerRevision,
                policyId,
                policyRevision,
                metric.domainId,
                metric.unitId,
                metric.metricRevision,
                metric.total,
                metric.activeSignals
            )
        );

        referenceId = keccak256(abi.encode(REFERENCE_DOMAIN_V1, block.chainid, address(this), serial, snapshotCommitment));
        nextReferenceSerial = serial;
        _references[referenceId] = ReputationReference({
            workerId: workerId,
            workerRevision: workerRevision,
            policyId: policyId,
            policyRevision: policyRevision,
            metricRevision: metric.metricRevision,
            total: metric.total,
            activeSignals: metric.activeSignals,
            metricSnapshotCommitment: snapshotCommitment,
            capturedAt: uint64(block.timestamp),
            exists: true
        });

        emit ReputationReferenceCaptured(
            referenceId,
            workerId,
            workerRevision,
            policyId,
            policyRevision,
            metric.metricRevision,
            metric.total,
            metric.activeSignals
        );
    }

    /// @notice Fail-closed NEW-admission predicate for a policy-specific Trust metric.
    /// @dev A historical reference may be required for reconstructability, but live Trust state must
    ///      still satisfy the current policy so revoked/corrected evidence affects future admission.
    function isEligible(
        bytes32 workerId,
        uint64 workerRevision,
        bytes32 policyId,
        bool requireReference,
        bytes32 referenceId
    ) external view returns (bool) {
        if (!workers.isEligible(workerId, workerRevision)) return false;

        uint32 policyRevision = latestPolicyRevision[policyId];
        if (policyRevision == 0) return false;
        Policy memory p = _policies[policyId][policyRevision];
        if (!p.acceptingNew) return false;

        ITrust420.MetricRead memory metric = trust.readMetric(p.subjectType, workerId, p.metricId);
        if (!metricPasses(metric, p)) return false;

        if (!requireReference) return true;
        ReputationReference storage r = _references[referenceId];
        if (
            !r.exists
                || r.workerId != workerId
                || r.workerRevision != workerRevision
                || r.policyId != policyId
                || r.policyRevision != policyRevision
                || r.metricRevision == 0
        ) return false;

        return true;
    }
}
