// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

/// @notice Governance-curated fail-closed risk policy for canonical oracle feeds.
contract OracleRiskPolicy420 is SystemAccess, I420System {
    struct Policy {
        uint16 minConfidenceBps;
        uint16 maxDeviationBps;
        bool halted;
        bool configured;
    }

    mapping(bytes32 => Policy) public policies;

    error InvalidFeedId();
    error InvalidConfidence();
    error InvalidDeviation();

    event RiskPolicySet(
        bytes32 indexed feedId,
        uint16 minConfidenceBps,
        uint16 maxDeviationBps,
        bool halted
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "OracleRiskPolicy420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setPolicy(bytes32 feedId, uint16 minConfidenceBps, uint16 maxDeviationBps, bool halted)
        external onlyGovernance
    {
        if (feedId == bytes32(0)) revert InvalidFeedId();
        if (minConfidenceBps > 10_000) revert InvalidConfidence();
        if (maxDeviationBps > 10_000) revert InvalidDeviation();
        policies[feedId] = Policy(minConfidenceBps, maxDeviationBps, halted, true);
        emit RiskPolicySet(feedId, minConfidenceBps, maxDeviationBps, halted);
    }

    function policy(bytes32 feedId)
        external view
        returns (uint16 minConfidenceBps, uint16 maxDeviationBps, bool halted, bool configured)
    {
        Policy memory p = policies[feedId];
        return (p.minConfidenceBps, p.maxDeviationBps, p.halted, p.configured);
    }
}
