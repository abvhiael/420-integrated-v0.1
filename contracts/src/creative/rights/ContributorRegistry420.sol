// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../shared/CreativeTypes420.sol";
import "../shared/CreativeErrors420.sol";
import "../shared/CreativeEvents420.sol";

interface IContributorProfiles420 {
    function isAuthorized(CreatorId creatorId, address account) external view returns (bool);
}

interface IWorkController420 {
    function registrantProfileOf(WorkId workId) external view returns (CreatorId);
}

interface IRecordingController420 {
    function registrantProfileOf(RecordingId recordingId) external view returns (CreatorId);
}

contract ContributorRegistry420 is CreativeEvents420 {
    struct Credit {
        CreativeAssetType assetType;
        uint256 assetId;
        CreatorId contributorProfileId;
        uint32 roleSchemaVersion;
        uint32 roleCode;
        CreditStatus status;
        uint64 proposedAt;
        uint64 acceptedAt;
    }

    IContributorProfiles420 public immutable creatorProfiles;
    IWorkController420 public immutable works;
    IRecordingController420 public immutable recordings;

    mapping(bytes32 => Credit) private _credits;
    mapping(bytes32 => uint256) private _creditNonces;

    constructor(address creatorProfiles_, address workRegistry_, address recordingRegistry_) {
        if (creatorProfiles_ == address(0) || workRegistry_ == address(0) || recordingRegistry_ == address(0)) {
            revert CreativeErrors420.ZeroAddress();
        }
        creatorProfiles = IContributorProfiles420(creatorProfiles_);
        works = IWorkController420(workRegistry_);
        recordings = IRecordingController420(recordingRegistry_);
    }

    function proposeCredit(
        CreativeAssetType assetType,
        uint256 assetId,
        CreatorId contributorProfileId,
        uint32 roleSchemaVersion,
        uint32 roleCode
    ) external returns (bytes32 creditId) {
        CreatorId controller = _controller(assetType, assetId);
        if (!creatorProfiles.isAuthorized(controller, msg.sender)) revert CreativeErrors420.Unauthorized();
        if (CreatorId.unwrap(contributorProfileId) == 0 || roleSchemaVersion == 0) revert CreativeErrors420.InvalidId();
        bytes32 assetKey = CreativeAssetKeys420.key(assetType, assetId);
        uint256 nonce = ++_creditNonces[assetKey];
        creditId = keccak256(abi.encode(assetKey, contributorProfileId, roleSchemaVersion, roleCode, nonce));
        _credits[creditId] = Credit({
            assetType: assetType,
            assetId: assetId,
            contributorProfileId: contributorProfileId,
            roleSchemaVersion: roleSchemaVersion,
            roleCode: roleCode,
            status: CreditStatus.PROPOSED,
            proposedAt: uint64(block.timestamp),
            acceptedAt: 0
        });
        emit CreditProposed(creditId, uint8(assetType), assetId, CreatorId.unwrap(contributorProfileId), roleSchemaVersion, roleCode);
    }

    function acceptCredit(bytes32 creditId) external {
        Credit storage credit = _credits[creditId];
        if (credit.proposedAt == 0) revert CreativeErrors420.NotFound();
        if (credit.status != CreditStatus.PROPOSED) revert CreativeErrors420.InvalidState();
        if (!creatorProfiles.isAuthorized(credit.contributorProfileId, msg.sender)) revert CreativeErrors420.Unauthorized();
        credit.status = CreditStatus.ACCEPTED;
        credit.acceptedAt = uint64(block.timestamp);
        emit CreditAccepted(creditId, CreatorId.unwrap(credit.contributorProfileId));
    }

    function credit(bytes32 creditId) external view returns (Credit memory) {
        Credit storage c = _credits[creditId];
        if (c.proposedAt == 0) revert CreativeErrors420.NotFound();
        return c;
    }

    function _controller(CreativeAssetType assetType, uint256 assetId) internal view returns (CreatorId) {
        if (assetType == CreativeAssetType.WORK) return works.registrantProfileOf(WorkId.wrap(assetId));
        if (assetType == CreativeAssetType.RECORDING) return recordings.registrantProfileOf(RecordingId.wrap(assetId));
        revert CreativeErrors420.InvalidId();
    }
}
