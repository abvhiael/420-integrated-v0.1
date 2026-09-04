// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";
import "./MediaIds420.sol";

contract MediaSLA420 is SystemAccess, I420System {
    struct Policy {
        uint32 maxStartDelayMs;
        uint32 maxProcessingMs;
        uint16 minAvailabilityBps;
        bytes32 metadataHash;
        uint32 revision;
        bool active;
        bool exists;
    }

    struct Attestation {
        bytes32 outcome;
        bytes32 evidenceHash;
        address reporter;
        uint64 reportedAt;
        bool exists;
    }

    mapping(bytes32 => Policy) public policies;
    mapping(bytes32 => Attestation) public attestations;
    mapping(address => bool) public reporters;

    error InvalidPolicy();
    error PolicyExists();
    error PolicyNotFound();
    error InvalidReporter();
    error InvalidOutcome();
    error InvalidEvidence();
    error AttestationExists();
    error NoChange();

    event ReporterSet(address indexed reporter, bool allowed);
    event PolicyRegistered(bytes32 indexed policyId, uint32 maxStartDelayMs, uint32 maxProcessingMs, uint16 minAvailabilityBps, bytes32 metadataHash);
    event PolicyStateChanged(bytes32 indexed policyId, bool active, uint32 revision);
    event PolicyUpdated(bytes32 indexed policyId, uint32 revision);
    event SLAReported(bytes32 indexed jobId, bytes32 indexed outcome, bytes32 evidenceHash, address indexed reporter);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "MediaSLA420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setReporter(address reporter, bool allowed) external onlyGovernance {
        if (reporter == address(0)) revert ZeroAddress();
        if (reporters[reporter] == allowed) revert NoChange();
        reporters[reporter] = allowed;
        emit ReporterSet(reporter, allowed);
    }

    function registerPolicy(
        bytes32 policyId,
        uint32 maxStartDelayMs,
        uint32 maxProcessingMs,
        uint16 minAvailabilityBps,
        bytes32 metadataHash
    ) external onlyGovernance {
        if (policyId == bytes32(0) || minAvailabilityBps > 10_000) revert InvalidPolicy();
        if (policies[policyId].exists) revert PolicyExists();
        policies[policyId] = Policy({
            maxStartDelayMs: maxStartDelayMs,
            maxProcessingMs: maxProcessingMs,
            minAvailabilityBps: minAvailabilityBps,
            metadataHash: metadataHash,
            revision: 1,
            active: true,
            exists: true
        });
        emit PolicyRegistered(policyId, maxStartDelayMs, maxProcessingMs, minAvailabilityBps, metadataHash);
    }

    function updatePolicy(
        bytes32 policyId,
        uint32 maxStartDelayMs,
        uint32 maxProcessingMs,
        uint16 minAvailabilityBps,
        bytes32 metadataHash
    ) external onlyGovernance {
        if (minAvailabilityBps > 10_000) revert InvalidPolicy();
        Policy storage p = _get(policyId);
        p.maxStartDelayMs = maxStartDelayMs;
        p.maxProcessingMs = maxProcessingMs;
        p.minAvailabilityBps = minAvailabilityBps;
        p.metadataHash = metadataHash;
        p.revision += 1;
        emit PolicyUpdated(policyId, p.revision);
    }

    function setActive(bytes32 policyId, bool active) external onlyGovernance {
        Policy storage p = _get(policyId);
        if (p.active == active) revert NoChange();
        p.active = active;
        p.revision += 1;
        emit PolicyStateChanged(policyId, active, p.revision);
    }

    function report(bytes32 jobId, bytes32 outcome, bytes32 evidenceHash) external {
        if (!reporters[msg.sender]) revert InvalidReporter();
        if (jobId == bytes32(0) || evidenceHash == bytes32(0)) revert InvalidEvidence();
        if (outcome != MediaIds420.SLA_PASS && outcome != MediaIds420.SLA_FAIL) revert InvalidOutcome();
        if (attestations[jobId].exists) revert AttestationExists();
        attestations[jobId] = Attestation({
            outcome: outcome,
            evidenceHash: evidenceHash,
            reporter: msg.sender,
            reportedAt: uint64(block.timestamp),
            exists: true
        });
        emit SLAReported(jobId, outcome, evidenceHash, msg.sender);
    }

    function isActive(bytes32 policyId) external view returns (bool) {
        Policy storage p = policies[policyId];
        return p.exists && p.active;
    }

    function passed(bytes32 jobId) external view returns (bool) {
        Attestation storage a = attestations[jobId];
        return a.exists && a.outcome == MediaIds420.SLA_PASS;
    }

    function failed(bytes32 jobId) external view returns (bool) {
        Attestation storage a = attestations[jobId];
        return a.exists && a.outcome == MediaIds420.SLA_FAIL;
    }

    function hasAttestation(bytes32 jobId) external view returns (bool) {
        return attestations[jobId].exists;
    }

    function _get(bytes32 policyId) private view returns (Policy storage p) {
        p = policies[policyId];
        if (!p.exists) revert PolicyNotFound();
    }
}
