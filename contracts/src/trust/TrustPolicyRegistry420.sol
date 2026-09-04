// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

contract TrustPolicyRegistry420 is SystemAccess, I420System {
    struct Metric {
        bytes32 domainId;
        bytes32 unitId;
        bytes32 metadataHash;
        uint32 revision;
        bool active;
        bool exists;
    }

    mapping(bytes32 => Metric) private _metrics;
    mapping(bytes32 => mapping(bytes32 => bool)) public issuerAuthorized;

    error InvalidMetricId();
    error InvalidDomainId();
    error InvalidUnitId();
    error MetricNotFound();
    error InvalidIssuerId();
    error MetricSemanticChange();

    event MetricConfigured(
        bytes32 indexed metricId,
        bytes32 indexed domainId,
        bytes32 unitId,
        bytes32 metadataHash,
        uint32 revision,
        bool active
    );
    event MetricIssuerAuthorizationSet(bytes32 indexed metricId, bytes32 indexed issuerId, bool authorized);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "TrustPolicyRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setMetric(
        bytes32 metricId,
        bytes32 domainId,
        bytes32 unitId,
        bytes32 metadataHash,
        bool active
    ) external onlyGovernance {
        if (metricId == bytes32(0)) revert InvalidMetricId();
        if (domainId == bytes32(0)) revert InvalidDomainId();
        if (unitId == bytes32(0)) revert InvalidUnitId();

        Metric storage metric = _metrics[metricId];
        if (metric.exists && (metric.domainId != domainId || metric.unitId != unitId)) {
            revert MetricSemanticChange();
        }

        uint32 nextRevision = metric.exists ? metric.revision + 1 : 1;
        metric.domainId = domainId;
        metric.unitId = unitId;
        metric.metadataHash = metadataHash;
        metric.revision = nextRevision;
        metric.active = active;
        metric.exists = true;

        emit MetricConfigured(metricId, domainId, unitId, metadataHash, nextRevision, active);
    }

    function setIssuerAuthorization(bytes32 metricId, bytes32 issuerId, bool authorized)
        external
        onlyGovernance
    {
        if (!_metrics[metricId].exists) revert MetricNotFound();
        if (issuerId == bytes32(0)) revert InvalidIssuerId();
        issuerAuthorized[metricId][issuerId] = authorized;
        emit MetricIssuerAuthorizationSet(metricId, issuerId, authorized);
    }

    function getMetric(bytes32 metricId) external view returns (Metric memory metric) {
        metric = _metrics[metricId];
        if (!metric.exists) revert MetricNotFound();
    }

    function isIssuerAuthorized(bytes32 metricId, bytes32 issuerId) external view returns (bool) {
        return _metrics[metricId].exists && _metrics[metricId].active && issuerAuthorized[metricId][issuerId];
    }
}
