// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../shared/CreativeTypes420.sol";
import "../shared/CreativeErrors420.sol";

interface IStreamingRevenueAllocatorRoyalty420 {
    struct RecordingAllocation420 {
        uint256 playCount;
        uint256 qualifiedMs;
        uint256 revenue;
    }

    function allocatedSettlement(bytes32 settlementId) external view returns (bool);
    function allocation(bytes32 settlementId, RecordingId recordingId)
        external
        view
        returns (RecordingAllocation420 memory);
}

interface IStreamingRoyaltyRouter420 {
    function route(RecordingId recordingId, RevenueType revenueType, bytes32 settlementId) external payable;
}

/// @notice HZ-4.3 adapter from immutable streaming allocations into the canonical royalty router/vault stack.
/// @dev Governance must allowlist this contract as a settlement source on RoyaltyRouter420 before routing.
contract StreamingRoyaltySettlement420 {
    IStreamingRevenueAllocatorRoyalty420 public immutable allocator;
    IStreamingRoyaltyRouter420 public immutable royaltyRouter;

    mapping(bytes32 => mapping(uint256 => bool)) public routed;
    mapping(bytes32 => uint256) public routedRevenueOf;

    event StreamingRoyaltyRouted(
        bytes32 indexed settlementId,
        uint256 indexed recordingId,
        bytes32 indexed routeSettlementId,
        uint256 revenue
    );

    constructor(address allocator_, address royaltyRouter_) {
        if (allocator_ == address(0) || royaltyRouter_ == address(0)) {
            revert CreativeErrors420.ZeroAddress();
        }
        allocator = IStreamingRevenueAllocatorRoyalty420(allocator_);
        royaltyRouter = IStreamingRoyaltyRouter420(royaltyRouter_);
    }

    function routeRecording(bytes32 settlementId, RecordingId recordingId) external payable {
        uint256 rawRecordingId = RecordingId.unwrap(recordingId);
        if (settlementId == bytes32(0) || rawRecordingId == 0) revert CreativeErrors420.InvalidId();
        if (!allocator.allocatedSettlement(settlementId)) revert CreativeErrors420.InvalidState();
        if (routed[settlementId][rawRecordingId]) revert CreativeErrors420.AlreadyExists();

        IStreamingRevenueAllocatorRoyalty420.RecordingAllocation420 memory allocation_ =
            allocator.allocation(settlementId, recordingId);
        if (allocation_.qualifiedMs == 0 || allocation_.revenue == 0) revert CreativeErrors420.InvalidState();
        if (msg.value != allocation_.revenue) revert CreativeErrors420.InvalidState();

        bytes32 routeSettlementId = routeId(settlementId, recordingId);

        // Mark first; a downstream revert rolls this state back atomically.
        routed[settlementId][rawRecordingId] = true;
        routedRevenueOf[settlementId] += allocation_.revenue;

        royaltyRouter.route{value: allocation_.revenue}(recordingId, RevenueType.STREAM, routeSettlementId);

        emit StreamingRoyaltyRouted(settlementId, rawRecordingId, routeSettlementId, allocation_.revenue);
    }

    function routeId(bytes32 settlementId, RecordingId recordingId) public pure returns (bytes32) {
        if (settlementId == bytes32(0) || RecordingId.unwrap(recordingId) == 0) {
            revert CreativeErrors420.InvalidId();
        }
        return keccak256(abi.encode("420HZ_STREAM", settlementId, RecordingId.unwrap(recordingId)));
    }
}
