// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bonggoggles/BongGogglesIds420.sol";
import "../src/bonggoggles/BongGogglesAuthorization420.sol";
import "../src/bonggoggles/BongGogglesProfileRegistry420.sol";
import "../src/bonggoggles/BongGogglesRelationshipGraph420.sol";
import "../src/bonggoggles/BongGogglesSocialPolicy420.sol";
import "../src/bonggoggles/BongGogglesMediaRegistry420.sol";
import "../src/bonggoggles/BongGogglesSocialObjectRegistry420.sol";
import "../src/bonggoggles/BongGogglesTagRegistry420.sol";

interface VmBongGogglesTags420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract BongGogglesTagCapabilitiesMock420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) internal allowed;
    function set(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256 amount, bool value) external {
        allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))] = value;
    }
    function grant(bytes32) external pure override returns (CapabilityGrant memory capabilityGrant) { return capabilityGrant; }
    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256 amount)
        external view override returns (bool)
    {
        return allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))];
    }
}

contract BongGogglesTagsMentions420Test {
    VmBongGogglesTags420 constant vm = VmBongGogglesTags420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant PAGE = address(0xBEEF);
    address constant COMMUNITY = address(0xC011);

    BongGogglesTagCapabilitiesMock420 caps;
    BongGogglesAuthorization420 auth;
    BongGogglesProfileRegistry420 profiles;
    BongGogglesRelationshipGraph420 graph;
    BongGogglesSocialPolicy420 policy;
    BongGogglesMediaRegistry420 media;
    BongGogglesSocialObjectRegistry420 objects;
    BongGogglesTagRegistry420 tags;

    function setUp() public {
        caps = new BongGogglesTagCapabilitiesMock420();
        auth = new BongGogglesAuthorization420(address(caps));
        profiles = new BongGogglesProfileRegistry420(address(auth));
        graph = new BongGogglesRelationshipGraph420(address(auth), address(profiles));
        policy = new BongGogglesSocialPolicy420(address(profiles), address(graph));
        media = new BongGogglesMediaRegistry420(address(auth), address(profiles));
        objects = new BongGogglesSocialObjectRegistry420(address(auth), address(profiles), address(policy), address(media));
        tags = new BongGogglesTagRegistry420(address(auth), address(profiles), address(policy), address(objects));

        _create(ALICE, BongGogglesTypes420.ProfileType.PERSONAL);
        _create(BOB, BongGogglesTypes420.ProfileType.PERSONAL);
        _create(PAGE, BongGogglesTypes420.ProfileType.BUSINESS);
        _create(COMMUNITY, BongGogglesTypes420.ProfileType.COMMUNITY);
        _setMentionEveryone(PAGE);
        _setMentionEveryone(COMMUNITY);
    }

    function _create(address account, BongGogglesTypes420.ProfileType profileType) internal {
        vm.prank(account);
        profiles.createProfile(account, profileType, keccak256(abi.encode(account)), bytes32(0), bytes32(0), bytes32(0), bytes32(0));
    }

    function _setMentionEveryone(address account) internal {
        BongGogglesProfileRegistry420.Preferences memory p = profiles.preferences(account);
        p.mentionPolicy = BongGogglesTypes420.AccessPolicy.EVERYONE;
        vm.prank(account);
        profiles.updatePreferences(account, p);
    }

    function _friend(address a, address b) internal {
        vm.prank(a);
        bytes32 requestId = graph.requestFriend(a, b);
        vm.prank(b);
        graph.acceptFriend(b, requestId);
    }

    function _publicPost(address author) internal returns (bytes32 objectId) {
        BongGogglesTypes420.AudiencePolicy memory audience =
            BongGogglesTypes420.AudiencePolicy(BongGogglesTypes420.AudienceType.PUBLIC, bytes32(0));
        vm.prank(author);
        objectId = objects.publish(
            author,
            BongGogglesTypes420.SocialObjectType.STATUS,
            bytes32(0),
            bytes32(0),
            bytes32(0),
            keccak256("public-post"),
            bytes32(0),
            audience
        );
    }

    function _friendsPost(address author) internal returns (bytes32 objectId) {
        BongGogglesTypes420.AudiencePolicy memory audience =
            BongGogglesTypes420.AudiencePolicy(BongGogglesTypes420.AudienceType.FRIENDS, bytes32(0));
        vm.prank(author);
        objectId = objects.publish(
            author,
            BongGogglesTypes420.SocialObjectType.STATUS,
            bytes32(0),
            bytes32(0),
            bytes32(0),
            keccak256("friends-post"),
            bytes32(0),
            audience
        );
    }

    function testProfileMentionEnforcesMentionPolicy() public {
        bytes32 objectId = _publicPost(ALICE);
        vm.expectRevert(BongGogglesTagRegistry420.MentionDenied.selector);
        vm.prank(ALICE);
        tags.createTag(ALICE, objectId, BOB, BongGogglesTypes420.TagTargetType.PROFILE);

        _friend(ALICE, BOB);
        vm.prank(ALICE);
        bytes32 tagId = tags.createTag(ALICE, objectId, BOB, BongGogglesTypes420.TagTargetType.PROFILE);
        BongGogglesTagRegistry420.TagRecord memory r = tags.tag(tagId);
        require(r.state == BongGogglesTypes420.TagState.ACTIVE, "profile mention should activate");
        require(tags.isEffectiveTag(tagId), "profile mention ineffective");
    }

    function testPageTagRequiresApproval() public {
        bytes32 objectId = _publicPost(ALICE);
        vm.prank(ALICE);
        bytes32 tagId = tags.createTag(ALICE, objectId, PAGE, BongGogglesTypes420.TagTargetType.PAGE);
        require(tags.tag(tagId).state == BongGogglesTypes420.TagState.PENDING, "page tag not pending");

        vm.prank(PAGE);
        tags.approveTag(PAGE, tagId);
        require(tags.tag(tagId).state == BongGogglesTypes420.TagState.ACTIVE, "page tag not active");
        require(tags.isEffectiveTag(tagId), "approved page tag ineffective");
        require(!graph.areFriends(ALICE, PAGE), "tag invented friendship");
        require(!graph.isFollowing(ALICE, PAGE), "tag invented follow");
    }

    function testCommunityTagCanBeRejectedAndRetried() public {
        bytes32 objectId = _publicPost(ALICE);
        vm.prank(ALICE);
        bytes32 firstTag = tags.createTag(ALICE, objectId, COMMUNITY, BongGogglesTypes420.TagTargetType.COMMUNITY);
        vm.prank(COMMUNITY);
        tags.rejectTag(COMMUNITY, firstTag);
        require(tags.tag(firstTag).state == BongGogglesTypes420.TagState.REJECTED, "community rejection missing");

        vm.prank(ALICE);
        bytes32 secondTag = tags.createTag(ALICE, objectId, COMMUNITY, BongGogglesTypes420.TagTargetType.COMMUNITY);
        require(secondTag != firstTag, "tag history overwritten");
        require(tags.tag(secondTag).state == BongGogglesTypes420.TagState.PENDING, "retry not pending");
    }

    function testTargetCanRemoveActiveProfileMention() public {
        _friend(ALICE, BOB);
        bytes32 objectId = _publicPost(ALICE);
        vm.prank(ALICE);
        bytes32 tagId = tags.createTag(ALICE, objectId, BOB, BongGogglesTypes420.TagTargetType.PROFILE);
        vm.prank(BOB);
        tags.removeTag(BOB, tagId);
        require(tags.tag(tagId).state == BongGogglesTypes420.TagState.REMOVED, "target removal missing");
        require(!tags.isEffectiveTag(tagId), "removed tag still effective");
    }

    function testAuthorCanRemovePendingPageTag() public {
        bytes32 objectId = _publicPost(ALICE);
        vm.prank(ALICE);
        bytes32 tagId = tags.createTag(ALICE, objectId, PAGE, BongGogglesTypes420.TagTargetType.PAGE);
        vm.prank(ALICE);
        tags.removeTag(ALICE, tagId);
        require(tags.tag(tagId).state == BongGogglesTypes420.TagState.REMOVED, "pending tag not removed");
    }

    function testBlockPreventsTagging() public {
        _friend(ALICE, BOB);
        bytes32 objectId = _publicPost(ALICE);
        vm.prank(BOB);
        graph.blockUser(BOB, ALICE);
        vm.expectRevert(BongGogglesTagRegistry420.MentionDenied.selector);
        vm.prank(ALICE);
        tags.createTag(ALICE, objectId, BOB, BongGogglesTypes420.TagTargetType.PROFILE);
    }

    function testProtectedContentCannotCreateCanonicalTag() public {
        _friend(ALICE, BOB);
        bytes32 objectId = _friendsPost(ALICE);
        vm.expectRevert(BongGogglesTagRegistry420.ProtectedObject.selector);
        vm.prank(ALICE);
        tags.createTag(ALICE, objectId, BOB, BongGogglesTypes420.TagTargetType.PROFILE);
    }

    function testTargetTypeMustMatchProfileClass() public {
        bytes32 objectId = _publicPost(ALICE);
        vm.expectRevert(BongGogglesTagRegistry420.InvalidTargetType.selector);
        vm.prank(ALICE);
        tags.createTag(ALICE, objectId, PAGE, BongGogglesTypes420.TagTargetType.PROFILE);
    }
}
