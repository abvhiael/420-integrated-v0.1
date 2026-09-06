// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../shared/CreativeTypes420.sol";
import "../shared/CreativeErrors420.sol";

interface IPlaybackAccountingRecordingRegistry420 {
    function statusOf(RecordingId recordingId) external view returns (AssetStatus);
}

contract PlaybackAccounting420 {
    uint256 public constant MAX_RECORDINGS_PER_BATCH = 100;

    struct RecordingAggregate420 {
        uint256 playCount;
        uint256 qualifiedMs;
    }

    IPlaybackAccountingRecordingRegistry420 public immutable recordings;
    address public immutable governanceTimelock;

    mapping(address => bool) public submitters;
    mapping(bytes32 => bool) public processedBatch;
    mapping(uint64 => mapping(uint256 => RecordingAggregate420)) private _epochRecording;
    mapping(uint256 => RecordingAggregate420) private _lifetimeRecording;

    event SubmitterUpdated(address indexed submitter, bool allowed);
    event PlaybackBatchAccepted(
        bytes32 indexed batchId,
        uint64 indexed epoch,
        bytes32 indexed eventRoot,
        uint256 recordingCount,
        uint256 totalPlayCount,
        uint256 totalQualifiedMs
    );

    constructor(address governanceTimelock_, address recordings_) {
        if (governanceTimelock_ == address(0) || recordings_ == address(0)) revert CreativeErrors420.ZeroAddress();
        governanceTimelock = governanceTimelock_;
        recordings = IPlaybackAccountingRecordingRegistry420(recordings_);
    }

    function setSubmitter(address submitter, bool allowed) external {
        if (msg.sender != governanceTimelock) revert CreativeErrors420.Unauthorized();
        if (submitter == address(0)) revert CreativeErrors420.ZeroAddress();
        submitters[submitter] = allowed;
        emit SubmitterUpdated(submitter, allowed);
    }

    function submitPlaybackBatch(
        bytes32 batchId,
        uint64 epoch,
        bytes32 eventRoot,
        RecordingId[] calldata recordingIds,
        uint64[] calldata playCounts,
        uint64[] calldata qualifiedMs
    ) external {
        if (!submitters[msg.sender]) revert CreativeErrors420.Unauthorized();
        if (batchId == bytes32(0) || eventRoot == bytes32(0) || epoch == 0) revert CreativeErrors420.InvalidId();
        if (processedBatch[batchId]) revert CreativeErrors420.AlreadyExists();

        uint256 length = recordingIds.length;
        if (length == 0 || length > MAX_RECORDINGS_PER_BATCH || playCounts.length != length || qualifiedMs.length != length) {
            revert CreativeErrors420.InvalidState();
        }

        uint256 totalPlayCount;
        uint256 totalQualifiedMs;

        for (uint256 i = 0; i < length; ++i) {
            uint256 rawId = RecordingId.unwrap(recordingIds[i]);
            if (rawId == 0) revert CreativeErrors420.InvalidId();
            if (recordings.statusOf(recordingIds[i]) != AssetStatus.ACTIVE) revert CreativeErrors420.InvalidState();
            if (playCounts[i] == 0 || qualifiedMs[i] == 0) revert CreativeErrors420.InvalidState();

            for (uint256 j = 0; j < i; ++j) {
                if (RecordingId.unwrap(recordingIds[j]) == rawId) revert CreativeErrors420.AlreadyExists();
            }

            RecordingAggregate420 storage epochAgg = _epochRecording[epoch][rawId];
            epochAgg.playCount += playCounts[i];
            epochAgg.qualifiedMs += qualifiedMs[i];

            RecordingAggregate420 storage lifetimeAgg = _lifetimeRecording[rawId];
            lifetimeAgg.playCount += playCounts[i];
            lifetimeAgg.qualifiedMs += qualifiedMs[i];

            totalPlayCount += playCounts[i];
            totalQualifiedMs += qualifiedMs[i];
        }

        processedBatch[batchId] = true;
        emit PlaybackBatchAccepted(batchId, epoch, eventRoot, length, totalPlayCount, totalQualifiedMs);
    }

    function epochAggregate(uint64 epoch, RecordingId recordingId)
        external
        view
        returns (RecordingAggregate420 memory)
    {
        if (epoch == 0 || RecordingId.unwrap(recordingId) == 0) revert CreativeErrors420.InvalidId();
        return _epochRecording[epoch][RecordingId.unwrap(recordingId)];
    }

    function lifetimeAggregate(RecordingId recordingId) external view returns (RecordingAggregate420 memory) {
        if (RecordingId.unwrap(recordingId) == 0) revert CreativeErrors420.InvalidId();
        return _lifetimeRecording[RecordingId.unwrap(recordingId)];
    }
}
