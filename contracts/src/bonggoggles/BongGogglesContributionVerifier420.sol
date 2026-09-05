// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BongGogglesIds420.sol";

interface IBongGogglesSocialObjectsForRewards420 {
    struct SocialObject {
        bytes32 objectId;
        BongGogglesTypes420.SocialObjectType objectType;
        address author;
        bytes32 parentId;
        bytes32 rootId;
        bytes32 communityId;
        bytes32 subjectRef;
        bytes32 contentHash;
        bytes32 mediaRoot;
        BongGogglesTypes420.AudienceType audienceType;
        bytes32 audienceRef;
        BongGogglesTypes420.ProvenanceType provenanceType;
        bytes32 sourceObjectId;
        uint32 sourceVersion;
        uint64 createdAt;
        uint64 updatedAt;
        uint32 version;
        BongGogglesTypes420.SocialObjectStatus status;
        bool exists;
    }

    function socialObject(bytes32 objectId) external view returns (SocialObject memory);
}

interface IBongGogglesDiscoveryForRewards420 {
    struct Subject {
        bytes32 subjectId;
        BongGogglesTypes420.DiscoverySubjectType subjectType;
        bytes32 canonicalRef;
        bytes32 metadataRoot;
        bytes32 locationCommitment;
        BongGogglesTypes420.LocationPrecision locationPrecision;
        address submitter;
        uint64 createdAt;
        BongGogglesTypes420.DiscoveryStatus status;
        bool exists;
    }

    struct Review {
        bytes32 reviewId;
        bytes32 subjectId;
        address author;
        bytes32 contentHash;
        uint16 ratingBps;
        uint32 version;
        bool active;
        uint64 updatedAt;
    }

    struct Correction {
        bytes32 correctionId;
        bytes32 subjectId;
        address author;
        bytes32 fieldId;
        bytes32 proposedValueHash;
        bytes32 evidenceHash;
        uint64 createdAt;
    }

    struct Verification {
        bytes32 verificationId;
        bytes32 subjectId;
        address verifier;
        bytes32 propositionHash;
        uint32 subjectVersion;
        bool supportsProposition;
        bytes32 evidenceHash;
        uint64 createdAt;
    }

    function subject(bytes32 subjectId) external view returns (Subject memory);
    function review(bytes32 reviewId) external view returns (Review memory);
    function correction(bytes32 correctionId) external view returns (Correction memory);
    function verification(bytes32 verificationId) external view returns (Verification memory);
}

contract BongGogglesContributionVerifier420 {
    bytes32 public constant APP_ID_BONG_GOGGLES = keccak256("420/APP/BONG_GOGGLES/V1");

    bytes32 public constant CONTRIBUTION_POST = keccak256("420/BONG_GOGGLES/REWARD/POST/V1");
    bytes32 public constant CONTRIBUTION_PHOTO = keccak256("420/BONG_GOGGLES/REWARD/PHOTO/V1");
    bytes32 public constant CONTRIBUTION_STORY = keccak256("420/BONG_GOGGLES/REWARD/STORY/V1");
    bytes32 public constant CONTRIBUTION_DISCOVERY = keccak256("420/BONG_GOGGLES/REWARD/DISCOVERY/V1");
    bytes32 public constant CONTRIBUTION_REVIEW = keccak256("420/BONG_GOGGLES/REWARD/REVIEW/V1");
    bytes32 public constant CONTRIBUTION_CORRECTION = keccak256("420/BONG_GOGGLES/REWARD/CORRECTION/V1");
    bytes32 public constant CONTRIBUTION_VERIFICATION = keccak256("420/BONG_GOGGLES/REWARD/VERIFICATION/V1");

    struct VerifiedContribution {
        bytes32 contributionType;
        address beneficiary;
        bytes32 sourceKey;
        bytes32 evidenceHash;
    }

    IBongGogglesSocialObjectsForRewards420 public immutable socialObjects;
    IBongGogglesDiscoveryForRewards420 public immutable discovery;

    error ZeroAddress();
    error SourceMissing();
    error SourceInactive();
    error UnsupportedContribution();

    constructor(address socialObjects_, address discovery_) {
        if (socialObjects_ == address(0) || discovery_ == address(0)) revert ZeroAddress();
        socialObjects = IBongGogglesSocialObjectsForRewards420(socialObjects_);
        discovery = IBongGogglesDiscoveryForRewards420(discovery_);
    }

    function verifySocialObject(bytes32 objectId) external view returns (VerifiedContribution memory verified) {
        IBongGogglesSocialObjectsForRewards420.SocialObject memory object_ = socialObjects.socialObject(objectId);
        if (!object_.exists || object_.author == address(0)) revert SourceMissing();
        if (object_.status != BongGogglesTypes420.SocialObjectStatus.ACTIVE) revert SourceInactive();

        bytes32 contributionType;
        if (object_.objectType == BongGogglesTypes420.SocialObjectType.STATUS) {
            contributionType = CONTRIBUTION_POST;
        } else if (object_.objectType == BongGogglesTypes420.SocialObjectType.PHOTO_POST) {
            contributionType = CONTRIBUTION_PHOTO;
        } else if (object_.objectType == BongGogglesTypes420.SocialObjectType.STORY) {
            contributionType = CONTRIBUTION_STORY;
        } else {
            revert UnsupportedContribution();
        }

        verified = VerifiedContribution({
            contributionType: contributionType,
            beneficiary: object_.author,
            sourceKey: keccak256(abi.encode("420/BONG_GOGGLES/REWARD_SOURCE/SOCIAL_OBJECT/V1", block.chainid, objectId)),
            evidenceHash: keccak256(abi.encode(
                "420/BONG_GOGGLES/REWARD_EVIDENCE/SOCIAL_OBJECT/V1",
                block.chainid,
                objectId,
                object_.version,
                object_.contentHash,
                object_.mediaRoot
            ))
        });
    }

    function verifyDiscovery(bytes32 subjectId) external view returns (VerifiedContribution memory verified) {
        IBongGogglesDiscoveryForRewards420.Subject memory s = discovery.subject(subjectId);
        if (!s.exists || s.submitter == address(0)) revert SourceMissing();
        if (
            s.status == BongGogglesTypes420.DiscoveryStatus.INVALID ||
            s.status == BongGogglesTypes420.DiscoveryStatus.CLOSED ||
            s.status == BongGogglesTypes420.DiscoveryStatus.MERGED
        ) revert SourceInactive();

        verified = VerifiedContribution({
            contributionType: CONTRIBUTION_DISCOVERY,
            beneficiary: s.submitter,
            sourceKey: keccak256(abi.encode("420/BONG_GOGGLES/REWARD_SOURCE/DISCOVERY/V1", block.chainid, subjectId)),
            evidenceHash: keccak256(abi.encode(
                "420/BONG_GOGGLES/REWARD_EVIDENCE/DISCOVERY/V1",
                block.chainid,
                subjectId,
                s.subjectType,
                s.canonicalRef,
                s.metadataRoot,
                s.locationCommitment,
                s.locationPrecision,
                s.status
            ))
        });
    }

    function verifyReview(bytes32 reviewId) external view returns (VerifiedContribution memory verified) {
        IBongGogglesDiscoveryForRewards420.Review memory r = discovery.review(reviewId);
        if (r.reviewId == bytes32(0) || r.author == address(0)) revert SourceMissing();
        if (!r.active) revert SourceInactive();

        verified = VerifiedContribution({
            contributionType: CONTRIBUTION_REVIEW,
            beneficiary: r.author,
            sourceKey: keccak256(abi.encode("420/BONG_GOGGLES/REWARD_SOURCE/REVIEW/V1", block.chainid, r.subjectId, r.author)),
            evidenceHash: keccak256(abi.encode(
                "420/BONG_GOGGLES/REWARD_EVIDENCE/REVIEW/V1",
                block.chainid,
                reviewId,
                r.subjectId,
                r.contentHash,
                r.ratingBps,
                r.version
            ))
        });
    }

    function verifyCorrection(bytes32 correctionId) external view returns (VerifiedContribution memory verified) {
        IBongGogglesDiscoveryForRewards420.Correction memory c = discovery.correction(correctionId);
        if (c.correctionId == bytes32(0) || c.author == address(0)) revert SourceMissing();

        verified = VerifiedContribution({
            contributionType: CONTRIBUTION_CORRECTION,
            beneficiary: c.author,
            sourceKey: keccak256(abi.encode("420/BONG_GOGGLES/REWARD_SOURCE/CORRECTION/V1", block.chainid, correctionId)),
            evidenceHash: keccak256(abi.encode(
                "420/BONG_GOGGLES/REWARD_EVIDENCE/CORRECTION/V1",
                block.chainid,
                correctionId,
                c.subjectId,
                c.fieldId,
                c.proposedValueHash,
                c.evidenceHash
            ))
        });
    }

    function verifyVerification(bytes32 verificationId) external view returns (VerifiedContribution memory verified) {
        IBongGogglesDiscoveryForRewards420.Verification memory v = discovery.verification(verificationId);
        if (v.verificationId == bytes32(0) || v.verifier == address(0)) revert SourceMissing();

        verified = VerifiedContribution({
            contributionType: CONTRIBUTION_VERIFICATION,
            beneficiary: v.verifier,
            sourceKey: keccak256(abi.encode("420/BONG_GOGGLES/REWARD_SOURCE/VERIFICATION/V1", block.chainid, verificationId)),
            evidenceHash: keccak256(abi.encode(
                "420/BONG_GOGGLES/REWARD_EVIDENCE/VERIFICATION/V1",
                block.chainid,
                verificationId,
                v.subjectId,
                v.propositionHash,
                v.subjectVersion,
                v.supportsProposition,
                v.evidenceHash
            ))
        });
    }
}
