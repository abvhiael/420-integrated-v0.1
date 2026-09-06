// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

abstract contract CreativeEvents420 {
    event CreativeModuleRegistered(bytes32 indexed moduleKey, address indexed implementation, uint32 version);
    event CreatorProfileCreated(uint256 indexed creatorId, address indexed primaryAccount, bytes32 metadataHash);
    event CreatorProfileUpdated(uint256 indexed creatorId, bytes32 metadataHash);
    event WorkRegistered(uint256 indexed workId, uint256 indexed familyId, uint32 version, uint256 registrantProfileId);
    event WorkActivated(uint256 indexed workId);
    event RecordingRegistered(uint256 indexed recordingId, uint256 indexed workId, uint8 recordingClass, uint256 registrantProfileId);
    event RecordingActivated(uint256 indexed recordingId, uint32 royaltyScheduleVersion, uint32 authorizationPolicyVersion);
    event CreditProposed(bytes32 indexed creditId, uint8 indexed assetType, uint256 indexed assetId, uint256 contributorProfileId, uint32 roleSchemaVersion, uint32 roleCode);
    event CreditAccepted(bytes32 indexed creditId, uint256 indexed contributorProfileId);
    event SplitProposed(bytes32 indexed assetKey, bytes32 indexed splitHash, uint32 proposalVersion);
    event RightsShareAccepted(bytes32 indexed assetKey, bytes32 indexed splitHash, uint256 indexed profileId, uint16 bps);
    event SplitFinalized(bytes32 indexed assetKey, bytes32 indexed splitHash, uint32 rightsVersion);
    event RightsTransferProposed(uint256 indexed transferId, bytes32 indexed assetKey, uint256 indexed fromProfileId, uint256 toProfileId, uint16 bps);
    event RightsTransferAccepted(uint256 indexed transferId, bytes32 indexed assetKey, uint32 rightsVersion);
    event AuthorizationPolicySet(bytes32 indexed assetKey, uint32 indexed policyVersion, uint256 permissionMask, uint256 trainingPermissionMask);
    event LicenseOfferCreated(uint256 indexed offerId, uint8 indexed assetType, uint256 indexed assetId, uint256 licensorProfileId, uint256 price);
    event LicenseIssued(uint256 indexed licenseId, uint256 indexed offerId, uint256 indexed licenseeProfileId);
    event RoyaltyScheduleRegistered(uint8 indexed recordingClass, uint8 indexed revenueType, uint32 indexed version, bytes32 scheduleHash);
    event RoyaltyRouted(bytes32 indexed settlementId, uint256 indexed recordingId, uint8 indexed revenueType, uint256 grossAmount);
    event RoyaltyPoolDeposited(bytes32 indexed assetKey, uint256 amount);
    event RoyaltyClaimed(bytes32 indexed assetKey, uint256 indexed profileId, address indexed recipient, uint256 amount);
    event TreasuryRoyaltyAccrued(uint256 amount);
    event TreasuryRoyaltyClaimed(address indexed recipient, uint256 amount);
}
