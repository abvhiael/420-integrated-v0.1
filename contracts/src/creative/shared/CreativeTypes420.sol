// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

type CreatorId is uint256;
type WorkId is uint256;
type RecordingId is uint256;
type LicenseId is uint256;

enum CreativeAssetType { NONE, WORK, RECORDING }
enum IdentityType { INDIVIDUAL, ARTIST_PROJECT, GROUP, ORGANIZATION, ESTATE, MODEL_OPERATOR }
enum ProfileStatus { ACTIVE, SUSPENDED, RECOVERY_PENDING, ARCHIVED }
enum AssetStatus { PROVISIONAL, ACTIVE, CANCELLED, WITHDRAWN, SUPERSEDED, DISPUTED, RESTRICTED, TOMBSTONED }
enum ProvenanceClass { NATIVE_VERIFIED, EXTERNAL_VERIFIED, EXTERNAL_DECLARED, UNKNOWN_PROVENANCE }
enum RightsStatus { RIGHTS_VERIFIED, RIGHTS_PARTIAL, RIGHTS_DECLARED, RIGHTS_UNKNOWN, RIGHTS_DISPUTED }
enum RecordingClass { ORIGINAL, COVER, REMIX, STEM_REMIX, SAMPLE_DERIVATIVE, AI_DERIVATIVE, LIVE, ACOUSTIC, REMASTER, RADIO_EDIT, CLEAN_EDIT, SPATIAL, RESTORATION, OTHER }
enum CreditStatus { PROPOSED, ACCEPTED, REJECTED, REVOKED_BY_CONTRIBUTOR, DISPUTED }
enum SplitStatus { UNSET, PROPOSED, PARTIALLY_ACCEPTED, FINALIZED, DISPUTED }
enum PolicyPreset { CLOSED, APPROVAL_REQUIRED, OPEN_COVER, OPEN_REMIX, OPEN_DERIVATIVE, CUSTOM }
enum LicenseStatus { PENDING, ACTIVE, EXPIRED, TERMINATED, REVOKED_BEFORE_EFFECT, DISPUTED }
enum RevenueType { STREAM, DIRECT_SALE, DOWNLOAD, SYNC, REMIX_LICENSE, SAMPLE_LICENSE, AI_TRAINING, TIP, SUBSCRIPTION_POOL }

struct CreatorProfile420 {
    address primaryAccount;
    bytes32 metadataHash;
    uint64 createdAt;
    uint64 updatedAt;
    IdentityType identityType;
    ProfileStatus status;
}

struct Work420 {
    WorkId familyId;
    WorkId previousWorkId;
    uint32 version;
    bytes32 compositionHash;
    bytes32 metadataHash;
    bytes32 provenanceHash;
    uint64 registeredAt;
    uint64 updatedAt;
    ProvenanceClass provenanceClass;
    RightsStatus rightsStatus;
    AssetStatus status;
    uint32 authorizationPolicyVersion;
    CreatorId registrantProfileId;
}

struct Recording420 {
    WorkId workId;
    RecordingId parentRecordingId;
    RecordingId supersedesRecordingId;
    bytes32 masterHash;
    bytes32 metadataHash;
    bytes32 provenanceHash;
    bytes32 mediaManifestHash;
    bytes32 authorizationManifestHash;
    uint64 registeredAt;
    uint64 updatedAt;
    RecordingClass recordingClass;
    ProvenanceClass provenanceClass;
    RightsStatus rightsStatus;
    AssetStatus status;
    uint32 royaltyScheduleVersion;
    uint32 authorizationPolicyVersion;
    CreatorId registrantProfileId;
}

struct RoyaltySchedule420 {
    uint16 workBps;
    uint16 sourceBps;
    uint16 currentRecordingBps;
    uint16 protocolBps;
    uint32 version;
    uint64 effectiveAt;
    bytes32 termsHash;
}

library CreativeConstants420 {
    uint16 internal constant BPS_DENOMINATOR = 10_000;
    uint16 internal constant MAX_PROTOCOL_FEE_BPS = 500;
    uint8 internal constant MAX_RIGHTS_HOLDERS = 64;
    uint8 internal constant MAX_SOURCES = 8;
}

library CreativePermissions420 {
    uint256 internal constant CREATE_COVER = 1 << 0;
    uint256 internal constant CREATE_REMIX = 1 << 1;
    uint256 internal constant USE_MASTER = 1 << 2;
    uint256 internal constant USE_STEMS = 1 << 3;
    uint256 internal constant USE_SAMPLE = 1 << 4;
    uint256 internal constant CREATE_ARRANGEMENT = 1 << 5;
    uint256 internal constant TRANSLATE = 1 << 6;
    uint256 internal constant AI_TRANSFORM = 1 << 7;
    uint256 internal constant COMMERCIALIZE = 1 << 8;
    uint256 internal constant SUBLICENSE = 1 << 9;
    uint256 internal constant DISTRIBUTE = 1 << 10;
    uint256 internal constant SYNC = 1 << 11;
    uint256 internal constant ALLOW_EXTERNAL_PROCESSING = 1 << 12;
    uint256 internal constant ALLOW_EXTERNAL_DISTRIBUTION = 1 << 13;
}

library CreativeAssetKeys420 {
    function key(CreativeAssetType assetType, uint256 assetId) internal pure returns (bytes32) {
        return keccak256(abi.encode(assetType, assetId));
    }
}
