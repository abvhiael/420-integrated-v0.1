// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Executable V13.7 handoff contract for validating V14 client-facing parity and freshness.
/// @dev Qualification-only reference model. It grants no execution, custody, mint, burn or settlement authority.
contract ExchangeV14Handoff420 {
    uint16 public constant CLIENT_SCHEMA_MAJOR = 14;
    uint16 public constant CLIENT_SCHEMA_MINOR = 0;
    uint64 public constant MAX_CANONICAL_LAG_BLOCKS = 3;
    uint64 public constant MAX_STREAM_LAG_SECONDS = 30;

    struct ClientEnvelope {
        bytes32 marketSubjectId;
        bytes32 snapshotId;
        bytes32 historyRecordId;
        uint64 canonicalHead;
        uint64 indexedHead;
        uint64 snapshotHead;
        uint64 streamHead;
        uint64 snapshotObservedAt;
        uint64 streamEmittedAt;
        bool replacementRequired;
        bytes32 affectedRecordId;
        bytes32 replacementRecordId;
    }

    error InvalidClientEnvelope();
    error HeadParityFailure();
    error FreshnessFailure();
    error ReplacementFailure();

    function validate(ClientEnvelope calldata e, uint64 nowTimestamp) external pure returns (bytes32 handoffId) {
        if (
            e.marketSubjectId == bytes32(0) ||
            e.snapshotId == bytes32(0) ||
            e.historyRecordId == bytes32(0) ||
            e.canonicalHead == 0 ||
            e.indexedHead == 0 ||
            e.snapshotHead == 0 ||
            e.streamHead == 0 ||
            nowTimestamp == 0
        ) revert InvalidClientEnvelope();

        if (
            e.indexedHead > e.canonicalHead ||
            e.snapshotHead > e.canonicalHead ||
            e.streamHead > e.canonicalHead
        ) revert HeadParityFailure();

        if (
            e.canonicalHead - e.indexedHead > MAX_CANONICAL_LAG_BLOCKS ||
            e.canonicalHead - e.snapshotHead > MAX_CANONICAL_LAG_BLOCKS ||
            e.canonicalHead - e.streamHead > MAX_CANONICAL_LAG_BLOCKS
        ) revert HeadParityFailure();

        if (
            e.snapshotObservedAt == 0 ||
            e.streamEmittedAt == 0 ||
            nowTimestamp < e.snapshotObservedAt ||
            nowTimestamp < e.streamEmittedAt ||
            nowTimestamp - e.streamEmittedAt > MAX_STREAM_LAG_SECONDS
        ) revert FreshnessFailure();

        if (e.replacementRequired) {
            if (
                e.affectedRecordId == bytes32(0) ||
                e.replacementRecordId == bytes32(0) ||
                e.affectedRecordId == e.replacementRecordId ||
                e.historyRecordId != e.replacementRecordId
            ) revert ReplacementFailure();
        } else if (e.affectedRecordId != bytes32(0) || e.replacementRecordId != bytes32(0)) {
            revert ReplacementFailure();
        }

        handoffId = keccak256(
            abi.encode(
                CLIENT_SCHEMA_MAJOR,
                CLIENT_SCHEMA_MINOR,
                e.marketSubjectId,
                e.snapshotId,
                e.historyRecordId,
                e.canonicalHead,
                e.indexedHead,
                e.snapshotHead,
                e.streamHead,
                e.replacementRequired,
                e.affectedRecordId,
                e.replacementRecordId
            )
        );
    }
}
