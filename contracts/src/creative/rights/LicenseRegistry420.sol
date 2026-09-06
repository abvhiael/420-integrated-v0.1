// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../shared/CreativeTypes420.sol";
import "../shared/CreativeErrors420.sol";
import "../shared/CreativeEvents420.sol";

interface ILicenseProfiles420 {
    function isAuthorized(CreatorId creatorId, address account) external view returns (bool);
}

interface ILicenseRecordingController420 {
    function registrantProfileOf(RecordingId recordingId) external view returns (CreatorId);
}

interface ILicenseRoyaltyRouter420 {
    function route(RecordingId recordingId, RevenueType revenueType, bytes32 settlementId) external payable;
}

contract LicenseRegistry420 is CreativeEvents420 {
    struct LicenseOffer {
        RecordingId recordingId;
        CreatorId licensorProfileId;
        uint256 permissionMask;
        uint256 price;
        uint64 effectiveFrom;
        uint64 expiresAt;
        uint32 maxIssuances;
        uint32 issuedCount;
        bytes32 termsHash;
        bool active;
    }

    struct IssuedLicense {
        LicenseId licenseId;
        uint256 offerId;
        RecordingId recordingId;
        CreatorId licensorProfileId;
        CreatorId licenseeProfileId;
        uint256 permissionMask;
        uint64 effectiveFrom;
        uint64 expiresAt;
        bytes32 termsHash;
        LicenseStatus status;
    }

    ILicenseProfiles420 public immutable creatorProfiles;
    ILicenseRecordingController420 public immutable recordings;
    address public immutable governanceTimelock;
    address public royaltyRouter;

    uint256 private _nextOfferId = 1;
    uint256 private _nextLicenseId = 1;
    mapping(uint256 => LicenseOffer) private _offers;
    mapping(uint256 => IssuedLicense) private _licenses;

    constructor(address governanceTimelock_, address creatorProfiles_, address recordingRegistry_) {
        if (governanceTimelock_ == address(0) || creatorProfiles_ == address(0) || recordingRegistry_ == address(0)) {
            revert CreativeErrors420.ZeroAddress();
        }
        governanceTimelock = governanceTimelock_;
        creatorProfiles = ILicenseProfiles420(creatorProfiles_);
        recordings = ILicenseRecordingController420(recordingRegistry_);
    }

    function setRoyaltyRouter(address royaltyRouter_) external {
        if (msg.sender != governanceTimelock) revert CreativeErrors420.Unauthorized();
        if (royaltyRouter_ == address(0)) revert CreativeErrors420.ZeroAddress();
        royaltyRouter = royaltyRouter_;
    }

    function createRecordingOffer(
        RecordingId recordingId,
        uint256 permissionMask,
        uint256 price,
        uint64 effectiveFrom,
        uint64 expiresAt,
        uint32 maxIssuances,
        bytes32 termsHash
    ) external returns (uint256 offerId) {
        CreatorId licensor = recordings.registrantProfileOf(recordingId);
        if (!creatorProfiles.isAuthorized(licensor, msg.sender)) revert CreativeErrors420.Unauthorized();
        if (permissionMask == 0) revert CreativeErrors420.InvalidPermissionMask();
        offerId = _nextOfferId++;
        _offers[offerId] = LicenseOffer({
            recordingId: recordingId,
            licensorProfileId: licensor,
            permissionMask: permissionMask,
            price: price,
            effectiveFrom: effectiveFrom == 0 ? uint64(block.timestamp) : effectiveFrom,
            expiresAt: expiresAt,
            maxIssuances: maxIssuances,
            issuedCount: 0,
            termsHash: termsHash,
            active: true
        });
        emit LicenseOfferCreated(offerId, uint8(CreativeAssetType.RECORDING), RecordingId.unwrap(recordingId), CreatorId.unwrap(licensor), price);
    }

    function acceptOffer(uint256 offerId, CreatorId licenseeProfileId) external payable returns (LicenseId licenseId) {
        LicenseOffer storage offer = _offers[offerId];
        if (!offer.active || RecordingId.unwrap(offer.recordingId) == 0) revert CreativeErrors420.NotFound();
        if (!creatorProfiles.isAuthorized(licenseeProfileId, msg.sender)) revert CreativeErrors420.Unauthorized();
        if (block.timestamp < offer.effectiveFrom || (offer.expiresAt != 0 && block.timestamp > offer.expiresAt)) {
            revert CreativeErrors420.LicenseExpired();
        }
        if (offer.maxIssuances != 0 && offer.issuedCount >= offer.maxIssuances) revert CreativeErrors420.LicenseExhausted();
        if (msg.value != offer.price) revert CreativeErrors420.InvalidPayment(offer.price, msg.value);

        uint256 id = _nextLicenseId++;
        licenseId = LicenseId.wrap(id);
        _licenses[id] = IssuedLicense({
            licenseId: licenseId,
            offerId: offerId,
            recordingId: offer.recordingId,
            licensorProfileId: offer.licensorProfileId,
            licenseeProfileId: licenseeProfileId,
            permissionMask: offer.permissionMask,
            effectiveFrom: uint64(block.timestamp),
            expiresAt: offer.expiresAt,
            termsHash: offer.termsHash,
            status: LicenseStatus.ACTIVE
        });
        offer.issuedCount += 1;
        emit LicenseIssued(id, offerId, CreatorId.unwrap(licenseeProfileId));

        if (msg.value != 0) {
            if (royaltyRouter == address(0)) revert CreativeErrors420.AccountingNotConfigured();
            bytes32 settlementId = keccak256(abi.encode("420/LICENSE", block.chainid, address(this), id, offerId));
            ILicenseRoyaltyRouter420(royaltyRouter).route{value: msg.value}(
                offer.recordingId,
                RevenueType.REMIX_LICENSE,
                settlementId
            );
        }
    }

    function hasPermissions(
        LicenseId licenseId,
        CreatorId licenseeProfileId,
        CreativeAssetType assetType,
        uint256 assetId,
        uint256 requiredMask
    ) external view returns (bool) {
        if (assetType != CreativeAssetType.RECORDING) return false;
        IssuedLicense storage license_ = _licenses[LicenseId.unwrap(licenseId)];
        if (license_.status != LicenseStatus.ACTIVE) return false;
        if (CreatorId.unwrap(license_.licenseeProfileId) != CreatorId.unwrap(licenseeProfileId)) return false;
        if (RecordingId.unwrap(license_.recordingId) != assetId) return false;
        if (block.timestamp < license_.effectiveFrom) return false;
        if (license_.expiresAt != 0 && block.timestamp > license_.expiresAt) return false;
        return (license_.permissionMask & requiredMask) == requiredMask;
    }

    function offer(uint256 offerId) external view returns (LicenseOffer memory) {
        return _offers[offerId];
    }

    function license(LicenseId licenseId) external view returns (IssuedLicense memory) {
        IssuedLicense storage license_ = _licenses[LicenseId.unwrap(licenseId)];
        if (LicenseId.unwrap(license_.licenseId) == 0) revert CreativeErrors420.NotFound();
        return license_;
    }
}
