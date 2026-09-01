// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./MessengerIds420.sol";
import "./MessengerAuthorization420.sol";
import "./MessengerConversationRegistry420.sol";
import "./MessengerBlockRegistry420.sol";

contract MessengerEnvelopeRegistry420 is I420System {
    struct Envelope { bytes32 conversationId; address sender; uint64 sequence; bytes32 envelopeHash; bytes32 storageRefHash; uint64 committedAt; bool exists; }
    MessengerAuthorization420 public immutable authorization;
    MessengerConversationRegistry420 public immutable conversations;
    MessengerBlockRegistry420 public immutable blocks;
    mapping(bytes32 => Envelope) private _envelopes;
    mapping(bytes32 => mapping(address => uint64)) public lastSequence;

    error ZeroAddress();
    error UnauthorizedMessage();
    error InvalidEnvelope();
    error InvalidSequence();
    error EnvelopeExists();
    error ConversationUnavailable();
    event EnvelopeCommitted(bytes32 indexed messageId, bytes32 indexed conversationId, address indexed sender, uint64 sequence, bytes32 envelopeHash, bytes32 storageRefHash);

    constructor(address authorization_, address conversations_, address blocks_) {
        if (authorization_ == address(0) || conversations_ == address(0) || blocks_ == address(0)) revert ZeroAddress();
        authorization = MessengerAuthorization420(authorization_);
        conversations = MessengerConversationRegistry420(conversations_);
        blocks = MessengerBlockRegistry420(blocks_);
    }

    function systemName() external pure returns (string memory) { return "MessengerEnvelopeRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function canonicalId(bytes32 conversationId, address sender, uint64 sequence, bytes32 envelopeHash) public pure returns (bytes32) {
        return keccak256(abi.encode(keccak256("420/MESSENGER/ENVELOPE/V1"), conversationId, sender, sequence, envelopeHash));
    }

    function commit(address sender, bytes32 conversationId, uint64 sequence, bytes32 envelopeHash, bytes32 storageRefHash) external returns (bytes32 messageId) {
        if (msg.sender != sender && !authorization.isAuthorized(msg.sender, sender, MessengerIds420.ACTION_SEND_MESSAGE)) revert UnauthorizedMessage();
        if (sender == address(0) || envelopeHash == bytes32(0) || storageRefHash == bytes32(0)) revert InvalidEnvelope();
        if (!conversations.isActive(conversationId) || !conversations.isParticipant(conversationId, sender)) revert ConversationUnavailable();
        address peer = conversations.peerOf(conversationId, sender);
        if (blocks.blocked(sender, peer) || blocks.blocked(peer, sender)) revert ConversationUnavailable();
        if (sequence != lastSequence[conversationId][sender] + 1) revert InvalidSequence();
        messageId = canonicalId(conversationId, sender, sequence, envelopeHash);
        if (_envelopes[messageId].exists) revert EnvelopeExists();
        lastSequence[conversationId][sender] = sequence;
        _envelopes[messageId] = Envelope(conversationId, sender, sequence, envelopeHash, storageRefHash, uint64(block.timestamp), true);
        emit EnvelopeCommitted(messageId, conversationId, sender, sequence, envelopeHash, storageRefHash);
    }

    function envelope(bytes32 messageId) external view returns (Envelope memory) { Envelope storage e = _envelopes[messageId]; if (!e.exists) revert InvalidEnvelope(); return e; }
}
