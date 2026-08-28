// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pulse/PulseIds420.sol";
import "../src/pulse/PulsePolicyRegistry420.sol";
import "../src/pulse/PulseProfileRegistry420.sol";
import "../src/pulse/PulseGraph420.sol";
import "../src/pulse/PulsePublicationRegistry420.sol";
import "../src/pulse/PulseInteractionRegistry420.sol";
import "../src/pulse/PulseTopicRegistry420.sol";
import "../src/pulse/PulseRouter420.sol";

interface VmPulse420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function warp(uint256) external;
}

contract Pulse420Test {
    VmPulse420 internal constant vm = VmPulse420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant EVE = address(0xE7E);

    bytes32 internal constant ALICE_PROFILE = keccak256("pulse/alice");
    bytes32 internal constant BOB_PROFILE = keccak256("pulse/bob");
    bytes32 internal constant POST = keccak256("pulse/post/1");
    bytes32 internal constant VISIBILITY_POLICY = keccak256("pulse/policy/public");

    struct Suite {
        PulsePolicyRegistry420 policies;
        PulseProfileRegistry420 profiles;
        PulseGraph420 graph;
        PulsePublicationRegistry420 publications;
        PulseInteractionRegistry420 interactions;
        PulseTopicRegistry420 topics;
        PulseRouter420 router;
    }

    function _deploy() private returns (Suite memory suite) {
        vm.warp(1_000);
        suite.policies = new PulsePolicyRegistry420(address(this));
        suite.profiles = new PulseProfileRegistry420();
        suite.graph = new PulseGraph420(address(suite.profiles));
        suite.publications = new PulsePublicationRegistry420(address(suite.profiles), address(suite.policies));
        suite.interactions = new PulseInteractionRegistry420(address(suite.profiles), address(suite.publications), address(suite.graph));
        suite.topics = new PulseTopicRegistry420(address(this));
        suite.router = new PulseRouter420(address(suite.profiles), address(suite.publications), address(suite.graph));
        suite.policies.setPolicy(VISIBILITY_POLICY, keccak256("420/PULSE/POLICY/VISIBILITY/PUBLIC/V1"), keccak256("public-v1"), bytes32(0), true);
        _createProfile(suite.profiles, ALICE, ALICE_PROFILE);
        _createProfile(suite.profiles, BOB, BOB_PROFILE);
    }

    function _createProfile(PulseProfileRegistry420 profiles, address controller, bytes32 profileId) private {
        vm.prank(controller);
        profiles.createProfile(profileId, controller, PulseIds420.PROFILE_PERSON, bytes32(0), bytes32(0), keccak256("meta"), bytes32(0), bytes32(0));
    }

    function _publish(Suite memory suite) private {
        vm.prank(ALICE);
        suite.publications.createPublication(
            POST,
            ALICE_PROFILE,
            PulseIds420.PUBLICATION_POST,
            keccak256("manifest-v1"),
            keccak256("content-v1"),
            bytes32(0),
            bytes32(0),
            VISIBILITY_POLICY,
            bytes32(0)
        );
    }

    function testProfileIdCannotBeReassigned() public {
        Suite memory suite = _deploy();
        vm.prank(BOB);
        vm.expectRevert(PulseProfileRegistry420.ProfileAlreadyExists.selector);
        suite.profiles.createProfile(ALICE_PROFILE, BOB, PulseIds420.PROFILE_CREATOR, bytes32(0), bytes32(0), bytes32(0), bytes32(0), bytes32(0));
    }

    function testOnlyControllerCanUpdateProfile() public {
        Suite memory suite = _deploy();
        vm.prank(EVE);
        vm.expectRevert(PulseProfileRegistry420.Unauthorized.selector);
        suite.profiles.updateProfile(ALICE_PROFILE, keccak256("stolen"), bytes32(0), bytes32(0), true);
    }

    function testFollowIsPortableAndBlockSeversBothDirections() public {
        Suite memory suite = _deploy();
        vm.prank(ALICE);
        suite.graph.setFollow(ALICE_PROFILE, BOB_PROFILE, true);
        vm.prank(BOB);
        suite.graph.setFollow(BOB_PROFILE, ALICE_PROFILE, true);
        require(suite.graph.following(ALICE_PROFILE, BOB_PROFILE), "alice follow missing");
        require(suite.graph.following(BOB_PROFILE, ALICE_PROFILE), "bob follow missing");

        vm.prank(ALICE);
        suite.graph.setBlock(ALICE_PROFILE, BOB_PROFILE, true);
        require(!suite.graph.following(ALICE_PROFILE, BOB_PROFILE), "outbound follow survived block");
        require(!suite.graph.following(BOB_PROFILE, ALICE_PROFILE), "inbound follow survived block");
        require(suite.graph.blocked(ALICE_PROFILE, BOB_PROFILE), "block missing");
    }

    function testPublicationBindsAuthorAndPreservesRevisionHistory() public {
        Suite memory suite = _deploy();
        _publish(suite);
        vm.prank(ALICE);
        suite.publications.revisePublication(POST, keccak256("manifest-v2"), keccak256("content-v2"));

        PulsePublicationRegistry420.Publication memory publication = suite.publications.getPublication(POST);
        PulsePublicationRegistry420.Revision memory first = suite.publications.getRevision(POST, 1);
        PulsePublicationRegistry420.Revision memory second = suite.publications.getRevision(POST, 2);
        require(publication.authorProfileId == ALICE_PROFILE, "author changed");
        require(publication.currentRevision == 2, "revision not advanced");
        require(first.contentManifestHash == keccak256("manifest-v1"), "revision 1 overwritten");
        require(second.contentManifestHash == keccak256("manifest-v2"), "revision 2 missing");
    }

    function testNonAuthorCannotRevisePublication() public {
        Suite memory suite = _deploy();
        _publish(suite);
        vm.prank(BOB);
        vm.expectRevert(PulsePublicationRegistry420.Unauthorized.selector);
        suite.publications.revisePublication(POST, keccak256("bad"), keccak256("bad"));
    }

    function testBlockedProfileCannotLikePublication() public {
        Suite memory suite = _deploy();
        _publish(suite);
        vm.prank(ALICE);
        suite.graph.setBlock(ALICE_PROFILE, BOB_PROFILE, true);
        vm.prank(BOB);
        vm.expectRevert(PulseInteractionRegistry420.InteractionBlocked.selector);
        suite.interactions.setLike(BOB_PROFILE, POST, true);
    }

    function testRouterReadsCanonicalState() public {
        Suite memory suite = _deploy();
        _publish(suite);
        vm.prank(ALICE);
        suite.graph.setFollow(ALICE_PROFILE, BOB_PROFILE, true);
        IPulse420.ProfileRead memory profile = suite.router.readProfile(ALICE_PROFILE);
        IPulse420.PublicationRead memory publication = suite.router.readPublication(POST);
        require(profile.controller == ALICE && profile.active, "profile read");
        require(publication.authorProfileId == ALICE_PROFILE && publication.active, "publication read");
        require(suite.router.isFollowing(ALICE_PROFILE, BOB_PROFILE), "graph read");
    }
}
