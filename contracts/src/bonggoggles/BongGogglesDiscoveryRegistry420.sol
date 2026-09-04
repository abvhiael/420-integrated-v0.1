// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BongGogglesAuthorization420.sol";
import "./BongGogglesProfileRegistry420.sol";
import "./BongGogglesIds420.sol";

contract BongGogglesDiscoveryRegistry420 {
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
        bool supports;
        bytes32 evidenceHash;
        uint64 createdAt;
    }

    BongGogglesAuthorization420 public immutable authorization;
    BongGogglesProfileRegistry420 public immutable profiles;

    mapping(bytes32 => Subject) private _subjects;
    mapping(bytes32 => Review) private _reviews;
    mapping(bytes32 => bytes32) public activeReviewFor;
    mapping(bytes32 => Correction) private _corrections;
    mapping(bytes32 => Verification) private _verifications;

    error ZeroAddress();
    error Unauthorized();
    error InactiveProfile();
    error InvalidSubject();
    error SubjectExists();
    error SubjectMissing();
    error ReviewMissing();
    error InvalidRating();
    error InvalidCorrection();
    error InvalidVerification();

    event SubjectSubmitted(bytes32 indexed subjectId, address indexed submitter, BongGogglesTypes420.DiscoverySubjectType subjectType, bytes32 canonicalRef);
    event ReviewPublished(bytes32 indexed reviewId, bytes32 indexed subjectId, address indexed author, uint32 version, uint16 ratingBps, bytes32 contentHash);
    event ReviewWithdrawn(bytes32 indexed reviewId, bytes32 indexed subjectId, address indexed author);
    event CorrectionSubmitted(bytes32 indexed correctionId, bytes32 indexed subjectId, address indexed author, bytes32 fieldId, bytes32 proposedValueHash);
    event VerificationAttested(bytes32 indexed verificationId, bytes32 indexed subjectId, address indexed verifier, bytes32 propositionHash, uint32 subjectVersion, bool supports);

    constructor(address authorization_, address profiles_) {
        if (authorization_ == address(0) || profiles_ == address(0)) revert ZeroAddress();
        authorization = BongGogglesAuthorization420(authorization_);
        profiles = BongGogglesProfileRegistry420(profiles_);
    }

    function subjectIdFor(BongGogglesTypes420.DiscoverySubjectType subjectType, bytes32 canonicalRef) public view returns (bytes32) {
        return keccak256(abi.encode("420/BONG_GOGGLES/DISCOVERY_SUBJECT/V1", block.chainid, subjectType, canonicalRef));
    }

    function submitSubject(
        address submitter,
        BongGogglesTypes420.DiscoverySubjectType subjectType,
        bytes32 canonicalRef,
        bytes32 metadataRoot,
        bytes32 locationCommitment,
        BongGogglesTypes420.LocationPrecision locationPrecision
    ) external returns (bytes32 subjectId) {
        if (!authorization.canActFor(msg.sender, submitter, BongGogglesIds420.ACTION_DISCOVERY_SUBMIT)) revert Unauthorized();
        if (!profiles.isActive(submitter)) revert InactiveProfile();
        if (canonicalRef == bytes32(0)) revert InvalidSubject();
        subjectId = subjectIdFor(subjectType, canonicalRef);
        if (_subjects[subjectId].exists) revert SubjectExists();
        _subjects[subjectId] = Subject(
            subjectId,
            subjectType,
            canonicalRef,
            metadataRoot,
            locationCommitment,
            locationPrecision,
            submitter,
            uint64(block.timestamp),
            BongGogglesTypes420.DiscoveryStatus.SUBMITTED,
            true
        );
        emit SubjectSubmitted(subjectId, submitter, subjectType, canonicalRef);
    }

    function publishReview(address author, bytes32 subjectId, bytes32 contentHash, uint16 ratingBps) external returns (bytes32 reviewId) {
        if (!authorization.canActFor(msg.sender, author, BongGogglesIds420.ACTION_REVIEW_PUBLISH)) revert Unauthorized();
        if (!profiles.isActive(author)) revert InactiveProfile();
        if (!_subjects[subjectId].exists) revert SubjectMissing();
        if (contentHash == bytes32(0) || ratingBps > 10000) revert InvalidRating();

        bytes32 key = keccak256(abi.encode(subjectId, author));
        bytes32 priorId = activeReviewFor[key];
        uint32 version = 1;
        if (priorId != bytes32(0)) {
            Review storage prior = _reviews[priorId];
            prior.active = false;
            version = prior.version + 1;
        }
        reviewId = keccak256(abi.encode("420/BONG_GOGGLES/REVIEW/V1", block.chainid, subjectId, author, version));
        _reviews[reviewId] = Review(reviewId, subjectId, author, contentHash, ratingBps, version, true, uint64(block.timestamp));
        activeReviewFor[key] = reviewId;
        emit ReviewPublished(reviewId, subjectId, author, version, ratingBps, contentHash);
    }

    function withdrawReview(address author, bytes32 subjectId) external {
        if (!authorization.canActFor(msg.sender, author, BongGogglesIds420.ACTION_REVIEW_WITHDRAW)) revert Unauthorized();
        bytes32 key = keccak256(abi.encode(subjectId, author));
        bytes32 reviewId = activeReviewFor[key];
        if (reviewId == bytes32(0)) revert ReviewMissing();
        Review storage r = _reviews[reviewId];
        r.active = false;
        activeReviewFor[key] = bytes32(0);
        emit ReviewWithdrawn(reviewId, subjectId, author);
    }

    function submitCorrection(address author, bytes32 subjectId, bytes32 fieldId, bytes32 proposedValueHash, bytes32 evidenceHash)
        external returns (bytes32 correctionId)
    {
        if (!authorization.canActFor(msg.sender, author, BongGogglesIds420.ACTION_CORRECTION_SUBMIT)) revert Unauthorized();
        if (!profiles.isActive(author)) revert InactiveProfile();
        if (!_subjects[subjectId].exists) revert SubjectMissing();
        if (fieldId == bytes32(0) || proposedValueHash == bytes32(0)) revert InvalidCorrection();
        correctionId = keccak256(abi.encode("420/BONG_GOGGLES/CORRECTION/V1", block.chainid, subjectId, author, fieldId, proposedValueHash, block.timestamp));
        _corrections[correctionId] = Correction(correctionId, subjectId, author, fieldId, proposedValueHash, evidenceHash, uint64(block.timestamp));
        emit CorrectionSubmitted(correctionId, subjectId, author, fieldId, proposedValueHash);
    }

    function attestVerification(
        address verifier,
        bytes32 subjectId,
        bytes32 propositionHash,
        uint32 subjectVersion,
        bool supports,
        bytes32 evidenceHash
    ) external returns (bytes32 verificationId) {
        if (!authorization.canActFor(msg.sender, verifier, BongGogglesIds420.ACTION_VERIFICATION_ATTEST)) revert Unauthorized();
        if (!profiles.isActive(verifier)) revert InactiveProfile();
        if (!_subjects[subjectId].exists) revert SubjectMissing();
        if (propositionHash == bytes32(0) || subjectVersion == 0) revert InvalidVerification();
        verificationId = keccak256(abi.encode("420/BONG_GOGGLES/VERIFICATION/V1", block.chainid, subjectId, verifier, propositionHash, subjectVersion));
        _verifications[verificationId] = Verification(verificationId, subjectId, verifier, propositionHash, subjectVersion, supports, evidenceHash, uint64(block.timestamp));
        emit VerificationAttested(verificationId, subjectId, verifier, propositionHash, subjectVersion, supports);
    }

    function subject(bytes32 subjectId) external view returns (Subject memory) { return _subjects[subjectId]; }
    function review(bytes32 reviewId) external view returns (Review memory) { return _reviews[reviewId]; }
    function correction(bytes32 correctionId) external view returns (Correction memory) { return _corrections[correctionId]; }
    function verification(bytes32 verificationId) external view returns (Verification memory) { return _verifications[verificationId]; }
}
