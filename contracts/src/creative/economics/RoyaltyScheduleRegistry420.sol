// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../system/SystemAccess.sol";
import "../shared/CreativeTypes420.sol";
import "../shared/CreativeErrors420.sol";
import "../shared/CreativeEvents420.sol";

contract RoyaltyScheduleRegistry420 is SystemAccess, CreativeEvents420 {
    mapping(bytes32 => RoyaltySchedule420) private _schedules;

    constructor(address governanceTimelock_) SystemAccess(governanceTimelock_) {}

    function registerSchedule(
        RecordingClass recordingClass,
        RevenueType revenueType,
        RoyaltySchedule420 calldata schedule
    ) external onlyGovernance {
        uint256 total = uint256(schedule.workBps) + schedule.sourceBps + schedule.currentRecordingBps + schedule.protocolBps;
        if (schedule.version == 0 || total != CreativeConstants420.BPS_DENOMINATOR) revert CreativeErrors420.InvalidSchedule();
        if (schedule.protocolBps > CreativeConstants420.MAX_PROTOCOL_FEE_BPS) {
            revert CreativeErrors420.ProtocolFeeTooHigh(schedule.protocolBps);
        }
        bytes32 key = scheduleKey(recordingClass, revenueType, schedule.version);
        if (_schedules[key].version != 0) revert CreativeErrors420.AlreadyExists();
        _schedules[key] = schedule;
        emit RoyaltyScheduleRegistered(uint8(recordingClass), uint8(revenueType), schedule.version, keccak256(abi.encode(schedule)));
    }

    function schedule(
        RecordingClass recordingClass,
        RevenueType revenueType,
        uint32 version
    ) external view returns (RoyaltySchedule420 memory) {
        RoyaltySchedule420 storage value = _schedules[scheduleKey(recordingClass, revenueType, version)];
        if (value.version == 0) revert CreativeErrors420.NotFound();
        return value;
    }

    function scheduleKey(RecordingClass recordingClass, RevenueType revenueType, uint32 version)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(recordingClass, revenueType, version));
    }
}
