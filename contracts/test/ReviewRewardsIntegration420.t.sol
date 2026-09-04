// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/rewards/RewardIds420.sol";
import "../src/rewards/RewardAuthorization420.sol";
import "../src/rewards/ContributionRegistry420.sol";
import "../src/review/IReviewContributionSource420.sol";
import "../src/review/ReviewRewardTypes420.sol";
import "../src/review/ReviewContributionVerifier420.sol";
import "../src/review/ReviewRewardsAdapter420.sol";

interface VmReviewRewards420 {
    function expectRevert(bytes4) external;
}

contract MockReviewCapabilities420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) private _allowed;

    function set(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256 amount, bool value) external {
        _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))] = value;
    }

    function grant(bytes32) external pure override returns (CapabilityGrant memory capabilityGrant) { return capabilityGrant; }

    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256 amount) external view override returns (bool) {
        return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))];
    }
}

contract MockReviewContributionSource420 is IReviewContributionSource420 {
    struct Review { address author; bytes32 subjectId; bytes32 hash; bool active; bool finalized; }
    struct Correction { address author; bytes32 target; bytes32 hash; bool accepted; bool active; }
    struct Verification { address verifier; bytes32 target; bytes32 hash; bool finalized; bool overturned; }
    struct Curation { address curator; bytes32 target; bytes32 hash; bool active; }

    mapping(bytes32 => Review) reviews;
    mapping(bytes32 => Correction) corrections;
    mapping(bytes32 => Verification) verifications;
    mapping(bytes32 => Curation) curations;

    function setReview(bytes32 id, address author, bytes32 subjectId, bytes32 hash, bool active, bool finalized) external { reviews[id] = Review(author, subjectId, hash, active, finalized); }
    function setCorrection(bytes32 id, address author, bytes32 target, bytes32 hash, bool accepted, bool active) external { corrections[id] = Correction(author, target, hash, accepted, active); }
    function setVerification(bytes32 id, address verifier_, bytes32 target, bytes32 hash, bool finalized, bool overturned) external { verifications[id] = Verification(verifier_, target, hash, finalized, overturned); }
    function setCuration(bytes32 id, address curator, bytes32 target, bytes32 hash, bool active) external { curations[id] = Curation(curator, target, hash, active); }

    function reviewRecord(bytes32 id) external view returns (address, bytes32, bytes32, bool, bool) { Review memory r = reviews[id]; return (r.author, r.subjectId, r.hash, r.active, r.finalized); }
    function correctionRecord(bytes32 id) external view returns (address, bytes32, bytes32, bool, bool) { Correction memory r = corrections[id]; return (r.author, r.target, r.hash, r.accepted, r.active); }
    function verificationRecord(bytes32 id) external view returns (address, bytes32, bytes32, bool, bool) { Verification memory r = verifications[id]; return (r.verifier, r.target, r.hash, r.finalized, r.overturned); }
    function curationRecord(bytes32 id) external view returns (address, bytes32, bytes32, bool) { Curation memory r = curations[id]; return (r.curator, r.target, r.hash, r.active); }
}

contract ReviewRewardsIntegration420Test {
    VmReviewRewards420 constant vm = VmReviewRewards420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant USER = address(0x4201);

    MockReviewCapabilities420 caps;
    RewardAuthorization420 auth;
    ContributionRegistry420 contributions;
    MockReviewContributionSource420 source;
    ReviewContributionVerifier420 verifier;
    ReviewRewardsAdapter420 adapter;

    function setUp() public {
        caps = new MockReviewCapabilities420();
        auth = new RewardAuthorization420(address(caps));
        contributions = new ContributionRegistry420(address(auth));
        source = new MockReviewContributionSource420();
        verifier = new ReviewContributionVerifier420(address(source));
        adapter = new ReviewRewardsAdapter420(address(contributions), address(verifier));
    }

    function _authorize() internal {
        caps.set(address(adapter), RewardIds420.COMPONENT_REWARDS, RewardIds420.ACTION_PUBLISH_CONTRIBUTION, auth.scopeForApp(ReviewRewardTypes420.APP_ID), 0, true);
    }

    function testFinalizedReviewVerifiesAndPublishes() public {
        _authorize();
        bytes32 id = keccak256("review-1");
        bytes32 evidence = keccak256("review-content");
        source.setReview(id, USER, keccak256("product-1"), evidence, true, true);
        bytes32 contributionId = adapter.publishContribution(ReviewRewardTypes420.REVIEW, id, USER, evidence);
        ContributionRegistry420.Contribution memory c = contributions.contribution(contributionId);
        require(c.exists && c.appId == ReviewRewardTypes420.APP_ID, "review contribution");
        require(c.beneficiary == USER && c.publisher == address(adapter), "binding");
    }

    function testReviewRequiresFinalityActiveSubjectAndAuthor() public {
        bytes32 id = keccak256("review-2");
        bytes32 evidence = keccak256("content");
        source.setReview(id, USER, bytes32(0), evidence, true, true);
        require(!verifier.verifyContribution(ReviewRewardTypes420.REVIEW, id, USER, evidence), "subject required");
        source.setReview(id, USER, keccak256("subject"), evidence, false, true);
        require(!verifier.verifyContribution(ReviewRewardTypes420.REVIEW, id, USER, evidence), "active required");
        source.setReview(id, USER, keccak256("subject"), evidence, true, false);
        require(!verifier.verifyContribution(ReviewRewardTypes420.REVIEW, id, USER, evidence), "finality required");
        source.setReview(id, address(0xBEEF), keccak256("subject"), evidence, true, true);
        require(!verifier.verifyContribution(ReviewRewardTypes420.REVIEW, id, USER, evidence), "author binding");
    }

    function testCorrectionRequiresAcceptedActiveTargetAndEvidence() public {
        bytes32 id = keccak256("correction-1");
        bytes32 evidence = keccak256("correction");
        source.setCorrection(id, USER, keccak256("review-target"), evidence, true, true);
        require(verifier.verifyContribution(ReviewRewardTypes420.CORRECTION, id, USER, evidence), "valid correction");
        source.setCorrection(id, USER, keccak256("review-target"), evidence, false, true);
        require(!verifier.verifyContribution(ReviewRewardTypes420.CORRECTION, id, USER, evidence), "accepted required");
        source.setCorrection(id, USER, bytes32(0), evidence, true, true);
        require(!verifier.verifyContribution(ReviewRewardTypes420.CORRECTION, id, USER, evidence), "target required");
    }

    function testVerificationMustBeFinalAndNotOverturned() public {
        bytes32 id = keccak256("verification-1");
        bytes32 evidence = keccak256("verification-evidence");
        source.setVerification(id, USER, keccak256("review-target"), evidence, true, false);
        require(verifier.verifyContribution(ReviewRewardTypes420.VERIFICATION, id, USER, evidence), "valid verification");
        source.setVerification(id, USER, keccak256("review-target"), evidence, false, false);
        require(!verifier.verifyContribution(ReviewRewardTypes420.VERIFICATION, id, USER, evidence), "final required");
        source.setVerification(id, USER, keccak256("review-target"), evidence, true, true);
        require(!verifier.verifyContribution(ReviewRewardTypes420.VERIFICATION, id, USER, evidence), "overturn blocks");
    }

    function testCurationRequiresActiveTargetAndCuratorBinding() public {
        bytes32 id = keccak256("curation-1");
        bytes32 evidence = keccak256("decision");
        source.setCuration(id, USER, keccak256("review-target"), evidence, true);
        require(verifier.verifyContribution(ReviewRewardTypes420.CURATION, id, USER, evidence), "valid curation");
        source.setCuration(id, USER, keccak256("review-target"), evidence, false);
        require(!verifier.verifyContribution(ReviewRewardTypes420.CURATION, id, USER, evidence), "active required");
    }

    function testAdapterDefaultDenyAndReplayProtected() public {
        bytes32 id = keccak256("review-3");
        bytes32 evidence = keccak256("review-content-3");
        source.setReview(id, USER, keccak256("product-3"), evidence, true, true);
        vm.expectRevert(ContributionRegistry420.Unauthorized.selector);
        adapter.publishContribution(ReviewRewardTypes420.REVIEW, id, USER, evidence);

        _authorize();
        adapter.publishContribution(ReviewRewardTypes420.REVIEW, id, USER, evidence);
        vm.expectRevert(ContributionRegistry420.Replay.selector);
        adapter.publishContribution(ReviewRewardTypes420.REVIEW, id, USER, evidence);
    }

    function testWrongEvidenceAndUnsupportedTypeFailClosed() public {
        _authorize();
        bytes32 id = keccak256("review-4");
        bytes32 evidence = keccak256("review-content-4");
        source.setReview(id, USER, keccak256("product-4"), evidence, true, true);
        vm.expectRevert(ReviewRewardsAdapter420.UnverifiedContribution.selector);
        adapter.publishContribution(ReviewRewardTypes420.REVIEW, id, USER, keccak256("tampered"));
        vm.expectRevert(ReviewRewardsAdapter420.UnsupportedContributionType.selector);
        adapter.publishContribution(keccak256("RATING_SPAM"), id, USER, evidence);
    }
}
