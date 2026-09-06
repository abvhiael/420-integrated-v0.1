// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../shared/CreativeTypes420.sol";
import "../shared/CreativeErrors420.sol";
import "../shared/CreativeEvents420.sol";

interface IRecordingCreatorProfiles420 {
    function isAuthorized(CreatorId creatorId, address account) external view returns (bool);
}

interface IRecordingWorkRegistry420 {
    function statusOf(WorkId workId) external view returns (AssetStatus);
}

interface IRecordingRights420 {
    function isFinalized(bytes32 assetKey) external view returns (bool);
}

interface IAuthorizationResolver420 {
    function canCreateDerivative(
        CreatorId actorProfileId,
        WorkId workId,
        RecordingId sourceRecordingId,
        RecordingClass derivativeClass,
        LicenseId licenseId
    ) external view returns (bool);
}

contract RecordingRegistry420 is CreativeEvents420 {
    IRecordingCreatorProfiles420 public immutable creatorProfiles;
    IRecordingWorkRegistry420 public immutable works;
    address public immutable governanceTimelock;
    address public rightsRegistry;
    address public authorizationRegistry;

    uint256 private _nextRecordingId = 1;
    mapping(uint256 => Recording420) private _recordings;

    constructor(address governanceTimelock_, address creatorProfiles_, address workRegistry_) {
        if (governanceTimelock_ == address(0) || creatorProfiles_ == address(0) || workRegistry_ == address(0)) {
            revert CreativeErrors420.ZeroAddress();
        }
        governanceTimelock = governanceTimelock_;
        creatorProfiles = IRecordingCreatorProfiles420(creatorProfiles_);
        works = IRecordingWorkRegistry420(workRegistry_);
    }

    function configureDependencies(address rightsRegistry_, address authorizationRegistry_) external {
        if (msg.sender != governanceTimelock) revert CreativeErrors420.Unauthorized();
        if (rightsRegistry_ == address(0) || authorizationRegistry_ == address(0)) revert CreativeErrors420.ZeroAddress();
        rightsRegistry = rightsRegistry_;
        authorizationRegistry = authorizationRegistry_;
    }

    function registerRecording(RecordingRegistration420 calldata request) external returns (RecordingId recordingId) {
        _validateRegistration(request);
        uint256 id = _nextRecordingId++;
        _recordings[id] = Recording420({
            workId: request.workId,
            parentRecordingId: request.parentRecordingId,
            supersedesRecordingId: request.supersedesRecordingId,
            masterHash: request.masterHash,
            metadataHash: request.metadataHash,
            provenanceHash: request.provenanceHash,
            mediaManifestHash: request.mediaManifestHash,
            authorizationManifestHash: request.authorizationManifestHash,
            registeredAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp),
            recordingClass: request.recordingClass,
            provenanceClass: request.provenanceClass,
            rightsStatus: request.rightsStatus,
            status: AssetStatus.PROVISIONAL,
            royaltyScheduleVersion: request.royaltyScheduleVersion,
            authorizationPolicyVersion: request.authorizationPolicyVersion,
            registrantProfileId: request.registrantProfileId
        });
        emit RecordingRegistered(
            id,
            WorkId.unwrap(request.workId),
            uint8(request.recordingClass),
            CreatorId.unwrap(request.registrantProfileId)
        );
        return RecordingId.wrap(id);
    }

    function activateRecording(RecordingId recordingId, LicenseId sourceLicenseId) external {
        uint256 id = RecordingId.unwrap(recordingId);
        Recording420 storage recording_ = _requireRecording(id);
        if (!creatorProfiles.isAuthorized(recording_.registrantProfileId, msg.sender)) {
            revert CreativeErrors420.Unauthorized();
        }
        if (recording_.status != AssetStatus.PROVISIONAL) revert CreativeErrors420.InvalidTransition();
        if (rightsRegistry == address(0) || authorizationRegistry == address(0)) {
            revert CreativeErrors420.AccountingNotConfigured();
        }
        bytes32 key = CreativeAssetKeys420.key(CreativeAssetType.RECORDING, id);
        if (!IRecordingRights420(rightsRegistry).isFinalized(key)) revert CreativeErrors420.InvalidState();

        if (_requiresAuthorization(recording_.recordingClass)) {
            bool allowed = IAuthorizationResolver420(authorizationRegistry).canCreateDerivative(
                recording_.registrantProfileId,
                recording_.workId,
                recording_.parentRecordingId,
                recording_.recordingClass,
                sourceLicenseId
            );
            if (!allowed) revert CreativeErrors420.MissingAuthorization();
        }

        recording_.status = AssetStatus.ACTIVE;
        recording_.updatedAt = uint64(block.timestamp);
        emit RecordingActivated(id, recording_.royaltyScheduleVersion, recording_.authorizationPolicyVersion);
    }

    function registrantProfileOf(RecordingId recordingId) external view returns (CreatorId) {
        return _requireRecording(RecordingId.unwrap(recordingId)).registrantProfileId;
    }

    function recording(RecordingId recordingId) external view returns (Recording420 memory) {
        Recording420 storage r = _requireRecording(RecordingId.unwrap(recordingId));
        return r;
    }

    function statusOf(RecordingId recordingId) external view returns (AssetStatus) {
        return _requireRecording(RecordingId.unwrap(recordingId)).status;
    }

    function royaltyContext(RecordingId recordingId)
        external
        view
        returns (WorkId workId, RecordingId parentRecordingId, RecordingClass recordingClass, uint32 scheduleVersion)
    {
        Recording420 storage r = _requireRecording(RecordingId.unwrap(recordingId));
        return (r.workId, r.parentRecordingId, r.recordingClass, r.royaltyScheduleVersion);
    }

    function _validateRegistration(RecordingRegistration420 calldata request) internal view {
        if (!creatorProfiles.isAuthorized(request.registrantProfileId, msg.sender)) {
            revert CreativeErrors420.Unauthorized();
        }
        if (works.statusOf(request.workId) != AssetStatus.ACTIVE) revert CreativeErrors420.InvalidState();
        if (request.masterHash == bytes32(0) || request.provenanceHash == bytes32(0) || request.mediaManifestHash == bytes32(0)) {
            revert CreativeErrors420.InvalidId();
        }
        if (request.royaltyScheduleVersion == 0) revert CreativeErrors420.InvalidSchedule();

        uint256 parentId = RecordingId.unwrap(request.parentRecordingId);
        if (request.recordingClass == RecordingClass.ORIGINAL && parentId != 0) revert CreativeErrors420.InvalidSource();
        if (_requiresSourceRecording(request.recordingClass) && parentId == 0) revert CreativeErrors420.InvalidSource();
        if (parentId != 0) _requireRecording(parentId);
    }

    function _requiresAuthorization(RecordingClass class_) internal pure returns (bool) {
        return class_ == RecordingClass.COVER || _requiresSourceRecording(class_);
    }

    function _requiresSourceRecording(RecordingClass class_) internal pure returns (bool) {
        return class_ == RecordingClass.REMIX || class_ == RecordingClass.STEM_REMIX
            || class_ == RecordingClass.SAMPLE_DERIVATIVE || class_ == RecordingClass.AI_DERIVATIVE;
    }

    function _requireRecording(uint256 id) internal view returns (Recording420 storage recording_) {
        recording_ = _recordings[id];
        if (WorkId.unwrap(recording_.workId) == 0) revert CreativeErrors420.NotFound();
    }
}
