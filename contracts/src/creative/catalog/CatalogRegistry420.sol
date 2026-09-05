// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../shared/CreativeTypes420.sol";
import "../shared/CreativeErrors420.sol";

interface ICatalogCreatorProfiles420 {
    function isAuthorized(CreatorId creatorId, address account) external view returns (bool);
}

interface ICatalogRecordingRegistry420 {
    function statusOf(RecordingId recordingId) external view returns (AssetStatus);
}

contract CatalogRegistry420 {
    enum ReleaseType { SINGLE, EP, ALBUM, COMPILATION, LIVE, OTHER }
    enum ReleaseStatus { DRAFT, PUBLISHED, WITHDRAWN }

    struct Release420 {
        CreatorId creatorId;
        bytes32 metadataHash;
        bytes32 artworkHash;
        uint64 createdAt;
        uint64 updatedAt;
        uint64 publishedAt;
        ReleaseType releaseType;
        ReleaseStatus status;
    }

    uint256 public constant MAX_TRACKS_PER_RELEASE = 100;

    ICatalogCreatorProfiles420 public immutable creatorProfiles;
    ICatalogRecordingRegistry420 public immutable recordings;

    uint256 private _nextReleaseId = 1;
    mapping(uint256 => Release420) private _releases;
    mapping(uint256 => RecordingId[]) private _tracks;
    mapping(uint256 => mapping(uint256 => bool)) private _trackPresent;

    event ReleaseCreated(uint256 indexed releaseId, uint256 indexed creatorId, ReleaseType releaseType, bytes32 metadataHash);
    event ReleaseMetadataUpdated(uint256 indexed releaseId, bytes32 metadataHash, bytes32 artworkHash);
    event ReleaseTrackAdded(uint256 indexed releaseId, uint256 indexed recordingId, uint256 position);
    event ReleaseTrackRemoved(uint256 indexed releaseId, uint256 indexed recordingId);
    event ReleasePublished(uint256 indexed releaseId, uint64 publishedAt);
    event ReleaseWithdrawn(uint256 indexed releaseId);

    constructor(address creatorProfiles_, address recordings_) {
        if (creatorProfiles_ == address(0) || recordings_ == address(0)) revert CreativeErrors420.ZeroAddress();
        creatorProfiles = ICatalogCreatorProfiles420(creatorProfiles_);
        recordings = ICatalogRecordingRegistry420(recordings_);
    }

    function createRelease(
        CreatorId creatorId,
        ReleaseType releaseType,
        bytes32 metadataHash,
        bytes32 artworkHash
    ) external returns (uint256 releaseId) {
        _requireAuthorized(creatorId);
        if (metadataHash == bytes32(0) || artworkHash == bytes32(0)) revert CreativeErrors420.InvalidId();

        releaseId = _nextReleaseId++;
        _releases[releaseId] = Release420({
            creatorId: creatorId,
            metadataHash: metadataHash,
            artworkHash: artworkHash,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp),
            publishedAt: 0,
            releaseType: releaseType,
            status: ReleaseStatus.DRAFT
        });
        emit ReleaseCreated(releaseId, CreatorId.unwrap(creatorId), releaseType, metadataHash);
    }

    function updateMetadata(uint256 releaseId, bytes32 metadataHash, bytes32 artworkHash) external {
        Release420 storage release_ = _requireRelease(releaseId);
        _requireAuthorized(release_.creatorId);
        if (release_.status != ReleaseStatus.DRAFT) revert CreativeErrors420.InvalidTransition();
        if (metadataHash == bytes32(0) || artworkHash == bytes32(0)) revert CreativeErrors420.InvalidId();
        release_.metadataHash = metadataHash;
        release_.artworkHash = artworkHash;
        release_.updatedAt = uint64(block.timestamp);
        emit ReleaseMetadataUpdated(releaseId, metadataHash, artworkHash);
    }

    function addTrack(uint256 releaseId, RecordingId recordingId) external {
        Release420 storage release_ = _requireRelease(releaseId);
        _requireAuthorized(release_.creatorId);
        if (release_.status != ReleaseStatus.DRAFT) revert CreativeErrors420.InvalidTransition();
        uint256 recordingRaw = RecordingId.unwrap(recordingId);
        if (recordingRaw == 0) revert CreativeErrors420.InvalidId();
        if (_trackPresent[releaseId][recordingRaw]) revert CreativeErrors420.AlreadyExists();
        if (_tracks[releaseId].length >= MAX_TRACKS_PER_RELEASE) revert CreativeErrors420.InvalidState();
        if (recordings.statusOf(recordingId) != AssetStatus.ACTIVE) revert CreativeErrors420.InvalidState();

        _trackPresent[releaseId][recordingRaw] = true;
        _tracks[releaseId].push(recordingId);
        release_.updatedAt = uint64(block.timestamp);
        emit ReleaseTrackAdded(releaseId, recordingRaw, _tracks[releaseId].length - 1);
    }

    function removeTrack(uint256 releaseId, RecordingId recordingId) external {
        Release420 storage release_ = _requireRelease(releaseId);
        _requireAuthorized(release_.creatorId);
        if (release_.status != ReleaseStatus.DRAFT) revert CreativeErrors420.InvalidTransition();
        uint256 recordingRaw = RecordingId.unwrap(recordingId);
        if (!_trackPresent[releaseId][recordingRaw]) revert CreativeErrors420.NotFound();

        RecordingId[] storage list = _tracks[releaseId];
        uint256 length = list.length;
        for (uint256 i = 0; i < length; ++i) {
            if (RecordingId.unwrap(list[i]) == recordingRaw) {
                for (uint256 j = i; j + 1 < length; ++j) list[j] = list[j + 1];
                list.pop();
                break;
            }
        }
        delete _trackPresent[releaseId][recordingRaw];
        release_.updatedAt = uint64(block.timestamp);
        emit ReleaseTrackRemoved(releaseId, recordingRaw);
    }

    function publishRelease(uint256 releaseId) external {
        Release420 storage release_ = _requireRelease(releaseId);
        _requireAuthorized(release_.creatorId);
        if (release_.status != ReleaseStatus.DRAFT) revert CreativeErrors420.InvalidTransition();
        RecordingId[] storage list = _tracks[releaseId];
        if (list.length == 0) revert CreativeErrors420.InvalidState();
        for (uint256 i = 0; i < list.length; ++i) {
            if (recordings.statusOf(list[i]) != AssetStatus.ACTIVE) revert CreativeErrors420.InvalidState();
        }
        release_.status = ReleaseStatus.PUBLISHED;
        release_.publishedAt = uint64(block.timestamp);
        release_.updatedAt = uint64(block.timestamp);
        emit ReleasePublished(releaseId, release_.publishedAt);
    }

    function withdrawRelease(uint256 releaseId) external {
        Release420 storage release_ = _requireRelease(releaseId);
        _requireAuthorized(release_.creatorId);
        if (release_.status != ReleaseStatus.PUBLISHED) revert CreativeErrors420.InvalidTransition();
        release_.status = ReleaseStatus.WITHDRAWN;
        release_.updatedAt = uint64(block.timestamp);
        emit ReleaseWithdrawn(releaseId);
    }

    function release(uint256 releaseId) external view returns (Release420 memory) {
        return _requireRelease(releaseId);
    }

    function creatorOf(uint256 releaseId) external view returns (CreatorId) {
        return _requireRelease(releaseId).creatorId;
    }

    function trackCount(uint256 releaseId) external view returns (uint256) {
        _requireRelease(releaseId);
        return _tracks[releaseId].length;
    }

    function trackAt(uint256 releaseId, uint256 index) external view returns (RecordingId) {
        _requireRelease(releaseId);
        if (index >= _tracks[releaseId].length) revert CreativeErrors420.NotFound();
        return _tracks[releaseId][index];
    }

    function containsTrack(uint256 releaseId, RecordingId recordingId) external view returns (bool) {
        _requireRelease(releaseId);
        return _trackPresent[releaseId][RecordingId.unwrap(recordingId)];
    }

    function _requireAuthorized(CreatorId creatorId) internal view {
        if (!creatorProfiles.isAuthorized(creatorId, msg.sender)) revert CreativeErrors420.Unauthorized();
    }

    function _requireRelease(uint256 releaseId) internal view returns (Release420 storage release_) {
        release_ = _releases[releaseId];
        if (CreatorId.unwrap(release_.creatorId) == 0) revert CreativeErrors420.NotFound();
    }
}
