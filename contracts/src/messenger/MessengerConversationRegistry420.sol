// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./MessengerIds420.sol";
import "./MessengerAuthorization420.sol";
import "./MessengerEndpointRegistry420.sol";
import "./MessengerBlockRegistry420.sol";

contract MessengerConversationRegistry420 is I420System {
    enum State { NONE, REQUESTED, ACTIVE, CLOSED }
    struct Conversation { address a; address b; address requestedBy; bytes32 contextHash; State state; bool exists; }

    MessengerAuthorization420 public immutable authorization;
    MessengerEndpointRegistry420 public immutable endpoints;
    MessengerBlockRegistry420 public immutable blocks;
    mapping(bytes32 => Conversation) private _conversations;

    error ZeroAddress();
    error UnauthorizedConversation();
    error InvalidConversation();
    error ConversationExists();
    error ConversationNotFound();
    error InvalidState();
    error PeerBlocked();
    event ConversationRequested(bytes32 indexed conversationId, address indexed initiator, address indexed peer, bytes32 contextHash);
    event ConversationAccepted(bytes32 indexed conversationId, address indexed accepter);
    event ConversationClosed(bytes32 indexed conversationId, address indexed closer);

    constructor(address authorization_, address endpoints_, address blocks_) {
        if (authorization_ == address(0) || endpoints_ == address(0) || blocks_ == address(0)) revert ZeroAddress();
        authorization = MessengerAuthorization420(authorization_);
        endpoints = MessengerEndpointRegistry420(endpoints_);
        blocks = MessengerBlockRegistry420(blocks_);
    }

    function systemName() external pure returns (string memory) { return "MessengerConversationRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function canonicalId(address x, address y, bytes32 contextHash) public pure returns (bytes32) {
        (address a, address b) = x < y ? (x, y) : (y, x);
        return keccak256(abi.encode(keccak256("420/MESSENGER/CONVERSATION/V1"), a, b, contextHash));
    }

    function request(address initiator, address peer, bytes32 contextHash) external returns (bytes32 id) {
        if (!_can(initiator)) revert UnauthorizedConversation();
        if (initiator == address(0) || peer == address(0) || initiator == peer || contextHash == bytes32(0)) revert InvalidConversation();
        if (!endpoints.isActive(initiator) || !endpoints.isActive(peer)) revert InvalidConversation();
        if (blocks.blocked(initiator, peer) || blocks.blocked(peer, initiator)) revert PeerBlocked();
        id = canonicalId(initiator, peer, contextHash);
        if (_conversations[id].exists) revert ConversationExists();
        (address a, address b) = initiator < peer ? (initiator, peer) : (peer, initiator);
        _conversations[id] = Conversation(a, b, initiator, contextHash, State.REQUESTED, true);
        emit ConversationRequested(id, initiator, peer, contextHash);
    }

    function accept(bytes32 id, address account) external {
        Conversation storage c = _get(id);
        if (!_can(account)) revert UnauthorizedConversation();
        if (c.state != State.REQUESTED || account == c.requestedBy || !_isParticipant(c, account)) revert InvalidState();
        address peer = account == c.a ? c.b : c.a;
        if (blocks.blocked(account, peer) || blocks.blocked(peer, account)) revert PeerBlocked();
        c.state = State.ACTIVE;
        emit ConversationAccepted(id, account);
    }

    function close(bytes32 id, address account) external {
        Conversation storage c = _get(id);
        if (!_can(account)) revert UnauthorizedConversation();
        if (!_isParticipant(c, account) || (c.state != State.REQUESTED && c.state != State.ACTIVE)) revert InvalidState();
        c.state = State.CLOSED;
        emit ConversationClosed(id, account);
    }

    function conversation(bytes32 id) external view returns (Conversation memory) { return _get(id); }
    function isActive(bytes32 id) external view returns (bool) { return _conversations[id].state == State.ACTIVE; }
    function isParticipant(bytes32 id, address account) external view returns (bool) { Conversation storage c = _get(id); return _isParticipant(c, account); }
    function peerOf(bytes32 id, address account) external view returns (address) { Conversation storage c = _get(id); if (!_isParticipant(c, account)) revert InvalidConversation(); return account == c.a ? c.b : c.a; }

    function _can(address account) private view returns (bool) { return msg.sender == account || authorization.isAuthorized(msg.sender, account, MessengerIds420.ACTION_MANAGE_CONVERSATION); }
    function _isParticipant(Conversation storage c, address account) private view returns (bool) { return account == c.a || account == c.b; }
    function _get(bytes32 id) private view returns (Conversation storage c) { c = _conversations[id]; if (!c.exists) revert ConversationNotFound(); }
}
