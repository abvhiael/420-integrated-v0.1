// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/messenger/MessengerAuthorization420.sol";
import "../src/messenger/MessengerEndpointRegistry420.sol";
import "../src/messenger/MessengerBlockRegistry420.sol";
import "../src/messenger/MessengerConversationRegistry420.sol";
import "../src/messenger/MessengerEnvelopeRegistry420.sol";
import "../src/messenger/MessengerReceiptRegistry420.sol";
import "../src/messenger/MessengerRouter420.sol";

interface VmMessengerAudit420 {
    function prank(
        address
    ) external;
    function expectRevert(
        bytes4
    ) external;
}

contract ScopedMessengerCapabilities420 is ICapabilityRegistry420 {
    address public principal;
    bytes32 public componentId;
    bytes32 public actionId;
    bytes32 public scope;
    bool public enabled;

    function setGrant(
        address principal_,
        bytes32 componentId_,
        bytes32 actionId_,
        bytes32 scope_,
        bool enabled_
    ) external {
        principal = principal_;
        componentId = componentId_;
        actionId = actionId_;
        scope = scope_;
        enabled = enabled_;
    }

    function grant(
        bytes32
    ) external pure override returns (CapabilityGrant memory g) {
        return g;
    }

    function isAuthorized(
        address p,
        bytes32 component,
        bytes32 action,
        bytes32 s,
        uint256
    ) external view override returns (bool) {
        return enabled && p == principal && component == componentId && action == actionId && s == scope;
    }
}

contract MessengerAudit420Test {
    VmMessengerAudit420 constant vm = VmMessengerAudit420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant CAROL = address(0xCA201);
    address constant DELEGATE = address(0xD311);

    bytes32 constant COMPONENT = keccak256("420/COMPONENT/MESSENGER/V1");
    bytes32 constant MANAGE_ENDPOINT = keccak256("420/MESSENGER/ACTION/MANAGE_ENDPOINT/V1");
    bytes32 constant SET_BLOCK = keccak256("420/MESSENGER/ACTION/SET_BLOCK/V1");
    bytes32 constant SEND_MESSAGE = keccak256("420/MESSENGER/ACTION/SEND_MESSAGE/V1");
    bytes32 constant ACK_MESSAGE = keccak256("420/MESSENGER/ACTION/ACK_MESSAGE/V1");

    ScopedMessengerCapabilities420 caps;
    MessengerAuthorization420 auth;
    MessengerEndpointRegistry420 endpoints;
    MessengerBlockRegistry420 blocks;
    MessengerConversationRegistry420 conversations;
    MessengerEnvelopeRegistry420 envelopes;
    MessengerReceiptRegistry420 receipts;
    MessengerRouter420 router;

    function setUp() public {
        caps = new ScopedMessengerCapabilities420();
        auth = new MessengerAuthorization420(address(caps));
        endpoints = new MessengerEndpointRegistry420(address(auth));
        blocks = new MessengerBlockRegistry420(address(auth));
        conversations = new MessengerConversationRegistry420(address(auth), address(endpoints), address(blocks));
        envelopes = new MessengerEnvelopeRegistry420(address(auth), address(conversations), address(blocks));
        receipts = new MessengerReceiptRegistry420(address(auth), address(conversations), address(envelopes));
        router = new MessengerRouter420(address(endpoints), address(blocks), address(conversations));
        _endpoint(ALICE);
        _endpoint(BOB);
        _endpoint(CAROL);
    }

    function testDelegationIsAccountAndActionScoped() public {
        caps.setGrant(DELEGATE, COMPONENT, MANAGE_ENDPOINT, auth.scopeForAccount(ALICE), true);
        vm.prank(DELEGATE);
        endpoints.setEndpoint(ALICE, keccak256("alice/new-key"), keccak256("alice/new-transport"));

        vm.prank(DELEGATE);
        vm.expectRevert(MessengerEndpointRegistry420.UnauthorizedEndpoint.selector);
        endpoints.setEndpoint(BOB, keccak256("bob/new-key"), keccak256("bob/new-transport"));

        vm.prank(DELEGATE);
        vm.expectRevert(MessengerBlockRegistry420.UnauthorizedBlock.selector);
        blocks.setBlocked(ALICE, BOB, true);
    }

    function testConversationIdIsOrderIndependentAndContextBound() public view {
        bytes32 contextA = keccak256("context-a");
        bytes32 contextB = keccak256("context-b");
        bytes32 ab = conversations.canonicalId(ALICE, BOB, contextA);
        require(ab == conversations.canonicalId(BOB, ALICE, contextA), "participant ordering");
        require(ab != conversations.canonicalId(ALICE, BOB, contextB), "context binding");
    }

    function testBlockInEitherDirectionPreventsConversationRequest() public {
        vm.prank(BOB);
        blocks.setBlocked(BOB, ALICE, true);
        vm.prank(ALICE);
        vm.expectRevert(MessengerConversationRegistry420.PeerBlocked.selector);
        conversations.request(ALICE, BOB, keccak256("blocked-request"));
    }

    function testEndpointDeactivationPreventsNewConversation() public {
        vm.prank(BOB);
        endpoints.deactivate(BOB);
        vm.prank(ALICE);
        vm.expectRevert(MessengerConversationRegistry420.InvalidConversation.selector);
        conversations.request(ALICE, BOB, keccak256("inactive-endpoint"));
    }

    function testSequencesAreStrictAndIndependentPerSender() public {
        bytes32 id = _active(ALICE, BOB, "sequence");
        vm.prank(ALICE);
        envelopes.commit(ALICE, id, 1, keccak256("a-1"), keccak256("sa-1"));
        vm.prank(BOB);
        envelopes.commit(BOB, id, 1, keccak256("b-1"), keccak256("sb-1"));
        vm.prank(ALICE);
        vm.expectRevert(MessengerEnvelopeRegistry420.InvalidSequence.selector);
        envelopes.commit(ALICE, id, 3, keccak256("a-3"), keccak256("sa-3"));
        require(envelopes.lastSequence(id, ALICE) == 1, "alice sequence");
        require(envelopes.lastSequence(id, BOB) == 1, "bob sequence");
    }

    function testClosedConversationCannotCommit() public {
        bytes32 id = _active(ALICE, BOB, "closed");
        vm.prank(ALICE);
        conversations.close(id, ALICE);
        vm.prank(ALICE);
        vm.expectRevert(MessengerEnvelopeRegistry420.ConversationUnavailable.selector);
        envelopes.commit(ALICE, id, 1, keccak256("cipher"), keccak256("storage"));
    }

    function testEnvelopeRejectsZeroCommitments() public {
        bytes32 id = _active(ALICE, BOB, "zero-commitment");
        vm.prank(ALICE);
        vm.expectRevert(MessengerEnvelopeRegistry420.InvalidEnvelope.selector);
        envelopes.commit(ALICE, id, 1, bytes32(0), keccak256("storage"));
        vm.prank(ALICE);
        vm.expectRevert(MessengerEnvelopeRegistry420.InvalidEnvelope.selector);
        envelopes.commit(ALICE, id, 1, keccak256("cipher"), bytes32(0));
    }

    function testRouterReflectsEndpointConversationAndBlockEligibility() public {
        require(router.canRequest(ALICE, BOB), "request should be eligible");
        bytes32 id = _active(ALICE, BOB, "router");
        require(router.canSend(id, ALICE), "send should be eligible");

        vm.prank(BOB);
        blocks.setBlocked(BOB, ALICE, true);
        require(!router.canRequest(ALICE, BOB), "block should deny request");
        require(!router.canSend(id, ALICE), "block should deny send");
    }

    function testReceiptDelegationIsRecipientAndActionScoped() public {
        bytes32 id = _active(ALICE, BOB, "receipt");
        vm.prank(ALICE);
        bytes32 messageId = envelopes.commit(ALICE, id, 1, keccak256("cipher-r"), keccak256("storage-r"));

        caps.setGrant(DELEGATE, COMPONENT, ACK_MESSAGE, auth.scopeForAccount(ALICE), true);
        vm.prank(DELEGATE);
        vm.expectRevert(MessengerReceiptRegistry420.UnauthorizedReceipt.selector);
        receipts.acknowledge(BOB, messageId, true);

        caps.setGrant(DELEGATE, COMPONENT, ACK_MESSAGE, auth.scopeForAccount(BOB), true);
        vm.prank(DELEGATE);
        receipts.acknowledge(BOB, messageId, true);
        (uint64 deliveredAt, uint64 readAt) = receipts.receipt(messageId);
        require(deliveredAt != 0 && readAt != 0, "delegated receipt");
    }

    function testSendDelegationCannotCrossSenderScope() public {
        bytes32 id = _active(ALICE, BOB, "send-delegation");
        caps.setGrant(DELEGATE, COMPONENT, SEND_MESSAGE, auth.scopeForAccount(ALICE), true);
        vm.prank(DELEGATE);
        envelopes.commit(ALICE, id, 1, keccak256("delegated-a"), keccak256("store-a"));

        vm.prank(DELEGATE);
        vm.expectRevert(MessengerEnvelopeRegistry420.UnauthorizedMessage.selector);
        envelopes.commit(BOB, id, 1, keccak256("delegated-b"), keccak256("store-b"));
    }

    function _endpoint(
        address account
    ) private {
        vm.prank(account);
        endpoints.setEndpoint(
            account, keccak256(abi.encodePacked(account, "key")), keccak256(abi.encodePacked(account, "transport"))
        );
    }

    function _active(
        address initiator,
        address peer,
        string memory label
    ) private returns (bytes32 id) {
        vm.prank(initiator);
        id = conversations.request(initiator, peer, keccak256(bytes(label)));
        vm.prank(peer);
        conversations.accept(id, peer);
    }
}
