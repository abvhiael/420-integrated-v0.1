// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../shared/CreativeTypes420.sol";
import "../shared/CreativeErrors420.sol";

interface IStorageSourceRecordingRegistry420 {
    function statusOf(RecordingId recordingId) external view returns (AssetStatus);
    function registrantProfileOf(RecordingId recordingId) external view returns (CreatorId);
}

interface IStorageSourceCreatorProfiles420 {
    function isAuthorized(CreatorId creatorId, address account) external view returns (bool);
}

contract StorageSourceRegistry420 {
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

    IStorageSourceRecordingRegistry420 public immutable recordings;
    IStorageSourceCreatorProfiles420 public immutable creatorProfiles;

    mapping(uint256 => uint64) private _nextSourceId;
    mapping(uint256 => mapping(uint64 => StorageSource420)) private _sources;
    mapping(uint256 => uint64[]) private _sourceIds;

    event StorageSourceAdded(
        uint256 indexed recordingId,
        uint64 indexed sourceId,
        bytes32 indexed providerKey,
        bytes32 locatorHash,
        bytes32 contentHash,
        bytes32 integrityHash,
        uint32 priority
    );
    event StorageSourceStateUpdated(uint256 indexed recordingId, uint64 indexed sourceId, uint8 state, bytes32 integrityHash);
    event StorageSourcePriorityUpdated(uint256 indexed recordingId, uint64 indexed sourceId, uint32 priority);
    event StorageSourceMigrated(
        uint256 indexed recordingId,
        uint64 indexed retiredSourceId,
        uint64 indexed replacementSourceId
    );

    constructor(address recordings_, address creatorProfiles_) {
        if (recordings_ == address(0) || creatorProfiles_ == address(0)) revert CreativeErrors420.ZeroAddress();
        recordings = IStorageSourceRecordingRegistry420(recordings_);
        creatorProfiles = IStorageSourceCreatorProfiles420(creatorProfiles_);
    }

    function addSource(
        RecordingId recordingId,
        bytes32 providerKey,
        bytes32 locatorHash,
        bytes32 contentHash,
        bytes32 integrityHash,
        uint32 priority
    ) external returns (uint64 sourceId) {
        _requireAuthorizedActive(recordingId);
        if (providerKey == bytes32(0) || locatorHash == bytes32(0) || contentHash == bytes32(0) || integrityHash == bytes32(0)) {
            revert CreativeErrors420.InvalidId();
        }

        uint256 rawId = RecordingId.unwrap(recordingId);
        sourceId = ++_nextSourceId[rawId];
        _sources[rawId][sourceId] = StorageSource420({
            providerKey: providerKey,
            locatorHash: locatorHash,
            contentHash: contentHash,
            integrityHash: integrityHash,
            addedAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp),
            priority: priority,
            state: SourceState.ACTIVE
        });
        _sourceIds[rawId].push(sourceId);

        emit StorageSourceAdded(rawId, sourceId, providerKey, locatorHash, contentHash, integrityHash, priority);
    }

    function updateSourceState(
        RecordingId recordingId,
        uint64 sourceId,
        SourceState state,
        bytes32 integrityHash
    ) external {
        _requireAuthorizedActive(recordingId);
        if (state == SourceState.UNKNOWN || integrityHash == bytes32(0)) revert CreativeErrors420.InvalidState();
        StorageSource420 storage source = _requireSource(recordingId, sourceId);
        if (source.state == SourceState.RETIRED) revert CreativeErrors420.InvalidTransition();
        source.state = state;
        source.integrityHash = integrityHash;
        source.updatedAt = uint64(block.timestamp);
        emit StorageSourceStateUpdated(RecordingId.unwrap(recordingId), sourceId, uint8(state), integrityHash);
    }

    function setPriority(RecordingId recordingId, uint64 sourceId, uint32 priority) external {
        _requireAuthorizedActive(recordingId);
        StorageSource420 storage source = _requireSource(recordingId, sourceId);
        if (source.state == SourceState.RETIRED) revert CreativeErrors420.InvalidTransition();
        source.priority = priority;
        source.updatedAt = uint64(block.timestamp);
        emit StorageSourcePriorityUpdated(RecordingId.unwrap(recordingId), sourceId, priority);
    }

    function migrateSource(
        RecordingId recordingId,
        uint64 sourceId,
        bytes32 replacementProviderKey,
        bytes32 replacementLocatorHash,
        bytes32 replacementContentHash,
        bytes32 replacementIntegrityHash,
        uint32 replacementPriority
    ) external returns (uint64 replacementSourceId) {
        _requireAuthorizedActive(recordingId);
        StorageSource420 storage source = _requireSource(recordingId, sourceId);
        if (source.state == SourceState.RETIRED) revert CreativeErrors420.InvalidTransition();
        if (
            replacementProviderKey == bytes32(0) || replacementLocatorHash == bytes32(0)
                || replacementContentHash == bytes32(0) || replacementIntegrityHash == bytes32(0)
        ) revert CreativeErrors420.InvalidId();

        uint256 rawId = RecordingId.unwrap(recordingId);
        replacementSourceId = ++_nextSourceId[rawId];
        _sources[rawId][replacementSourceId] = StorageSource420({
            providerKey: replacementProviderKey,
            locatorHash: replacementLocatorHash,
            contentHash: replacementContentHash,
            integrityHash: replacementIntegrityHash,
            addedAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp),
            priority: replacementPriority,
            state: SourceState.ACTIVE
        });
        _sourceIds[rawId].push(replacementSourceId);

        source.state = SourceState.RETIRED;
        source.updatedAt = uint64(block.timestamp);

        emit StorageSourceAdded(
            rawId,
            replacementSourceId,
            replacementProviderKey,
            replacementLocatorHash,
            replacementContentHash,
            replacementIntegrityHash,
            replacementPriority
        );
        emit StorageSourceMigrated(rawId, sourceId, replacementSourceId);
    }

    function source(RecordingId recordingId, uint64 sourceId) external view returns (StorageSource420 memory) {
        return _requireSource(recordingId, sourceId);
    }

    function sourceIds(RecordingId recordingId) external view returns (uint64[] memory) {
        return _sourceIds[RecordingId.unwrap(recordingId)];
    }

    function bestAvailableSource(RecordingId recordingId)
        external
        view
        returns (uint64 sourceId, StorageSource420 memory source_)
    {
        uint64[] storage ids = _sourceIds[RecordingId.unwrap(recordingId)];
        bool found;
        uint32 bestPriority = type(uint32).max;
        for (uint256 i = 0; i < ids.length; ++i) {
            StorageSource420 storage candidate = _sources[RecordingId.unwrap(recordingId)][ids[i]];
            if ((candidate.state == SourceState.ACTIVE || candidate.state == SourceState.DEGRADED) && (!found || candidate.priority < bestPriority)) {
                found = true;
                bestPriority = candidate.priority;
                sourceId = ids[i];
                source_ = candidate;
            }
        }
        if (!found) revert CreativeErrors420.NotFound();
    }

    function _requireAuthorizedActive(RecordingId recordingId) internal view {
        if (RecordingId.unwrap(recordingId) == 0) revert CreativeErrors420.InvalidId();
        if (recordings.statusOf(recordingId) != AssetStatus.ACTIVE) revert CreativeErrors420.InvalidState();
        CreatorId creatorId = recordings.registrantProfileOf(recordingId);
        if (!creatorProfiles.isAuthorized(creatorId, msg.sender)) revert CreativeErrors420.Unauthorized();
    }

    function _requireSource(RecordingId recordingId, uint64 sourceId) internal view returns (StorageSource420 storage source_) {
        if (sourceId == 0) revert CreativeErrors420.InvalidId();
        source_ = _sources[RecordingId.unwrap(recordingId)][sourceId];
        if (source_.providerKey == bytes32(0)) revert CreativeErrors420.NotFound();
    }
}
