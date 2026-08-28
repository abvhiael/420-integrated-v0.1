// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./TrustIssuerRegistry420.sol";
import "./TrustPolicyRegistry420.sol";

contract TrustSignalRegistry420 is I420System {
    enum SignalState { NONE, ACTIVE, SUPERSEDED, REVOKED }

    struct SignalInput {
        bytes32 signalId;
        bytes32 subjectType;
        bytes32 subjectId;
        bytes32 metricId;
        bytes32 issuerId;
        int256 value;
        bytes32 evidenceRef;
        uint64 occurredAt;
    }

    struct Signal {
        bytes32 subjectType;
        bytes32 subjectId;
        bytes32 domainId;
        bytes32 metricId;
        bytes32 issuerId;
        int256 value;
        bytes32 evidenceRef;
        uint64 occurredAt;
        uint64 recordedAt;
        uint32 metricRevision;
        uint32 issuerEpoch;
        bytes32 correctionOf;
        SignalState state;
        bool exists;
    }

    struct Aggregate {
        int256 total;
        uint64 activeSignals;
    }

    TrustIssuerRegistry420 public immutable issuerRegistry;
    TrustPolicyRegistry420 public immutable policyRegistry;

    mapping(bytes32 => Signal) private _signals;
    mapping(bytes32 => bytes32) public supersededBy;
    mapping(bytes32 => bytes32) public revocationReason;
    mapping(bytes32 => bytes32) public evidenceSignal;
    mapping(bytes32 => Aggregate) private _aggregates;

    error ZeroAddress();
    error InvalidSignalId();
    error InvalidSubject();
    error InvalidEvidence();
    error InvalidOccurrenceTime();
    error SignalAlreadyExists();
    error SignalNotFound();
    error SignalNotActive();
    error UnauthorizedIssuer();
    error UnauthorizedMetricIssuer();
    error InactiveMetric();
    error EvidenceReplay();
    error InvalidReason();

    event TrustSignalRecorded(
        bytes32 indexed signalId,
        bytes32 indexed subjectId,
        bytes32 indexed metricId,
        bytes32 issuerId,
        int256 value,
        bytes32 evidenceRef,
        bytes32 correctionOf
    );
    event TrustSignalContext(
        bytes32 indexed signalId,
        bytes32 subjectType,
        bytes32 domainId,
        uint64 occurredAt,
        uint64 recordedAt,
        uint32 metricRevision,
        uint32 issuerEpoch
    );
    event TrustSignalSuperseded(bytes32 indexed oldSignalId, bytes32 indexed newSignalId);
    event TrustSignalRevoked(bytes32 indexed signalId, bytes32 indexed issuerId, bytes32 reasonHash);

    constructor(address issuerRegistry_, address policyRegistry_) {
        if (issuerRegistry_ == address(0) || policyRegistry_ == address(0)) revert ZeroAddress();
        issuerRegistry = TrustIssuerRegistry420(issuerRegistry_);
        policyRegistry = TrustPolicyRegistry420(policyRegistry_);
    }

    function systemName() external pure returns (string memory) { return "TrustSignalRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function submitSignal(SignalInput calldata input) external {
        _record(input, bytes32(0));
    }

    function correctSignal(
        bytes32 oldSignalId,
        bytes32 newSignalId,
        int256 newValue,
        bytes32 newEvidenceRef,
        uint64 occurredAt
    ) external {
        Signal storage oldSignal = _signals[oldSignalId];
        if (!oldSignal.exists) revert SignalNotFound();
        if (oldSignal.state != SignalState.ACTIVE) revert SignalNotActive();
        if (!issuerRegistry.isAuthorized(oldSignal.issuerId, msg.sender)) revert UnauthorizedIssuer();

        SignalInput memory replacement = SignalInput({
            signalId: newSignalId,
            subjectType: oldSignal.subjectType,
            subjectId: oldSignal.subjectId,
            metricId: oldSignal.metricId,
            issuerId: oldSignal.issuerId,
            value: newValue,
            evidenceRef: newEvidenceRef,
            occurredAt: occurredAt
        });

        _removeFromAggregate(oldSignal);
        oldSignal.state = SignalState.SUPERSEDED;
        supersededBy[oldSignalId] = newSignalId;
        _record(replacement, oldSignalId);
        emit TrustSignalSuperseded(oldSignalId, newSignalId);
    }

    function revokeSignal(bytes32 signalId, bytes32 reasonHash) external {
        if (reasonHash == bytes32(0)) revert InvalidReason();
        Signal storage signal = _signals[signalId];
        if (!signal.exists) revert SignalNotFound();
        if (signal.state != SignalState.ACTIVE) revert SignalNotActive();
        if (!issuerRegistry.isAuthorized(signal.issuerId, msg.sender)) revert UnauthorizedIssuer();

        _removeFromAggregate(signal);
        signal.state = SignalState.REVOKED;
        revocationReason[signalId] = reasonHash;
        emit TrustSignalRevoked(signalId, signal.issuerId, reasonHash);
    }

    function getSignal(bytes32 signalId) external view returns (Signal memory signal) {
        signal = _signals[signalId];
        if (!signal.exists) revert SignalNotFound();
    }

    function getAggregate(bytes32 subjectType, bytes32 subjectId, bytes32 metricId)
        external
        view
        returns (Aggregate memory)
    {
        return _aggregates[_aggregateKey(subjectType, subjectId, metricId)];
    }

    function aggregateKey(bytes32 subjectType, bytes32 subjectId, bytes32 metricId)
        external
        pure
        returns (bytes32)
    {
        return _aggregateKey(subjectType, subjectId, metricId);
    }

    function evidenceKey(
        bytes32 subjectType,
        bytes32 subjectId,
        bytes32 metricId,
        bytes32 issuerId,
        bytes32 evidenceRef
    ) external pure returns (bytes32) {
        return _evidenceKey(subjectType, subjectId, metricId, issuerId, evidenceRef);
    }

    function _record(SignalInput memory input, bytes32 correctionOf) private {
        if (input.signalId == bytes32(0)) revert InvalidSignalId();
        if (_signals[input.signalId].exists) revert SignalAlreadyExists();
        if (input.subjectType == bytes32(0) || input.subjectId == bytes32(0)) revert InvalidSubject();
        if (input.evidenceRef == bytes32(0)) revert InvalidEvidence();
        if (input.occurredAt == 0 || input.occurredAt > block.timestamp) revert InvalidOccurrenceTime();
        if (!issuerRegistry.isAuthorized(input.issuerId, msg.sender)) revert UnauthorizedIssuer();

        TrustPolicyRegistry420.Metric memory metric = policyRegistry.getMetric(input.metricId);
        if (!metric.active) revert InactiveMetric();
        if (!policyRegistry.isIssuerAuthorized(input.metricId, input.issuerId)) revert UnauthorizedMetricIssuer();

        bytes32 replayKey = _evidenceKey(
            input.subjectType,
            input.subjectId,
            input.metricId,
            input.issuerId,
            input.evidenceRef
        );
        if (evidenceSignal[replayKey] != bytes32(0)) revert EvidenceReplay();

        uint32 issuerEpoch = issuerRegistry.issuerEpoch(input.issuerId);
        uint64 recordedAt = uint64(block.timestamp);
        _signals[input.signalId] = Signal({
            subjectType: input.subjectType,
            subjectId: input.subjectId,
            domainId: metric.domainId,
            metricId: input.metricId,
            issuerId: input.issuerId,
            value: input.value,
            evidenceRef: input.evidenceRef,
            occurredAt: input.occurredAt,
            recordedAt: recordedAt,
            metricRevision: metric.revision,
            issuerEpoch: issuerEpoch,
            correctionOf: correctionOf,
            state: SignalState.ACTIVE,
            exists: true
        });
        evidenceSignal[replayKey] = input.signalId;

        Aggregate storage aggregate = _aggregates[_aggregateKey(input.subjectType, input.subjectId, input.metricId)];
        aggregate.total += input.value;
        aggregate.activeSignals += 1;

        _emitSignalEvents(input.signalId);
    }

    function _emitSignalEvents(bytes32 signalId) private {
        Signal storage signal = _signals[signalId];
        emit TrustSignalRecorded(
            signalId,
            signal.subjectId,
            signal.metricId,
            signal.issuerId,
            signal.value,
            signal.evidenceRef,
            signal.correctionOf
        );
        emit TrustSignalContext(
            signalId,
            signal.subjectType,
            signal.domainId,
            signal.occurredAt,
            signal.recordedAt,
            signal.metricRevision,
            signal.issuerEpoch
        );
    }

    function _removeFromAggregate(Signal storage signal) private {
        Aggregate storage aggregate = _aggregates[_aggregateKey(signal.subjectType, signal.subjectId, signal.metricId)];
        aggregate.total -= signal.value;
        aggregate.activeSignals -= 1;
    }

    function _aggregateKey(bytes32 subjectType, bytes32 subjectId, bytes32 metricId)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(subjectType, subjectId, metricId));
    }

    function _evidenceKey(
        bytes32 subjectType,
        bytes32 subjectId,
        bytes32 metricId,
        bytes32 issuerId,
        bytes32 evidenceRef
    ) private pure returns (bytes32) {
        return keccak256(abi.encode(subjectType, subjectId, metricId, issuerId, evidenceRef));
    }
}
