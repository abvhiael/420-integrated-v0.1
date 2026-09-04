// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./MessengerIds420.sol";
import "./MessengerAuthorization420.sol";
import "./MessengerConversationRegistry420.sol";
import "./MessengerEnvelopeRegistry420.sol";

contract MessengerReceiptRegistry420 is I420System {
    struct Receipt { uint64 deliveredAt; uint64 readAt; }
    MessengerAuthorization420 public immutable authorization;
    MessengerConversationRegistry420 public immutable conversations;
    MessengerEnvelopeRegistry420 public immutable envelopes;
    mapping(bytes32 => Receipt) public receipt;

    error ZeroAddress();
    error UnauthorizedReceipt();
    error NotRecipient();
    event MessageAcknowledged(bytes32 indexed messageId, address indexed recipient, bool read, uint64 timestamp);

    constructor(address authorization_, address conversations_, address envelopes_) {
        if (authorization_ == address(0) || conversations_ == address(0) || envelopes_ == address(0)) revert ZeroAddress();
        authorization = MessengerAuthorization420(authorization_);
        conversations = MessengerConversationRegistry420(conversations_);
        envelopes = MessengerEnvelopeRegistry420(envelopes_);
    }

    function systemName() external pure returns (string memory) { return "MessengerReceiptRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function acknowledge(address recipient, bytes32 messageId, bool markRead) external {
        if (msg.sender != recipient && !authorization.isAuthorized(msg.sender, recipient, MessengerIds420.ACTION_ACK_MESSAGE)) revert UnauthorizedReceipt();
        MessengerEnvelopeRegistry420.Envelope memory e = envelopes.envelope(messageId);
        address expected = conversations.peerOf(e.conversationId, e.sender);
        if (recipient != expected) revert NotRecipient();
        Receipt storage r = receipt[messageId];
        uint64 nowTs = uint64(block.timestamp);
        if (r.deliveredAt == 0) r.deliveredAt = nowTs;
        if (markRead && r.readAt == 0) r.readAt = nowTs;
        emit MessageAcknowledged(messageId, recipient, markRead, nowTs);
    }
}
