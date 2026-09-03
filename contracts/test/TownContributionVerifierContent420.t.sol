// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/town/ITownContributionSource420.sol";
import "../src/town/TownContributionVerifier420.sol";
import "../src/town/TownRewardTypes420.sol";
import "./MockTownContributionSource420.sol";

contract TownContributionVerifierContent420Test {
    address constant USER = address(0x4201);
    address constant OTHER = address(0x4202);
    MockTownContributionSource420 source;
    TownContributionVerifier420 verifier;

    function setUp() public {
        source = new MockTownContributionSource420();
        verifier = new TownContributionVerifier420(address(source));
    }

    function testPostSemantics() public {
        bytes32 id = keccak256("post"); bytes32 h = keccak256("body");
        source.setPost(id, ITownContributionSource420.PostRecord(true, true, USER, h));
        require(verifier.verifyContribution(TownRewardTypes420.POST, id, USER, h), "valid post");
        require(!verifier.verifyContribution(TownRewardTypes420.POST, id, OTHER, h), "author bound");
        source.setPost(id, ITownContributionSource420.PostRecord(true, false, USER, h));
        require(!verifier.verifyContribution(TownRewardTypes420.POST, id, USER, h), "active required");
    }

    function testCommentSemantics() public {
        bytes32 id = keccak256("comment"); bytes32 h = keccak256("comment-body");
        source.setComment(id, ITownContributionSource420.CommentRecord(true, true, USER, bytes32(0), h));
        require(!verifier.verifyContribution(TownRewardTypes420.COMMENT, id, USER, h), "parent required");
        source.setComment(id, ITownContributionSource420.CommentRecord(true, true, USER, keccak256("post"), h));
        require(verifier.verifyContribution(TownRewardTypes420.COMMENT, id, USER, h), "valid comment");
    }

    function testCurationSemantics() public {
        bytes32 id = keccak256("curation"); bytes32 h = keccak256("decision");
        source.setCuration(id, ITownContributionSource420.CurationRecord(true, true, USER, bytes32(0), h));
        require(!verifier.verifyContribution(TownRewardTypes420.CURATION, id, USER, h), "target required");
        source.setCuration(id, ITownContributionSource420.CurationRecord(true, true, USER, keccak256("target"), h));
        require(verifier.verifyContribution(TownRewardTypes420.CURATION, id, USER, h), "valid curation");
    }

    function testCommunityResourceSemantics() public {
        bytes32 id = keccak256("resource"); bytes32 h = keccak256("resource-body");
        source.setResource(id, ITownContributionSource420.CommunityResourceRecord(true, true, USER, bytes32(0), h));
        require(!verifier.verifyContribution(TownRewardTypes420.COMMUNITY_RESOURCE, id, USER, h), "community required");
        source.setResource(id, ITownContributionSource420.CommunityResourceRecord(true, true, USER, keccak256("community"), h));
        require(verifier.verifyContribution(TownRewardTypes420.COMMUNITY_RESOURCE, id, USER, h), "valid resource");
    }
}
