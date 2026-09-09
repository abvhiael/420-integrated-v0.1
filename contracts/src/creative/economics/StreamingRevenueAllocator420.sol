// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../shared/CreativeTypes420.sol";
import "../shared/CreativeErrors420.sol";

interface IStreamingSettlementEpoch420 {
    enum EpochState { NONE, COMMITTED, FINALIZED }
    struct SettlementEpoch420 {
        uint64 playbackEpoch;
        uint64 committedAt;
        uint64 finalizedAt;
        uint256 totalPlayCount;
        uint256 totalQualifiedMs;
        uint256 grossRevenue;
        bytes32 playbackRoot;
        bytes32 revenueRoot;
        EpochState state;
    }
    function epoch(bytes32 settlementId) external view returns (SettlementEpoch420 memory);
}

interface IStreamingPlaybackAccounting420 {
    struct RecordingAggregate420 {
        uint256 playCount;
        uint256 qualifiedMs;
    }
    function epochAggregate(uint64 epoch, RecordingId recordingId)
        external
        view
        returns (RecordingAggregate420 memory);
}

/// @notice HZ-4.2 deterministic per-recording streaming revenue allocation.
/// @dev Allocations are derived from finalized HZ-4.1 epochs and canonical HZ-3 playback aggregates.
contract StreamingRevenueAllocator420 {
    uint256 public constant MAX_RECORDINGS_PER_ALLOCATION = 100;

    struct RecordingAllocation420 {
        uint256 playCount;
        uint256 qualifiedMs;
        uint256 revenue;
    }

    IStreamingSettlementEpoch420 public immutable settlements;
    IStreamingPlaybackAccounting420 public immutable playbackAccounting;

    mapping(bytes32 => bool) public allocatedSettlement;
    mapping(bytes32 => bytes32) public allocationRootOf;
    mapping(bytes32 => uint256) public allocatedRevenueOf;
    mapping(bytes32 => mapping(uint256 => RecordingAllocation420)) private _allocations;

    event SettlementAllocated(
        bytes32 indexed settlementId,
        uint64 indexed playbackEpoch,
        bytes32 indexed allocationRoot,
        uint256 recordingCount,
        uint256 allocatedRevenue
    );

    constructor(address settlements_, address playbackAccounting_) {
        if (settlements_ == address(0) || playbackAccounting_ == address(0)) {
            revert CreativeErrors420.ZeroAddress();
        }
        settlements = IStreamingSettlementEpoch420(settlements_);
        playbackAccounting = IStreamingPlaybackAccounting420(playbackAccounting_);
    }

    function allocate(bytes32 settlementId, RecordingId[] calldata recordingIds) external {
        if (settlementId == bytes32(0)) revert CreativeErrors420.InvalidId();
        if (allocatedSettlement[settlementId]) revert CreativeErrors420.AlreadyExists();

        IStreamingSettlementEpoch420.SettlementEpoch420 memory settlement = settlements.epoch(settlementId);
        if (settlement.state != IStreamingSettlementEpoch420.EpochState.FINALIZED) {
            revert CreativeErrors420.InvalidState();
        }

        uint256 length = recordingIds.length;
        if (length == 0 || length > MAX_RECORDINGS_PER_ALLOCATION) revert CreativeErrors420.InvalidState();

        uint256 totalPlayCount;
        uint256 totalQualifiedMs;
        uint256 allocatedRevenue;
        bytes32 rollingRoot;
        uint256 previousId;

        for (uint256 i = 0; i < length; ++i) {
            uint256 rawId = RecordingId.unwrap(recordingIds[i]);
            if (rawId == 0) revert CreativeErrors420.InvalidId();
            if (i != 0 && rawId <= previousId) revert CreativeErrors420.InvalidState();
            previousId = rawId;

            IStreamingPlaybackAccounting420.RecordingAggregate420 memory aggregate =
                playbackAccounting.epochAggregate(settlement.playbackEpoch, recordingIds[i]);
            if (aggregate.playCount == 0 || aggregate.qualifiedMs == 0) revert CreativeErrors420.InvalidState();

            totalPlayCount += aggregate.playCount;
            totalQualifiedMs += aggregate.qualifiedMs;

            uint256 revenue;
            if (i + 1 == length) {
                if (totalQualifiedMs != settlement.totalQualifiedMs || totalPlayCount != settlement.totalPlayCount) {
                    revert CreativeErrors420.InvalidState();
                }
                revenue = settlement.grossRevenue - allocatedRevenue;
            } else {
                revenue = (settlement.grossRevenue * aggregate.qualifiedMs) / settlement.totalQualifiedMs;
                allocatedRevenue += revenue;
            }

            _allocations[settlementId][rawId] = RecordingAllocation420({
                playCount: aggregate.playCount,
                qualifiedMs: aggregate.qualifiedMs,
                revenue: revenue
            });
            if (i + 1 == length) allocatedRevenue += revenue;

            rollingRoot = keccak256(
                abi.encode(rollingRoot, rawId, aggregate.playCount, aggregate.qualifiedMs, revenue)
            );
        }

        if (allocatedRevenue != settlement.grossRevenue) revert CreativeErrors420.InvalidState();

        allocatedSettlement[settlementId] = true;
        allocationRootOf[settlementId] = rollingRoot;
        allocatedRevenueOf[settlementId] = allocatedRevenue;

        emit SettlementAllocated(
            settlementId,
            settlement.playbackEpoch,
            rollingRoot,
            length,
            allocatedRevenue
        );
    }

    function allocation(bytes32 settlementId, RecordingId recordingId)
        external
        view
        returns (RecordingAllocation420 memory)
    {
        if (settlementId == bytes32(0) || RecordingId.unwrap(recordingId) == 0) {
            revert CreativeErrors420.InvalidId();
        }
        RecordingAllocation420 memory result = _allocations[settlementId][RecordingId.unwrap(recordingId)];
        if (result.qualifiedMs == 0) revert CreativeErrors420.NotFound();
        return result;
    }
}
