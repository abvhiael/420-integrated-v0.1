// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Executable reference model for the V13.5 live market-data stream.
/// @dev Transport-neutral read model for WebSocket/SSE implementations. No protocol authority.
contract ExchangeLiveMarketData420 {
    uint16 public constant SCHEMA_MAJOR = 13;
    uint16 public constant SCHEMA_MINOR = 5;
    uint16 public constant MAX_RESUME_PAGE = 100;

    enum EventKind {
        DATA,
        HEARTBEAT,
        REORG,
        REPLACEMENT
    }

    struct StreamEvent {
        uint64 sequence;
        EventKind kind;
        bytes32 subjectId;
        bytes32 recordId;
        bytes32 affectedRecordId;
        bytes32 replacementRecordId;
        uint64 canonicalHead;
        uint64 observedAt;
        uint64 emittedAt;
        bytes32 payloadHash;
    }

    struct ResumePage {
        StreamEvent[] events;
        bytes32 nextCursor;
        bool hasMore;
        uint64 latestSequence;
        uint64 latestEmittedAt;
    }

    StreamEvent[] private _events;
    uint64 public latestSequence;
    uint64 public latestEmittedAt;

    error InvalidEvent();
    error InvalidPageSize();
    error InvalidCursor();
    error TimeRegression();

    event StreamEventAppended(
        uint64 indexed sequence,
        EventKind indexed kind,
        bytes32 indexed subjectId,
        bytes32 recordId
    );

    function append(
        EventKind kind,
        bytes32 subjectId,
        bytes32 recordId,
        bytes32 affectedRecordId,
        bytes32 replacementRecordId,
        uint64 canonicalHead,
        uint64 observedAt,
        uint64 emittedAt,
        bytes32 payloadHash
    ) external returns (uint64 sequence) {
        _validate(
            kind,
            subjectId,
            recordId,
            affectedRecordId,
            replacementRecordId,
            canonicalHead,
            observedAt,
            emittedAt,
            payloadHash
        );

        if (emittedAt < latestEmittedAt) revert TimeRegression();

        sequence = latestSequence + 1;
        latestSequence = sequence;
        latestEmittedAt = emittedAt;

        _events.push(
            StreamEvent({
                sequence: sequence,
                kind: kind,
                subjectId: subjectId,
                recordId: recordId,
                affectedRecordId: affectedRecordId,
                replacementRecordId: replacementRecordId,
                canonicalHead: canonicalHead,
                observedAt: observedAt,
                emittedAt: emittedAt,
                payloadHash: payloadHash
            })
        );

        emit StreamEventAppended(sequence, kind, subjectId, recordId);
    }

    function resume(bytes32 cursor, uint16 limit) external view returns (ResumePage memory page) {
        if (limit == 0 || limit > MAX_RESUME_PAGE) revert InvalidPageSize();

        uint64 afterSequence = _decodeCursor(cursor);
        if (afterSequence > latestSequence) revert InvalidCursor();

        uint256 start = uint256(afterSequence);
        uint256 available = _events.length > start ? _events.length - start : 0;
        uint256 take = available > limit ? limit : available;

        StreamEvent[] memory records = new StreamEvent[](take);
        for (uint256 i = 0; i < take; i++) {
            records[i] = _events[start + i];
        }

        uint64 deliveredThrough = take == 0 ? afterSequence : records[take - 1].sequence;
        bool hasMore = uint256(deliveredThrough) < _events.length;

        page.events = records;
        page.hasMore = hasMore;
        page.nextCursor = hasMore || take > 0 ? _encodeCursor(deliveredThrough) : cursor;
        page.latestSequence = latestSequence;
        page.latestEmittedAt = latestEmittedAt;
    }

    function cursorFor(uint64 sequence) external pure returns (bytes32) {
        return _encodeCursor(sequence);
    }

    function eventAt(uint64 sequence) external view returns (StreamEvent memory) {
        if (sequence == 0 || sequence > latestSequence) revert InvalidCursor();
        return _events[sequence - 1];
    }

    function freshness(uint64 nowTimestamp) external view returns (uint64 age) {
        if (latestEmittedAt == 0 || nowTimestamp < latestEmittedAt) revert InvalidEvent();
        return nowTimestamp - latestEmittedAt;
    }

    function _validate(
        EventKind kind,
        bytes32 subjectId,
        bytes32 recordId,
        bytes32 affectedRecordId,
        bytes32 replacementRecordId,
        uint64 canonicalHead,
        uint64 observedAt,
        uint64 emittedAt,
        bytes32 payloadHash
    ) private pure {
        if (emittedAt == 0 || emittedAt < observedAt) revert InvalidEvent();

        if (kind == EventKind.HEARTBEAT) {
            if (
                subjectId != bytes32(0) ||
                recordId != bytes32(0) ||
                affectedRecordId != bytes32(0) ||
                replacementRecordId != bytes32(0) ||
                payloadHash != bytes32(0)
            ) revert InvalidEvent();
            return;
        }

        if (subjectId == bytes32(0) || canonicalHead == 0) revert InvalidEvent();

        if (kind == EventKind.DATA) {
            if (
                recordId == bytes32(0) ||
                affectedRecordId != bytes32(0) ||
                replacementRecordId != bytes32(0) ||
                payloadHash == bytes32(0)
            ) revert InvalidEvent();
            return;
        }

        if (kind == EventKind.REORG) {
            if (
                recordId != bytes32(0) ||
                affectedRecordId == bytes32(0) ||
                replacementRecordId != bytes32(0) ||
                payloadHash == bytes32(0)
            ) revert InvalidEvent();
            return;
        }

        if (
            kind == EventKind.REPLACEMENT &&
            (
                recordId != bytes32(0) ||
                affectedRecordId == bytes32(0) ||
                replacementRecordId == bytes32(0) ||
                affectedRecordId == replacementRecordId ||
                payloadHash == bytes32(0)
            )
        ) revert InvalidEvent();
    }

    function _cursorTag() private pure returns (uint192) {
        return uint192(uint256(keccak256(abi.encode(SCHEMA_MAJOR, SCHEMA_MINOR, "LIVE_STREAM_CURSOR"))));
    }

    function _encodeCursor(uint64 sequence) private pure returns (bytes32) {
        return bytes32((uint256(_cursorTag()) << 64) | uint256(sequence));
    }

    function _decodeCursor(bytes32 cursor) private pure returns (uint64 sequence) {
        if (cursor == bytes32(0)) return 0;
        uint256 raw = uint256(cursor);
        if (uint192(raw >> 64) != _cursorTag()) revert InvalidCursor();
        return uint64(raw);
    }
}
