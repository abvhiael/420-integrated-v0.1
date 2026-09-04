// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bonggoggles/BongGogglesIds420.sol";
import "../src/bonggoggles/BongGogglesAuthorization420.sol";
import "../src/bonggoggles/BongGogglesProfileRegistry420.sol";
import "../src/bonggoggles/BongGogglesRelationshipGraph420.sol";
import "../src/bonggoggles/BongGogglesSocialPolicy420.sol";
import "../src/bonggoggles/BongGogglesPrivateMessaging420.sol";
import "../src/messenger/MessengerAuthorization420.sol";
import "../src/messenger/MessengerEndpointRegistry420.sol";
import "../src/messenger/MessengerBlockRegistry420.sol";
import "../src/messenger/MessengerConversationRegistry420.sol";

interface VmBongGogglesPrivate420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract BongGogglesPrivateCapsMock420 is ICapabilityRegistry420 {
    function grant(bytes32) external pure override returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address, bytes32, bytes32, bytes32, uint256) external pure override returns (bool) { return false; }
}

contract BongGogglesPrivateMessaging420Test {
    VmBongGogglesPrivate420 constant vm = VmBongGogglesPrivate420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant CAROL = address(0xCA401);

    BongGogglesAuthorization420 bgAuth;
    BongGogglesProfileRegistry420 profiles;
    BongGogglesRelationshipGraph420 graph;
    BongGogglesSocialPolicy420 policy;
    MessengerAuthorization420 msgAuth;
    MessengerEndpointRegistry420 endpoints;
    MessengerBlockRegistry420 msgBlocks;
    MessengerConversationRegistry420 conversations;
    BongGogglesPrivateMessaging420 privateMessaging;
    bytes32 messengerConversationId;

    function setUp() public {
        BongGogglesPrivateCapsMock420 caps = new BongGogglesPrivateCapsMock420();
        bgAuth = new BongGogglesAuthorization420(address(caps));
        profiles = new BongGogglesProfileRegistry420(address(bgAuth));
        graph = new BongGogglesRelationshipGraph420(address(bgAuth), address(profiles));
        policy = new BongGogglesSocialPolicy420(address(profiles), address(graph));

        msgAuth = new MessengerAuthorization420(address(caps));
        endpoints = new MessengerEndpointRegistry420(address(msgAuth));
        msgBlocks = new MessengerBlockRegistry420(address(msgAuth));
        conversations = new MessengerConversationRegistry420(address(msgAuth), address(endpoints), address(msgBlocks));
        privateMessaging = new BongGogglesPrivateMessaging420(
            address(bgAuth), address(profiles), address(graph), address(policy), address(conversations)
        );

        _profile(ALICE);
        _profile(BOB);
        _profile(CAROL);

        vm.prank(ALICE);
        bytes32 friendRequestId = graph.requestFriend(ALICE, BOB);
        vm.prank(BOB);
        graph.acceptFriend(BOB, friendRequestId);

        vm.prank(ALICE);
        endpoints.setEndpoint(ALICE, keccak256("alice/key"), keccak256("alice/transport"));
        vm.prank(BOB);
        endpoints.setEndpoint(BOB, keccak256("bob/key"), keccak256("bob/transport"));
        vm.prank(CAROL);
        endpoints.setEndpoint(CAROL, keccak256("carol/key"), keccak256("carol/transport"));

        vm.prank(ALICE);
        messengerConversationId = conversations.request(ALICE, BOB, keccak256("bg/direct"));
        vm.prank(BOB);
        conversations.accept(messengerConversationId, BOB);
    }

    function _profile(address account) internal {
        vm.prank(account);
        profiles.createProfile(
            account,
            BongGogglesTypes420.ProfileType.PERSONAL,
            keccak256(abi.encode(account)),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            bytes32(0)
        );
    }

    function _bind() internal returns (bytes32) {
        vm.prank(ALICE);
        return privateMessaging.bindDirectContext(ALICE, BOB, messengerConversationId, keccak256("epoch/1"));
    }

    function testDeviceKeysAreCommitmentOnlyAndRevocable() public {
        bytes32 deviceId = keccak256("alice/device/1");
        bytes32 keyCommitment = keccak256("alice/device/key/1");
        vm.prank(ALICE);
        privateMessaging.setDeviceKey(ALICE, deviceId, keyCommitment);
        BongGogglesPrivateMessaging420.DeviceKeyRecord memory record = privateMessaging.deviceKey(ALICE, deviceId);
        require(record.active && record.keyCommitment == keyCommitment && record.revision == 1, "device key not bound");
        vm.prank(ALICE);
        privateMessaging.revokeDeviceKey(ALICE, deviceId);
        record = privateMessaging.deviceKey(ALICE, deviceId);
        require(!record.active && record.revision == 2, "device key not revoked");
    }

    function testDirectContextRequiresActiveMessengerConversationAndMessagePolicy() public {
        vm.prank(ALICE);
        vm.expectRevert(BongGogglesPrivateMessaging420.ConversationUnavailable.selector);
        privateMessaging.bindDirectContext(ALICE, CAROL, bytes32(uint256(1)), keccak256("epoch/bad"));

        vm.prank(ALICE);
        bytes32 carolConversation = conversations.request(ALICE, CAROL, keccak256("bg/carol"));
        vm.prank(CAROL);
        conversations.accept(carolConversation, CAROL);

        vm.prank(ALICE);
        vm.expectRevert(BongGogglesPrivateMessaging420.MessagePolicyDenied.selector);
        privateMessaging.bindDirectContext(ALICE, CAROL, carolConversation, keccak256("epoch/carol"));
    }

    function testBindAndRotateEpoch() public {
        bytes32 contextId = _bind();
        require(privateMessaging.canSend(contextId, ALICE), "alice cannot send");
        require(privateMessaging.canSend(contextId, BOB), "bob cannot send");

        vm.prank(BOB);
        privateMessaging.rotateEpoch(BOB, contextId, keccak256("epoch/2"));
        BongGogglesPrivateMessaging420.DirectContext memory context = privateMessaging.privateContext(contextId);
        require(context.epoch == 2 && context.epochCommitment == keccak256("epoch/2"), "epoch not rotated");
    }

    function testBlockImmediatelyKillsSendEligibility() public {
        bytes32 contextId = _bind();
        vm.prank(ALICE);
        graph.blockUser(ALICE, BOB);
        require(!privateMessaging.canSend(contextId, ALICE), "blocked alice send survived");
        require(!privateMessaging.canSend(contextId, BOB), "blocked bob send survived");
    }

    function testParticipantCanCloseAndCannotRotateAfterClose() public {
        bytes32 contextId = _bind();
        vm.prank(ALICE);
        privateMessaging.closeContext(ALICE, contextId);
        require(!privateMessaging.canSend(contextId, ALICE), "closed context usable");
        vm.prank(BOB);
        vm.expectRevert(BongGogglesPrivateMessaging420.ContextClosed.selector);
        privateMessaging.rotateEpoch(BOB, contextId, keccak256("epoch/closed"));
    }
}
