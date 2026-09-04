// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../shared/CreativeTypes420.sol";
import "../shared/CreativeErrors420.sol";
import "../shared/CreativeEvents420.sol";

interface IRouterRecordingRegistry420 {
    function royaltyContext(RecordingId recordingId)
        external view returns (WorkId workId, RecordingId parentRecordingId, RecordingClass recordingClass, uint32 scheduleVersion);
    function statusOf(RecordingId recordingId) external view returns (AssetStatus);
}

interface IRouterScheduleRegistry420 {
    function schedule(RecordingClass recordingClass, RevenueType revenueType, uint32 version)
        external view returns (RoyaltySchedule420 memory);
}

interface IRouterRoyaltyVault420 {
    function depositPool(bytes32 assetKey) external payable;
    function depositTreasury() external payable;
}

contract RoyaltyRouter420 is CreativeEvents420 {
    struct RouteContext {
        WorkId workId;
        RecordingId parentId;
        RecordingClass recordingClass;
        uint32 scheduleVersion;
    }

    struct RouteAmounts {
        uint256 workAmount;
        uint256 sourceAmount;
        uint256 currentAmount;
        uint256 protocolAmount;
    }

    address public immutable governanceTimelock;
    IRouterRecordingRegistry420 public immutable recordings;
    IRouterScheduleRegistry420 public immutable schedules;
    IRouterRoyaltyVault420 public immutable vault;

    mapping(address => bool) public settlementSource;
    mapping(bytes32 => bool) public processedSettlement;

    constructor(address governanceTimelock_, address recordingRegistry_, address scheduleRegistry_, address royaltyVault_) {
        if (
            governanceTimelock_ == address(0) || recordingRegistry_ == address(0) || scheduleRegistry_ == address(0)
                || royaltyVault_ == address(0)
        ) revert CreativeErrors420.ZeroAddress();
        governanceTimelock = governanceTimelock_;
        recordings = IRouterRecordingRegistry420(recordingRegistry_);
        schedules = IRouterScheduleRegistry420(scheduleRegistry_);
        vault = IRouterRoyaltyVault420(royaltyVault_);
    }

    function setSettlementSource(address source, bool allowed) external {
        if (msg.sender != governanceTimelock) revert CreativeErrors420.Unauthorized();
        if (source == address(0)) revert CreativeErrors420.ZeroAddress();
        settlementSource[source] = allowed;
    }

    function route(RecordingId recordingId, RevenueType revenueType, bytes32 settlementId) external payable {
        _validateRoute(recordingId, revenueType, settlementId);
        RouteContext memory context = _context(recordingId);
        RoyaltySchedule420 memory schedule_ = schedules.schedule(context.recordingClass, revenueType, context.scheduleVersion);
        if (block.timestamp < schedule_.effectiveAt) revert CreativeErrors420.InvalidSchedule();

        RouteAmounts memory amounts = _amounts(msg.value, schedule_);
        if (amounts.sourceAmount != 0 && RecordingId.unwrap(context.parentId) == 0) {
            revert CreativeErrors420.InvalidSource();
        }

        processedSettlement[settlementId] = true;
        _deposit(context, recordingId, amounts);
        emit RoyaltyRouted(settlementId, RecordingId.unwrap(recordingId), uint8(revenueType), msg.value);
    }

    function _validateRoute(RecordingId recordingId, RevenueType revenueType, bytes32 settlementId) internal view {
        if (!settlementSource[msg.sender]) revert CreativeErrors420.Unauthorized();
        if (settlementId == bytes32(0) || RecordingId.unwrap(recordingId) == 0) revert CreativeErrors420.InvalidId();
        if (processedSettlement[settlementId]) revert CreativeErrors420.RevenueAlreadyProcessed(settlementId);
        if (revenueType == RevenueType.TIP || revenueType == RevenueType.AI_TRAINING) {
            revert CreativeErrors420.InvalidState();
        }
        if (recordings.statusOf(recordingId) != AssetStatus.ACTIVE) revert CreativeErrors420.InvalidState();
    }

    function _context(RecordingId recordingId) internal view returns (RouteContext memory context) {
        (context.workId, context.parentId, context.recordingClass, context.scheduleVersion) =
            recordings.royaltyContext(recordingId);
    }

    function _amounts(uint256 gross, RoyaltySchedule420 memory schedule_)
        internal
        pure
        returns (RouteAmounts memory amounts)
    {
        amounts.workAmount = (gross * schedule_.workBps) / CreativeConstants420.BPS_DENOMINATOR;
        amounts.sourceAmount = (gross * schedule_.sourceBps) / CreativeConstants420.BPS_DENOMINATOR;
        amounts.protocolAmount = (gross * schedule_.protocolBps) / CreativeConstants420.BPS_DENOMINATOR;
        amounts.currentAmount = gross - amounts.workAmount - amounts.sourceAmount - amounts.protocolAmount;
    }

    function _deposit(RouteContext memory context, RecordingId recordingId, RouteAmounts memory amounts) internal {
        if (amounts.workAmount != 0) {
            vault.depositPool{value: amounts.workAmount}(
                CreativeAssetKeys420.key(CreativeAssetType.WORK, WorkId.unwrap(context.workId))
            );
        }
        if (amounts.sourceAmount != 0) {
            vault.depositPool{value: amounts.sourceAmount}(
                CreativeAssetKeys420.key(CreativeAssetType.RECORDING, RecordingId.unwrap(context.parentId))
            );
        }
        if (amounts.currentAmount != 0) {
            vault.depositPool{value: amounts.currentAmount}(
                CreativeAssetKeys420.key(CreativeAssetType.RECORDING, RecordingId.unwrap(recordingId))
            );
        }
        if (amounts.protocolAmount != 0) vault.depositTreasury{value: amounts.protocolAmount}();
    }
}
