// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface ITrust420 {
    struct MetricRead {
        bytes32 domainId;
        bytes32 unitId;
        uint32 metricRevision;
        bool metricActive;
        int256 total;
        uint64 activeSignals;
    }

    /// @notice Returns one canonical metric aggregate only. No universal trust score exists in V1.
    function readMetric(bytes32 subjectType, bytes32 subjectId, bytes32 metricId)
        external
        view
        returns (MetricRead memory out);
}
