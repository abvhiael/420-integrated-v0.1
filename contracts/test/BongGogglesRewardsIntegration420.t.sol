// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bonggoggles/BongGogglesContributionVerifier420.sol";
import "../src/bonggoggles/BongGogglesRewardsAdapter420.sol";

interface VmBGRewards420 {
    function expectRevert(bytes4) external;
    function prank(address) external;
}

contract MockBGRewardSocialObjects420 is IBongGogglesSocialObjectsForRewards420 {
    mapping(bytes32 => SocialObject) private _objects;

    function setObject(bytes32 id, SocialObject calldata object_) external {
        _objects[id] = object_;
    }

    function socialObject(bytes32 id) external view returns (SocialObject memory) {
        return _objects[id];
    }
}

contract MockBGRewardDiscovery420 is IBongGogglesDiscoveryForRewards420 {
    mapping(bytes32 => Subject) private _subjects;
    mapping(bytes32 => Review) private _reviews;
    mapping(bytes32 => Correction) private _corrections;
    mapping(bytes32 => Verification) private _verifications;

    function setSubject(bytes32 id, Subject calldata value) external { _subjects[id] = value; }
    function setReview(bytes32 id, Review calldata value) external { _reviews[id] = value; }
    function setCorrection(bytes32 id, Correction calldata value) external { _corrections[id] = value; }
    function setVerification(bytes32 id, Verification calldata value) external { _verifications[id] = value; }

    function subject(bytes32 id) external view returns (Subject memory) { return _subjects[id]; }
    function review(bytes32 id) external view returns (Review memory) { return _reviews[id]; }
    function correction(bytes32 id) external view returns (Correction memory) { return _corrections[id]; }
    function verification(bytes32 id) external view returns (Verification memory) { return _verifications[id]; }
}

contract MockBGContributionRegistry420 is IContributionRegistryForBongGoggles420 {
    bytes32 public lastAppId;
    bytes32 public lastType;
    address public lastBeneficiary;
    bytes32 public lastContentHash;
    bytes32 public lastNonce;
    uint256 public publishCount;

    function publish(
        bytes32 appId,
        bytes32 contributionType,
        address beneficiary,
        bytes32 contentHash,
        bytes32 nonce
    ) external returns (bytes32 contributionId) {
        lastAppId = appId;
        lastType = contributionType;
        lastBeneficiary = beneficiary;
        lastContentHash = contentHash;
        lastNonce = nonce;
        publishCount += 1;
        contributionId = keccak256(abi.encode(appId, contributionType, beneficiary, contentHash, nonce));
    }
}

contract BongGogglesRewardsIntegration420Test {
    VmBGRewards420 constant vm = VmBGRewards420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant RELAY = address(0x4209);

    MockBGRewardSocialObjects420 social;
    MockBGRewardDiscovery420 discovery;
    MockBGContributionRegistry420 registry;
    BongGogglesContributionVerifier420 verifier;
    BongGogglesRewardsAdapter420 adapter;

    function setUp() public {
        social = new MockBGRewardSocialObjects420();
        discovery = new MockBGRewardDiscovery420();
        registry = new MockBGContributionRegistry420();
        verifier = new BongGogglesContributionVerifier420(address(social), address(discovery));
        adapter = new BongGogglesRewardsAdapter420(address(verifier), address(registry));
    }

    function _socialObject(
        bytes32 id,
        BongGogglesTypes420.SocialObjectType objectType,
        address author,
        BongGogglesTypes420.SocialObjectStatus status
    ) internal pure returns (IBongGogglesSocialObjectsForRewards420.SocialObject memory object_) {
        object_ = IBongGogglesSocialObjectsForRewards420.SocialObject({
            objectId: id,
            objectType: objectType,
            author: author,
            parentId: bytes32(0),
            rootId: bytes32(0),
            communityId: bytes32(0),
            subjectRef: bytes32(0),
            contentHash: keccak256("content"),
            mediaRoot: bytes32(0),
            audienceType: BongGogglesTypes420.AudienceType.PUBLIC,
            audienceRef: bytes32(0),
            provenanceType: BongGogglesTypes420.ProvenanceType.NONE,
            sourceObjectId: bytes32(0),
            sourceVersion: 0,
            createdAt: 1,
            updatedAt: 1,
            version: 1,
            status: status,
            exists: true
        });
    }

    function testCanonicalPostCanBeRelayedWithoutRedirectingBeneficiary() public {
        bytes32 id = keccak256("post-1");
        social.setObject(id, _socialObject(id, BongGogglesTypes420.SocialObjectType.STATUS, ALICE, BongGogglesTypes420.SocialObjectStatus.ACTIVE));

        vm.prank(RELAY);
        adapter.submitSocialObject(id);

        require(registry.lastAppId() == verifier.APP_ID_BONG_GOGGLES(), "app bound");
        require(registry.lastType() == verifier.CONTRIBUTION_POST(), "post type bound");
        require(registry.lastBeneficiary() == ALICE, "canonical beneficiary retained");
        require(registry.publishCount() == 1, "published once");
    }

    function testCommentsAreNotDefaultRewardable() public {
        bytes32 id = keccak256("comment-1");
        social.setObject(id, _socialObject(id, BongGogglesTypes420.SocialObjectType.COMMENT, ALICE, BongGogglesTypes420.SocialObjectStatus.ACTIVE));

        vm.expectRevert(BongGogglesContributionVerifier420.UnsupportedContribution.selector);
        adapter.submitSocialObject(id);
        require(registry.publishCount() == 0, "no comment reward contribution");
    }

    function testHiddenContentFailsClosed() public {
        bytes32 id = keccak256("post-hidden");
        social.setObject(id, _socialObject(id, BongGogglesTypes420.SocialObjectType.STATUS, ALICE, BongGogglesTypes420.SocialObjectStatus.HIDDEN));

        vm.expectRevert(BongGogglesContributionVerifier420.SourceInactive.selector);
        adapter.submitSocialObject(id);
    }

    function testAdapterRejectsDuplicateCanonicalSource() public {
        bytes32 id = keccak256("photo-1");
        social.setObject(id, _socialObject(id, BongGogglesTypes420.SocialObjectType.PHOTO_POST, ALICE, BongGogglesTypes420.SocialObjectStatus.ACTIVE));

        adapter.submitSocialObject(id);
        vm.expectRevert(BongGogglesRewardsAdapter420.Replay.selector);
        adapter.submitSocialObject(id);
        require(registry.publishCount() == 1, "only one canonical contribution");
    }

    function testReviewVersionsShareOneRewardSourcePerAuthorSubject() public {
        bytes32 subjectId = keccak256("subject");
        bytes32 reviewOne = keccak256("review-1");
        bytes32 reviewTwo = keccak256("review-2");

        discovery.setReview(reviewOne, IBongGogglesDiscoveryForRewards420.Review({
            reviewId: reviewOne,
            subjectId: subjectId,
            author: BOB,
            contentHash: keccak256("review-one"),
            ratingBps: 8000,
            version: 1,
            active: true,
            updatedAt: 1
        }));
        discovery.setReview(reviewTwo, IBongGogglesDiscoveryForRewards420.Review({
            reviewId: reviewTwo,
            subjectId: subjectId,
            author: BOB,
            contentHash: keccak256("review-two"),
            ratingBps: 9000,
            version: 2,
            active: true,
            updatedAt: 2
        }));

        adapter.submitReview(reviewOne);
        vm.expectRevert(BongGogglesRewardsAdapter420.Replay.selector);
        adapter.submitReview(reviewTwo);
        require(registry.publishCount() == 1, "review editing cannot farm source");
    }

    function testInvalidDiscoveryCannotProduceRewardContribution() public {
        bytes32 subjectId = keccak256("invalid-subject");
        discovery.setSubject(subjectId, IBongGogglesDiscoveryForRewards420.Subject({
            subjectId: subjectId,
            subjectType: BongGogglesTypes420.DiscoverySubjectType.PLACE,
            canonicalRef: keccak256("place"),
            metadataRoot: keccak256("meta"),
            locationCommitment: keccak256("location"),
            locationPrecision: BongGogglesTypes420.LocationPrecision.APPROX,
            submitter: ALICE,
            createdAt: 1,
            status: BongGogglesTypes420.DiscoveryStatus.INVALID,
            exists: true
        }));

        vm.expectRevert(BongGogglesContributionVerifier420.SourceInactive.selector);
        adapter.submitDiscovery(subjectId);
    }

    function testCorrectionAndVerificationUseCanonicalAuthors() public {
        bytes32 subjectId = keccak256("subject-2");
        bytes32 correctionId = keccak256("correction");
        bytes32 verificationId = keccak256("verification");

        discovery.setCorrection(correctionId, IBongGogglesDiscoveryForRewards420.Correction({
            correctionId: correctionId,
            subjectId: subjectId,
            author: ALICE,
            fieldId: keccak256("hours"),
            proposedValueHash: keccak256("new-hours"),
            evidenceHash: keccak256("evidence-a"),
            createdAt: 1
        }));
        adapter.submitCorrection(correctionId);
        require(registry.lastBeneficiary() == ALICE, "correction author bound");
        require(registry.lastType() == verifier.CONTRIBUTION_CORRECTION(), "correction type");

        discovery.setVerification(verificationId, IBongGogglesDiscoveryForRewards420.Verification({
            verificationId: verificationId,
            subjectId: subjectId,
            verifier: BOB,
            propositionHash: keccak256("is-open"),
            subjectVersion: 1,
            supportsProposition: true,
            evidenceHash: keccak256("evidence-b"),
            createdAt: 1
        }));
        adapter.submitVerification(verificationId);
        require(registry.lastBeneficiary() == BOB, "verifier bound");
        require(registry.lastType() == verifier.CONTRIBUTION_VERIFICATION(), "verification type");
    }
}
