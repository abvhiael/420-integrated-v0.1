// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../shared/CreativeTypes420.sol";
import "../shared/CreativeErrors420.sol";
import "../shared/CreativeEvents420.sol";

interface ICreatorAuthorization420 {
    function isAuthorized(CreatorId creatorId, address account) external view returns (bool);
}

interface IRightsFinalization420 {
    function isFinalized(bytes32 assetKey) external view returns (bool);
}

contract WorkRegistry420 is CreativeEvents420 {
    ICreatorAuthorization420 public immutable creatorProfiles;
    address public immutable governanceTimelock;
    address public rightsRegistry;

    uint256 private _nextWorkId = 1;
    mapping(uint256 => Work420) private _works;

    constructor(address governanceTimelock_, address creatorProfiles_) {
        if (governanceTimelock_ == address(0) || creatorProfiles_ == address(0)) revert CreativeErrors420.ZeroAddress();
        governanceTimelock = governanceTimelock_;
        creatorProfiles = ICreatorAuthorization420(creatorProfiles_);
    }

    function setRightsRegistry(address rightsRegistry_) external {
        if (msg.sender != governanceTimelock) revert CreativeErrors420.Unauthorized();
        if (rightsRegistry_ == address(0)) revert CreativeErrors420.ZeroAddress();
        rightsRegistry = rightsRegistry_;
    }

    function registerWork(
        CreatorId registrantProfileId,
        WorkId previousWorkId,
        bytes32 compositionHash,
        bytes32 metadataHash,
        bytes32 provenanceHash,
        ProvenanceClass provenanceClass,
        RightsStatus rightsStatus
    ) external returns (WorkId workId) {
        if (!creatorProfiles.isAuthorized(registrantProfileId, msg.sender)) revert CreativeErrors420.Unauthorized();
        if (compositionHash == bytes32(0) || provenanceHash == bytes32(0)) revert CreativeErrors420.InvalidId();

        uint256 id = _nextWorkId++;
        uint256 previous = WorkId.unwrap(previousWorkId);
        uint256 family = id;
        uint32 version = 1;
        if (previous != 0) {
            Work420 storage prior = _requireWork(previous);
            family = WorkId.unwrap(prior.familyId);
            version = prior.version + 1;
        }

        _works[id] = Work420({
            familyId: WorkId.wrap(family),
            previousWorkId: previousWorkId,
            version: version,
            compositionHash: compositionHash,
            metadataHash: metadataHash,
            provenanceHash: provenanceHash,
            registeredAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp),
            provenanceClass: provenanceClass,
            rightsStatus: rightsStatus,
            status: AssetStatus.PROVISIONAL,
            authorizationPolicyVersion: 0,
            registrantProfileId: registrantProfileId
        });
        emit WorkRegistered(id, family, version, CreatorId.unwrap(registrantProfileId));
        return WorkId.wrap(id);
    }

    function activateWork(WorkId workId) external {
        uint256 id = WorkId.unwrap(workId);
        Work420 storage work = _requireWork(id);
        if (!creatorProfiles.isAuthorized(work.registrantProfileId, msg.sender)) revert CreativeErrors420.Unauthorized();
        if (work.status != AssetStatus.PROVISIONAL) revert CreativeErrors420.InvalidTransition();
        if (rightsRegistry == address(0)) revert CreativeErrors420.AccountingNotConfigured();
        bytes32 key = CreativeAssetKeys420.key(CreativeAssetType.WORK, id);
        if (!IRightsFinalization420(rightsRegistry).isFinalized(key)) revert CreativeErrors420.InvalidState();
        work.status = AssetStatus.ACTIVE;
        work.updatedAt = uint64(block.timestamp);
        emit WorkActivated(id);
    }

    function setAuthorizationPolicyVersion(WorkId workId, uint32 policyVersion) external {
        Work420 storage work = _requireWork(WorkId.unwrap(workId));
        if (!creatorProfiles.isAuthorized(work.registrantProfileId, msg.sender)) revert CreativeErrors420.Unauthorized();
        work.authorizationPolicyVersion = policyVersion;
        work.updatedAt = uint64(block.timestamp);
    }

    function registrantProfileOf(WorkId workId) external view returns (CreatorId) {
        return _requireWork(WorkId.unwrap(workId)).registrantProfileId;
    }

    function statusOf(WorkId workId) external view returns (AssetStatus) {
        return _requireWork(WorkId.unwrap(workId)).status;
    }

    function work(WorkId workId) external view returns (Work420 memory) {
        Work420 storage w = _requireWork(WorkId.unwrap(workId));
        return w;
    }

    function _requireWork(uint256 id) internal view returns (Work420 storage work_) {
        work_ = _works[id];
        if (WorkId.unwrap(work_.familyId) == 0) revert CreativeErrors420.NotFound();
    }
}
