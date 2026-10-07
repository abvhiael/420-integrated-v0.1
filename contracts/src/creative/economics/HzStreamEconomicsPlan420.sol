// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../shared/CreativeTypes420.sol";
import "../shared/CreativeErrors420.sol";

/// @notice Canonical repository-side HZ-AUDIT-4 STREAM royalty economics.
/// @dev The audited kernel has canonical economic terms only for ORIGINAL and REMIX.
///      Other RecordingClass values remain unsupported for STREAM until governance
///      adopts explicit terms rather than inheriting or inventing economics implicitly.
library HzStreamEconomicsPlan420 {
    uint32 internal constant VERSION = 1;
    uint64 internal constant EFFECTIVE_AT = 0;

    uint16 internal constant ORIGINAL_WORK_BPS = 1_250;
    uint16 internal constant ORIGINAL_SOURCE_BPS = 0;
    uint16 internal constant ORIGINAL_CURRENT_BPS = 8_500;
    uint16 internal constant ORIGINAL_PROTOCOL_BPS = 250;

    uint16 internal constant REMIX_WORK_BPS = 1_000;
    uint16 internal constant REMIX_SOURCE_BPS = 1_500;
    uint16 internal constant REMIX_CURRENT_BPS = 7_250;
    uint16 internal constant REMIX_PROTOCOL_BPS = 250;

    bytes32 internal constant ORIGINAL_TERMS_HASH = keccak256(
        abi.encode(
            "420.hz.stream.schedule.v1",
            RecordingClass.ORIGINAL,
            RevenueType.STREAM,
            ORIGINAL_WORK_BPS,
            ORIGINAL_SOURCE_BPS,
            ORIGINAL_CURRENT_BPS,
            ORIGINAL_PROTOCOL_BPS,
            VERSION,
            EFFECTIVE_AT
        )
    );

    bytes32 internal constant REMIX_TERMS_HASH = keccak256(
        abi.encode(
            "420.hz.stream.schedule.v1",
            RecordingClass.REMIX,
            RevenueType.STREAM,
            REMIX_WORK_BPS,
            REMIX_SOURCE_BPS,
            REMIX_CURRENT_BPS,
            REMIX_PROTOCOL_BPS,
            VERSION,
            EFFECTIVE_AT
        )
    );

    function originalSchedule() internal pure returns (RoyaltySchedule420 memory) {
        return RoyaltySchedule420({
            workBps: ORIGINAL_WORK_BPS,
            sourceBps: ORIGINAL_SOURCE_BPS,
            currentRecordingBps: ORIGINAL_CURRENT_BPS,
            protocolBps: ORIGINAL_PROTOCOL_BPS,
            version: VERSION,
            effectiveAt: EFFECTIVE_AT,
            termsHash: ORIGINAL_TERMS_HASH
        });
    }

    function remixSchedule() internal pure returns (RoyaltySchedule420 memory) {
        return RoyaltySchedule420({
            workBps: REMIX_WORK_BPS,
            sourceBps: REMIX_SOURCE_BPS,
            currentRecordingBps: REMIX_CURRENT_BPS,
            protocolBps: REMIX_PROTOCOL_BPS,
            version: VERSION,
            effectiveAt: EFFECTIVE_AT,
            termsHash: REMIX_TERMS_HASH
        });
    }

    function scheduleFor(
        RecordingClass class_
    ) internal pure returns (RoyaltySchedule420 memory) {
        if (class_ == RecordingClass.ORIGINAL) return originalSchedule();
        if (class_ == RecordingClass.REMIX) return remixSchedule();
        revert CreativeErrors420.InvalidSchedule();
    }

    function isSupported(
        RecordingClass class_
    ) internal pure returns (bool) {
        return class_ == RecordingClass.ORIGINAL || class_ == RecordingClass.REMIX;
    }
}
