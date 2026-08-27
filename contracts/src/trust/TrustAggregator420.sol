// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./TrustSignalRegistry420.sol";
import "./TrustPolicyRegistry420.sol";

contract TrustAggregator420 is I420System {
    TrustSignalRegistry420 public immutable signalRegistry;
    TrustPolicyRegistry420 public immutable policyRegistry;

    error ZeroAddress();

    struct MetricRead {
        bytes32 domainId;
        bytes32 unitId;
        uint32 metricRevision;
        bool metricActive;
        int256 total;
        uint64 activeSignals;
    }

    constructor(address signalRegistry_, address policyRegistry_) {
        if (signalRegistry_ == address(0) || policyRegistry_ == address(0)) revert ZeroAddress();
        signalRegistry = TrustSignalRegistry420(signalRegistry_);
        policyRegistry = TrustPolicyRegistry420(policyRegistry_);
    }

    function systemName() external pure returns (string memory) { return "TrustAggregator420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    /// @notice Returns one metric only. 420Trust deliberately exposes no global score.
    function readMetric(bytes32 subjectType, bytes32 subjectId, bytes32 metricId)
        external
        view
        returns (MetricRead memory out)
    {
        TrustPolicyRegistry420.Metric memory metric = policyRegistry.getMetric(metricId);
        TrustSignalRegistry420.Aggregate memory aggregate = signalRegistry.getAggregate(subjectType, subjectId, metricId);
        out = MetricRead({
            domainId: metric.domainId,
            unitId: metric.unitId,
            metricRevision: metric.revision,
            metricActive: metric.active,
            total: aggregate.total,
            activeSignals: aggregate.activeSignals
        });
    }
}
