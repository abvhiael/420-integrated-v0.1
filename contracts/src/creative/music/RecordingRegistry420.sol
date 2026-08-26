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

    function registerRecording(
        CreatorId registrantProfileId,
        WorkId workId,
        RecordingId parentRecordingId,
        RecordingId supersedesRecordingId,
        RecordingClass recordingClass,
        bytes32 masterHash,
        bytes32 metadataHash,
        bytes32 provenanceHash,
        bytes32 mediaManifestHash,
        bytes32 authorizationManifestHash,
        ProvenanceClass provenanceClass,
        RightsStatus rightsStatus,
        uint32 royaltyScheduleVersion,
        uint32 authorizationPolicyVersion
    ) external returns (RecordingId recordingId) {
        if (!creatorProfiles.isAuthorized(registrantProfileId, msg.sender)) revert CreativeErrors420.Unauthorized();
        if (works.statusOf(workId) != AssetStatus.ACTIVE) revert CreativeErrors420.InvalidState();
        if (masterHash == bytes32(0) || provenanceHash == bytes32(0) || mediaManifestHash == bytes32(0)) {
            revert CreativeErrors420.InvalidId();
        }
        if (recordingClass == RecordingClass.ORIGINAL && RecordingId.unwrap(parentRecordingId) != 0) {
            revert CreativeErrors420.InvalidSource();
        }
        if (_isDerivative(recordingClass) && RecordingId.unwrap(parentRecordingId) == 0) {
            revert CreativeErrors420.InvalidSource();
        }
        if (royaltyScheduleVersion == 0) revert CreativeErrors420.InvalidSchedule();

        uint256 id = _nextRecordingId++;
        _recordings[id] = Recording420({
            workId: workId,
            parentRecordingId: parentRecordingId,
            supersedesRecordingId: supersedesRecordingId,
            masterHash: masterHash,
            metadataHash: metadataHash,
            provenanceHash: provenanceHash,
            mediaManifestHash: mediaManifestHash,
            authorizationManifestHash: authorizationManifestHash,
            registeredAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp),
            recordingClass: recordingClass,
            provenanceClass: provenanceClass,
            rightsStatus: rightsStatus,
            status: AssetStatus.PROVISIONAL,
            royaltyScheduleVersion: royaltyScheduleVersion,
            authorizationPolicyVersion: authorizationPolicyVersion,
            registrantProfileId: registrantProfileId
        });
        emit RecordingRegistered(id, WorkId.unwrap(workId), uint8(recordingClass), CreatorId.unwrap(registrantProfileId));
        return RecordingId.wrap(id);
    }

    function activateRecording(RecordingId recordingId, LicenseId sourceLicenseId) external {
        uint256 id = RecordingId.unwrap(recordingId);
        Recording420 storage recording = _requireRecording(id);
        if (!creatorProfiles.isAuthorized(recording.registrantProfileId, msg.sender)) revert CreativeErrors420.Unauthorized();
        if (recording.status != AssetStatus.PROVISIONAL) revert CreativeErrors420.InvalidTransition();
        if (rightsRegistry == address(0) || authorizationRegistry == address(0)) revert CreativeErrors420.AccountingNotConfigured();
        bytes32 key = CreativeAssetKeys420.key(CreativeAssetType.RECORDING, id);
        if (!IRecordingRights420(rightsRegistry).isFinalized(key)) revert CreativeErrors420.InvalidState();

        if (_isDerivative(recording.recordingClass)) {
            bool allowed = IAuthorizationResolver420(authorizationRegistry).canCreateDerivative(
                recording.registrantProfileId,
                recording.workId,
                recording.parentRecordingId,
                recording.recordingClass,
                sourceLicenseId
            );
            if (!allowed) revert CreativeErrors420.MissingAuthorization();
        }

        recording.status = AssetStatus.ACTIVE;
        recording.updatedAt = uint64(block.timestamp);
        emit RecordingActivated(id, recording.royaltyScheduleVersion, recording.authorizationPolicyVersion);
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

    function _isDerivative(RecordingClass class_) internal pure returns (bool) {
        return class_ == RecordingClass.COVER || class_ == RecordingClass.REMIX || class_ == RecordingClass.STEM_REMIX
            || class_ == RecordingClass.SAMPLE_DERIVATIVE || class_ == RecordingClass.AI_DERIVATIVE;
    }

    function _requireRecording(uint256 id) internal view returns (Recording420 storage recording_) {
        recording_ = _recordings[id];
        if (WorkId.unwrap(recording_.workId) == 0) revert CreativeErrors420.NotFound();
    }
}
