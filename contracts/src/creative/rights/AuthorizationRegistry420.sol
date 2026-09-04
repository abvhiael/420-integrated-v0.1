// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../shared/CreativeTypes420.sol";
import "../shared/CreativeErrors420.sol";
import "../shared/CreativeEvents420.sol";

interface IAuthorizationProfiles420 {
    function isAuthorized(CreatorId creatorId, address account) external view returns (bool);
}

interface IAuthorizationWorkController420 {
    function registrantProfileOf(WorkId workId) external view returns (CreatorId);
}

interface IAuthorizationRecordingController420 {
    function registrantProfileOf(RecordingId recordingId) external view returns (CreatorId);
}

interface ILicensePermissionResolver420 {
    function hasPermissions(
        LicenseId licenseId,
        CreatorId licenseeProfileId,
        CreativeAssetType assetType,
        uint256 assetId,
        uint256 requiredMask
    ) external view returns (bool);
}

contract AuthorizationRegistry420 is CreativeEvents420 {
    struct AuthorizationPolicy {
        PolicyPreset preset;
        uint256 permissionMask;
        uint256 trainingPermissionMask;
        uint32 version;
        uint64 effectiveAt;
        uint64 expiresAt;
        bytes32 termsHash;
        bool active;
    }

    IAuthorizationProfiles420 public immutable creatorProfiles;
    IAuthorizationWorkController420 public immutable works;
    IAuthorizationRecordingController420 public immutable recordings;
    address public immutable governanceTimelock;
    address public licenseRegistry;

    mapping(bytes32 => uint32) private _latestVersion;
    mapping(bytes32 => mapping(uint32 => AuthorizationPolicy)) private _policies;

    constructor(address governanceTimelock_, address creatorProfiles_, address workRegistry_, address recordingRegistry_) {
        if (governanceTimelock_ == address(0) || creatorProfiles_ == address(0) || workRegistry_ == address(0) || recordingRegistry_ == address(0)) {
            revert CreativeErrors420.ZeroAddress();
        }
        governanceTimelock = governanceTimelock_;
        creatorProfiles = IAuthorizationProfiles420(creatorProfiles_);
        works = IAuthorizationWorkController420(workRegistry_);
        recordings = IAuthorizationRecordingController420(recordingRegistry_);
    }

    function setLicenseRegistry(address licenseRegistry_) external {
        if (msg.sender != governanceTimelock) revert CreativeErrors420.Unauthorized();
        if (licenseRegistry_ == address(0)) revert CreativeErrors420.ZeroAddress();
        licenseRegistry = licenseRegistry_;
    }

    function setPolicy(
        CreativeAssetType assetType,
        uint256 assetId,
        PolicyPreset preset,
        uint256 permissionMask,
        uint256 trainingPermissionMask,
        uint64 effectiveAt,
        uint64 expiresAt,
        bytes32 termsHash
    ) external returns (uint32 policyVersion) {
        CreatorId controller = _controller(assetType, assetId);
        if (!creatorProfiles.isAuthorized(controller, msg.sender)) revert CreativeErrors420.Unauthorized();
        policyVersion = ++_latestVersion[CreativeAssetKeys420.key(assetType, assetId)];
        bytes32 assetKey = CreativeAssetKeys420.key(assetType, assetId);
        _policies[assetKey][policyVersion] = AuthorizationPolicy({
            preset: preset,
            permissionMask: permissionMask,
            trainingPermissionMask: trainingPermissionMask,
            version: policyVersion,
            effectiveAt: effectiveAt == 0 ? uint64(block.timestamp) : effectiveAt,
            expiresAt: expiresAt,
            termsHash: termsHash,
            active: true
        });
        emit AuthorizationPolicySet(assetKey, policyVersion, permissionMask, trainingPermissionMask);
    }

    function canCreateDerivative(
        CreatorId actorProfileId,
        WorkId workId,
        RecordingId sourceRecordingId,
        RecordingClass derivativeClass,
        LicenseId licenseId
    ) external view returns (bool) {
        (uint256 workMask, uint256 sourceMask) = _requiredPermissions(derivativeClass);
        if (!_policyAllows(CreativeAssetType.WORK, WorkId.unwrap(workId), workMask)) return false;
        if (sourceMask == 0) return true;

        uint256 sourceId = RecordingId.unwrap(sourceRecordingId);
        if (sourceId == 0) return false;
        if (_policyAllows(CreativeAssetType.RECORDING, sourceId, sourceMask)) return true;
        if (LicenseId.unwrap(licenseId) == 0 || licenseRegistry == address(0)) return false;
        return ILicensePermissionResolver420(licenseRegistry).hasPermissions(
            licenseId,
            actorProfileId,
            CreativeAssetType.RECORDING,
            sourceId,
            sourceMask
        );
    }

    function currentPolicy(CreativeAssetType assetType, uint256 assetId) external view returns (AuthorizationPolicy memory) {
        bytes32 key = CreativeAssetKeys420.key(assetType, assetId);
        return _policies[key][_latestVersion[key]];
    }

    function policyAt(CreativeAssetType assetType, uint256 assetId, uint32 version)
        external
        view
        returns (AuthorizationPolicy memory)
    {
        return _policies[CreativeAssetKeys420.key(assetType, assetId)][version];
    }

    function _policyAllows(CreativeAssetType assetType, uint256 assetId, uint256 requiredMask) internal view returns (bool) {
        bytes32 key = CreativeAssetKeys420.key(assetType, assetId);
        AuthorizationPolicy storage policy = _policies[key][_latestVersion[key]];
        if (!policy.active || policy.version == 0) return false;
        if (block.timestamp < policy.effectiveAt) return false;
        if (policy.expiresAt != 0 && block.timestamp > policy.expiresAt) return false;
        return (policy.permissionMask & requiredMask) == requiredMask;
    }

    function _requiredPermissions(RecordingClass derivativeClass) internal pure returns (uint256 workMask, uint256 sourceMask) {
        if (derivativeClass == RecordingClass.COVER) {
            return (CreativePermissions420.CREATE_COVER | CreativePermissions420.COMMERCIALIZE, 0);
        }
        if (derivativeClass == RecordingClass.REMIX) {
            return (
                CreativePermissions420.CREATE_REMIX | CreativePermissions420.COMMERCIALIZE,
                CreativePermissions420.CREATE_REMIX | CreativePermissions420.USE_MASTER | CreativePermissions420.COMMERCIALIZE
            );
        }
        if (derivativeClass == RecordingClass.STEM_REMIX) {
            return (
                CreativePermissions420.CREATE_REMIX | CreativePermissions420.COMMERCIALIZE,
                CreativePermissions420.CREATE_REMIX | CreativePermissions420.USE_STEMS | CreativePermissions420.COMMERCIALIZE
            );
        }
        if (derivativeClass == RecordingClass.SAMPLE_DERIVATIVE) {
            return (
                CreativePermissions420.COMMERCIALIZE,
                CreativePermissions420.USE_SAMPLE | CreativePermissions420.COMMERCIALIZE
            );
        }
        if (derivativeClass == RecordingClass.AI_DERIVATIVE) {
            return (
                CreativePermissions420.COMMERCIALIZE,
                CreativePermissions420.AI_TRANSFORM | CreativePermissions420.USE_MASTER | CreativePermissions420.COMMERCIALIZE
            );
        }
        revert CreativeErrors420.InvalidState();
    }

    function _controller(CreativeAssetType assetType, uint256 assetId) internal view returns (CreatorId) {
        if (assetType == CreativeAssetType.WORK) return works.registrantProfileOf(WorkId.wrap(assetId));
        if (assetType == CreativeAssetType.RECORDING) return recordings.registrantProfileOf(RecordingId.wrap(assetId));
        revert CreativeErrors420.InvalidId();
    }
}
