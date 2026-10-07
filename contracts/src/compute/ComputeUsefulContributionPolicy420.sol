// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";

/// @notice CMP-6.3 append-only authority for contribution measurement sources and metric semantics.
/// @dev Policy publication cannot record contributions, move value, select reward rates, or pay anyone.
contract ComputeUsefulContributionPolicy420 is SystemAccess, I420System {
    bytes32 public constant POLICY_DOMAIN =
        keccak256("420Integrated.ComputeMarket.UsefulContributionPolicy.v1");

    uint8 public constant METRIC_WORK_UNITS = 1;
    uint8 public constant METRIC_CPU_MILLISECONDS = 2;
    uint8 public constant METRIC_GPU_MILLISECONDS = 3;
    uint8 public constant METRIC_PROJECT_CREDIT = 4;
    uint8 public constant METRIC_CUSTOM = 5;

    struct Policy {
        bytes32 policyId;
        uint8 metricKind;
        bytes32 metricId;
        address source;
        bytes32 sourceCodeHash;
        uint256 maxAmount;
        uint64 publishedAt;
        uint32 revision;
        bool exists;
    }

    mapping(bytes32 => uint32) public latestRevision;
    mapping(bytes32 => mapping(uint32 => Policy)) private _policies;

    error InvalidPolicy();
    error UnknownPolicy();
    error RevisionOverflow();

    event ContributionPolicyPublished(
        bytes32 indexed policyId,
        uint32 indexed revision,
        uint8 indexed metricKind,
        bytes32 metricId,
        address source,
        uint256 maxAmount,
        bytes32 commitment
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) {
        return "ComputeUsefulContributionPolicy420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function publish(
        bytes32 policyId,
        uint8 metricKind,
        bytes32 metricId,
        address source,
        uint256 maxAmount
    ) external onlyGovernance returns (uint32 revision) {
        if (
            policyId == bytes32(0)
                || metricKind < METRIC_WORK_UNITS
                || metricKind > METRIC_CUSTOM
                || metricId == bytes32(0)
                || source.code.length == 0
                || maxAmount == 0
        ) revert InvalidPolicy();

        uint32 previous = latestRevision[policyId];
        if (previous == type(uint32).max) revert RevisionOverflow();
        revision = previous + 1;

        _policies[policyId][revision] = Policy({
            policyId: policyId,
            metricKind: metricKind,
            metricId: metricId,
            source: source,
            sourceCodeHash: source.codehash,
            maxAmount: maxAmount,
            publishedAt: uint64(block.timestamp),
            revision: revision,
            exists: true
        });
        latestRevision[policyId] = revision;

        emit ContributionPolicyPublished(
            policyId,
            revision,
            metricKind,
            metricId,
            source,
            maxAmount,
            commitment(policyId, revision)
        );
    }

    function policy(bytes32 policyId, uint32 revision)
        public
        view
        returns (Policy memory p)
    {
        p = _policies[policyId][revision];
        if (!p.exists) revert UnknownPolicy();
    }

    function commitment(bytes32 policyId, uint32 revision)
        public
        view
        returns (bytes32)
    {
        Policy memory p = policy(policyId, revision);
        return keccak256(
            abi.encode(
                POLICY_DOMAIN,
                block.chainid,
                address(this),
                p.policyId,
                p.metricKind,
                p.metricId,
                p.source,
                p.sourceCodeHash,
                p.maxAmount,
                p.publishedAt,
                p.revision
            )
        );
    }
}
