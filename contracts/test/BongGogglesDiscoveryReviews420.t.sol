// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bonggoggles/BongGogglesAuthorization420.sol";
import "../src/bonggoggles/BongGogglesProfileRegistry420.sol";
import "../src/bonggoggles/BongGogglesDiscoveryRegistry420.sol";

interface VmBGDiscovery420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockBGDiscoveryCapabilities420 is ICapabilityRegistry420 {
    function grant(bytes32) external pure override returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address, bytes32, bytes32, bytes32, uint256) external pure override returns (bool) { return false; }
}

contract BongGogglesDiscoveryReviews420Test {
    VmBGDiscovery420 constant vm = VmBGDiscovery420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);

    BongGogglesAuthorization420 auth;
    BongGogglesProfileRegistry420 profiles;
    BongGogglesDiscoveryRegistry420 discovery;

    function setUp() public {
        MockBGDiscoveryCapabilities420 caps = new MockBGDiscoveryCapabilities420();
        auth = new BongGogglesAuthorization420(address(caps));
        profiles = new BongGogglesProfileRegistry420(address(auth));
        discovery = new BongGogglesDiscoveryRegistry420(address(auth), address(profiles));
        _create(ALICE);
        _create(BOB);
    }

    function _create(address account) internal {
        vm.prank(account);
        profiles.createProfile(account, BongGogglesTypes420.ProfileType.PERSONAL, keccak256("name"), bytes32(0), bytes32(0), bytes32(0), bytes32(0));
    }

    function _subject() internal returns (bytes32 id) {
        vm.prank(ALICE);
        id = discovery.submitSubject(
            ALICE,
            BongGogglesTypes420.DiscoverySubjectType.PLACE,
            keccak256("subject/place/1"),
            keccak256("metadata"),
            keccak256("location"),
            BongGogglesTypes420.LocationPrecision.APPROX
        );
    }

    function testDiscoverySubmissionIsCandidateNotTruth() public {
        bytes32 id = _subject();
        BongGogglesDiscoveryRegistry420.Subject memory s = discovery.subject(id);
        require(s.exists, "subject exists");
        require(s.status == BongGogglesTypes420.DiscoveryStatus.SUBMITTED, "candidate remains submitted");
        require(s.submitter == ALICE, "submitter retained");
    }

    function testOneActiveReviewPerAuthorSubjectWithVersionHistory() public {
        bytes32 id = _subject();
        vm.prank(BOB);
        bytes32 first = discovery.publishReview(BOB, id, keccak256("review/v1"), 8000);
        vm.prank(BOB);
        bytes32 second = discovery.publishReview(BOB, id, keccak256("review/v2"), 9000);
        require(first != second, "version ids differ");
        require(!discovery.review(first).active, "old review inactive");
        require(discovery.review(second).active, "latest active");
        require(discovery.review(second).version == 2, "version increments");
    }

    function testRatingRangeFailsClosed() public {
        bytes32 id = _subject();
        vm.prank(BOB);
        vm.expectRevert(BongGogglesDiscoveryRegistry420.InvalidRating.selector);
        discovery.publishReview(BOB, id, keccak256("bad"), 10001);
    }

    function testCorrectionIsFieldSpecific() public {
        bytes32 id = _subject();
        vm.prank(BOB);
        bytes32 correctionId = discovery.submitCorrection(BOB, id, keccak256("hours"), keccak256("new-hours"), keccak256("evidence"));
        BongGogglesDiscoveryRegistry420.Correction memory c = discovery.correction(correctionId);
        require(c.fieldId == keccak256("hours"), "field bound");
        require(c.proposedValueHash == keccak256("new-hours"), "value bound");
    }

    function testVerificationBoundToPropositionAndVersion() public {
        bytes32 id = _subject();
        vm.prank(BOB);
        bytes32 verificationId = discovery.attestVerification(BOB, id, keccak256("is-open"), 1, true, keccak256("proof"));
        BongGogglesDiscoveryRegistry420.Verification memory v = discovery.verification(verificationId);
        require(v.propositionHash == keccak256("is-open"), "proposition bound");
        require(v.subjectVersion == 1, "version bound");
        require(v.supportsProposition, "attestation retained");
    }

    function testWithdrawClearsActiveReviewOnly() public {
        bytes32 id = _subject();
        vm.prank(BOB);
        bytes32 reviewId = discovery.publishReview(BOB, id, keccak256("review"), 7000);
        vm.prank(BOB);
        discovery.withdrawReview(BOB, id);
        require(!discovery.review(reviewId).active, "withdrawn inactive");
        require(discovery.activeReviewFor(keccak256(abi.encode(id, BOB))) == bytes32(0), "active slot cleared");
    }
}
