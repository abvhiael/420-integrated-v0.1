// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../shared/CreativeTypes420.sol";
import "../shared/CreativeErrors420.sol";

interface IMediaManifestRecordingRegistry420 {
    function statusOf(RecordingId recordingId) external view returns (AssetStatus);
    function registrantProfileOf(RecordingId recordingId) external view returns (CreatorId);
}

interface IMediaManifestCreatorProfiles420 {
    function isAuthorized(CreatorId creatorId, address account) external view returns (bool);
}

contract MediaManifestRegistry420 {
    struct MediaManifest420 {
        bytes32 manifestHash;
        bytes32 masterContentHash;
        bytes32 technicalMetadataHash;
        bytes32 storageLocatorHash;
        bytes32 provenanceHash;
        uint64 durationMs;
        uint64 revision;
        uint64 updatedAt;
    }

    IMediaManifestRecordingRegistry420 public immutable recordings;
    IMediaManifestCreatorProfiles420 public immutable creatorProfiles;

    mapping(uint256 => MediaManifest420) private _current;
    mapping(uint256 => mapping(uint64 => MediaManifest420)) private _history;

    event MediaManifestPublished(
        uint256 indexed recordingId,
        uint256 indexed creatorId,
        uint64 indexed revision,
        bytes32 manifestHash,
        bytes32 masterContentHash,
        bytes32 technicalMetadataHash,
        bytes32 storageLocatorHash,
        bytes32 provenanceHash,
        uint64 durationMs
    );

    constructor(address recordings_, address creatorProfiles_) {
        if (recordings_ == address(0) || creatorProfiles_ == address(0)) revert CreativeErrors420.ZeroAddress();
        recordings = IMediaManifestRecordingRegistry420(recordings_);
        creatorProfiles = IMediaManifestCreatorProfiles420(creatorProfiles_);
    }

    function publishMediaManifest(
        RecordingId recordingId,
        bytes32 manifestHash,
        bytes32 masterContentHash,
        bytes32 technicalMetadataHash,
        bytes32 storageLocatorHash,
        bytes32 provenanceHash,
        uint64 durationMs
    ) external {
        if (RecordingId.unwrap(recordingId) == 0) revert CreativeErrors420.InvalidId();
        if (recordings.statusOf(recordingId) != AssetStatus.ACTIVE) revert CreativeErrors420.InvalidState();

        CreatorId creatorId = recordings.registrantProfileOf(recordingId);
        if (!creatorProfiles.isAuthorized(creatorId, msg.sender)) revert CreativeErrors420.Unauthorized();
        if (
            manifestHash == bytes32(0) || masterContentHash == bytes32(0)
                || technicalMetadataHash == bytes32(0) || storageLocatorHash == bytes32(0)
                || provenanceHash == bytes32(0) || durationMs == 0
        ) revert CreativeErrors420.InvalidId();

        uint256 rawRecordingId = RecordingId.unwrap(recordingId);
        uint64 revision = _current[rawRecordingId].revision + 1;
        MediaManifest420 memory next = MediaManifest420({
            manifestHash: manifestHash,
            masterContentHash: masterContentHash,
            technicalMetadataHash: technicalMetadataHash,
            storageLocatorHash: storageLocatorHash,
            provenanceHash: provenanceHash,
            durationMs: durationMs,
            revision: revision,
            updatedAt: uint64(block.timestamp)
        });

        _current[rawRecordingId] = next;
        _history[rawRecordingId][revision] = next;

        emit MediaManifestPublished(
            rawRecordingId,
            CreatorId.unwrap(creatorId),
            revision,
            manifestHash,
            masterContentHash,
            technicalMetadataHash,
            storageLocatorHash,
            provenanceHash,
            durationMs
        );
    }

    function current(RecordingId recordingId) external view returns (MediaManifest420 memory) {
        MediaManifest420 memory manifest = _current[RecordingId.unwrap(recordingId)];
        if (manifest.revision == 0) revert CreativeErrors420.NotFound();
        return manifest;
    }

    function revision(RecordingId recordingId, uint64 revision_) external view returns (MediaManifest420 memory) {
        MediaManifest420 memory manifest = _history[RecordingId.unwrap(recordingId)][revision_];
        if (manifest.revision == 0) revert CreativeErrors420.NotFound();
        return manifest;
    }
}
