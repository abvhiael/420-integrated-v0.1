// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./MessengerEndpointRegistry420.sol";
import "./MessengerBlockRegistry420.sol";
import "./MessengerConversationRegistry420.sol";

contract MessengerRouter420 is I420System {
    MessengerEndpointRegistry420 public immutable endpoints;
    MessengerBlockRegistry420 public immutable blocks;
    MessengerConversationRegistry420 public immutable conversations;
    error ZeroAddress();

    constructor(address endpoints_, address blocks_, address conversations_) {
        if (endpoints_ == address(0) || blocks_ == address(0) || conversations_ == address(0)) revert ZeroAddress();
        endpoints = MessengerEndpointRegistry420(endpoints_);
        blocks = MessengerBlockRegistry420(blocks_);
        conversations = MessengerConversationRegistry420(conversations_);
    }

    function systemName() external pure returns (string memory) { return "MessengerRouter420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function canRequest(address a, address b) external view returns (bool) {
        return a != address(0) && b != address(0) && a != b && endpoints.isActive(a) && endpoints.isActive(b) && !blocks.blocked(a,b) && !blocks.blocked(b,a);
    }

    function canSend(bytes32 conversationId, address sender) external view returns (bool) {
        if (!conversations.isActive(conversationId) || !conversations.isParticipant(conversationId, sender)) return false;
        address peer = conversations.peerOf(conversationId, sender);
        return !blocks.blocked(sender, peer) && !blocks.blocked(peer, sender);
    }
}
