// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/messenger/MessengerAuthorization420.sol";
import "../src/messenger/MessengerEndpointRegistry420.sol";
import "../src/messenger/MessengerBlockRegistry420.sol";
import "../src/messenger/MessengerConversationRegistry420.sol";
import "../src/messenger/MessengerEnvelopeRegistry420.sol";
import "../src/messenger/MessengerReceiptRegistry420.sol";

interface VmMessenger420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockMessengerCapabilities420 is ICapabilityRegistry420 {
    bool public allowed;
    function setAllowed(bool allowed_) external { allowed = allowed_; }
    function grant(bytes32) external pure override returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address, bytes32, bytes32, bytes32, uint256) external view override returns (bool) { return allowed; }
}

contract MessengerGenesis420Test {
    VmMessenger420 constant vm = VmMessenger420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant DELEGATE = address(0xD311);

    MockMessengerCapabilities420 caps;
    MessengerAuthorization420 auth;
    MessengerEndpointRegistry420 endpoints;
    MessengerBlockRegistry420 blocks;
    MessengerConversationRegistry420 conversations;
    MessengerEnvelopeRegistry420 envelopes;
    MessengerReceiptRegistry420 receipts;
    bytes32 conversationId;

    function setUp() public {
        caps = new MockMessengerCapabilities420();
        auth = new MessengerAuthorization420(address(caps));
        endpoints = new MessengerEndpointRegistry420(address(auth));
        blocks = new MessengerBlockRegistry420(address(auth));
        conversations = new MessengerConversationRegistry420(address(auth), address(endpoints), address(blocks));
        envelopes = new MessengerEnvelopeRegistry420(address(auth), address(conversations), address(blocks));
        receipts = new MessengerReceiptRegistry420(address(auth), address(conversations), address(envelopes));

        vm.prank(ALICE);
        endpoints.setEndpoint(ALICE, keccak256("alice/key"), keccak256("alice/transport"));
        vm.prank(BOB);
        endpoints.setEndpoint(BOB, keccak256("bob/key"), keccak256("bob/transport"));
        vm.prank(ALICE);
        conversationId = conversations.request(ALICE, BOB, keccak256("direct-chat"));
        vm.prank(BOB);
        conversations.accept(conversationId, BOB);
    }

    function testDelegatedEndpointManagementDefaultsDeny() public {
        vm.prank(DELEGATE);
        vm.expectRevert(MessengerEndpointRegistry420.UnauthorizedEndpoint.selector);
        endpoints.setEndpoint(ALICE, keccak256("new/key"), keccak256("new/transport"));
        caps.setAllowed(true);
        vm.prank(DELEGATE);
        endpoints.setEndpoint(ALICE, keccak256("new/key"), keccak256("new/transport"));
        require(endpoints.endpoint(ALICE).revision == 2, "delegated rotation");
    }

    function testBlockStopsMessageFlow() public {
        vm.prank(ALICE);
        blocks.setBlocked(ALICE, BOB, true);
        vm.prank(BOB);
        vm.expectRevert(MessengerEnvelopeRegistry420.ConversationUnavailable.selector);
        envelopes.commit(BOB, conversationId, 1, keccak256("cipher/blocked"), keccak256("store/blocked"));
    }

    function testMessageSequenceAndReplayFailClosed() public {
        vm.prank(ALICE);
        bytes32 first = envelopes.commit(ALICE, conversationId, 1, keccak256("cipher/1"), keccak256("store/1"));
        require(first != bytes32(0), "first message");
        vm.prank(ALICE);
        vm.expectRevert(MessengerEnvelopeRegistry420.InvalidSequence.selector);
        envelopes.commit(ALICE, conversationId, 1, keccak256("cipher/replay"), keccak256("store/replay"));
        vm.prank(ALICE);
        envelopes.commit(ALICE, conversationId, 2, keccak256("cipher/2"), keccak256("store/2"));
        require(envelopes.lastSequence(conversationId, ALICE) == 2, "sequence advanced");
    }

    function testOnlyRecipientCanAcknowledgeAndReadImpliesDelivered() public {
        vm.prank(ALICE);
        bytes32 messageId = envelopes.commit(ALICE, conversationId, 1, keccak256("cipher/receipt"), keccak256("store/receipt"));
        vm.prank(ALICE);
        vm.expectRevert(MessengerReceiptRegistry420.NotRecipient.selector);
        receipts.acknowledge(ALICE, messageId, true);
        vm.prank(BOB);
        receipts.acknowledge(BOB, messageId, true);
        (uint64 deliveredAt, uint64 readAt) = receipts.receipt(messageId);
        require(deliveredAt != 0 && readAt != 0, "read implies delivered");
    }

    function testConversationRequiresPeerAcceptanceAndCannotReopen() public {
        bytes32 context = keccak256("second-chat");
        vm.prank(ALICE);
        bytes32 id = conversations.request(ALICE, BOB, context);
        require(!conversations.isActive(id), "not active before consent");
        vm.prank(ALICE);
        vm.expectRevert(MessengerConversationRegistry420.InvalidState.selector);
        conversations.accept(id, ALICE);
        vm.prank(BOB);
        conversations.accept(id, BOB);
        vm.prank(ALICE);
        conversations.close(id, ALICE);
        vm.prank(BOB);
        vm.expectRevert(MessengerConversationRegistry420.InvalidState.selector);
        conversations.accept(id, BOB);
    }
}
