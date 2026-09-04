// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library MessengerIds420 {
    bytes32 internal constant COMPONENT_MESSENGER = keccak256("420/COMPONENT/MESSENGER/V1");
    bytes32 internal constant ACTION_MANAGE_ENDPOINT = keccak256("420/MESSENGER/ACTION/MANAGE_ENDPOINT/V1");
    bytes32 internal constant ACTION_SET_BLOCK = keccak256("420/MESSENGER/ACTION/SET_BLOCK/V1");
    bytes32 internal constant ACTION_MANAGE_CONVERSATION = keccak256("420/MESSENGER/ACTION/MANAGE_CONVERSATION/V1");
    bytes32 internal constant ACTION_SEND_MESSAGE = keccak256("420/MESSENGER/ACTION/SEND_MESSAGE/V1");
    bytes32 internal constant ACTION_ACK_MESSAGE = keccak256("420/MESSENGER/ACTION/ACK_MESSAGE/V1");
}
