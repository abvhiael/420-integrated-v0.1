// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../shared/CreativeTypes420.sol";
import "../shared/CreativeErrors420.sol";

interface IPlaybackMediaManifest420 {
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

    function current(RecordingId recordingId) external view returns (MediaManifest420 memory);
}

interface IPlaybackStorageSource420 {
    enum SourceState {
        UNKNOWN,
        ACTIVE,
        DEGRADED,
        UNAVAILABLE,
        RETIRED
    }

    struct StorageSource420 {
        bytes32 providerKey;
        bytes32 locatorHash;
        bytes32 contentHash;
        bytes32 integrityHash;
        uint64 addedAt;
        uint64 updatedAt;
        uint32 priority;
        SourceState state;
    }

    function bestAvailableSource(RecordingId recordingId)
        external
        view
        returns (uint64 sourceId, StorageSource420 memory source_);
}

contract PlaybackResolver420 {
    struct PlaybackResolution420 {
        uint256 recordingId;
        uint64 mediaRevision;
        uint64 sourceId;
        bytes32 manifestHash;
        bytes32 masterContentHash;
        bytes32 providerKey;
        bytes32 locatorHash;
        bytes32 integrityHash;
        uint64 durationMs;
        uint8 sourceState;
    }

    IPlaybackMediaManifest420 public immutable mediaManifests;
    IPlaybackStorageSource420 public immutable storageSources;

    constructor(address mediaManifests_, address storageSources_) {
        if (mediaManifests_ == address(0) || storageSources_ == address(0)) revert CreativeErrors420.ZeroAddress();
        mediaManifests = IPlaybackMediaManifest420(mediaManifests_);
        storageSources = IPlaybackStorageSource420(storageSources_);
    }

    function resolve(RecordingId recordingId) external view returns (PlaybackResolution420 memory resolution) {
        uint256 rawId = RecordingId.unwrap(recordingId);
        if (rawId == 0) revert CreativeErrors420.InvalidId();

        IPlaybackMediaManifest420.MediaManifest420 memory manifest = mediaManifests.current(recordingId);
        (uint64 sourceId, IPlaybackStorageSource420.StorageSource420 memory source_) =
            storageSources.bestAvailableSource(recordingId);

        if (source_.contentHash != manifest.masterContentHash) revert CreativeErrors420.InvalidState();
        if (source_.state != IPlaybackStorageSource420.SourceState.ACTIVE
            && source_.state != IPlaybackStorageSource420.SourceState.DEGRADED) {
            revert CreativeErrors420.InvalidState();
        }

        resolution = PlaybackResolution420({
            recordingId: rawId,
            mediaRevision: manifest.revision,
            sourceId: sourceId,
            manifestHash: manifest.manifestHash,
            masterContentHash: manifest.masterContentHash,
            providerKey: source_.providerKey,
            locatorHash: source_.locatorHash,
            integrityHash: source_.integrityHash,
            durationMs: manifest.durationMs,
            sourceState: uint8(source_.state)
        });
    }
}
