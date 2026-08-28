// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library VPNIds420 {
    bytes32 internal constant COMPONENT_VPN = keccak256("420/COMPONENT/VPN/V1");

    bytes32 internal constant NODE_ENTRY_RELAY = keccak256("420/VPN/NODE_CAPABILITY/ENTRY_RELAY/V1");
    bytes32 internal constant NODE_MIDDLE_RELAY = keccak256("420/VPN/NODE_CAPABILITY/MIDDLE_RELAY/V1");
    bytes32 internal constant NODE_EXIT_RELAY = keccak256("420/VPN/NODE_CAPABILITY/EXIT_RELAY/V1");
    bytes32 internal constant NODE_PRIVATE_GATEWAY = keccak256("420/VPN/NODE_CAPABILITY/PRIVATE_GATEWAY/V1");
    bytes32 internal constant NODE_APP_RELAY = keccak256("420/VPN/NODE_CAPABILITY/APP_RELAY/V1");

    bytes32 internal constant POLICY_ROUTE = keccak256("420/VPN/POLICY/ROUTE/V1");
    bytes32 internal constant POLICY_PRICING = keccak256("420/VPN/POLICY/PRICING/V1");
    bytes32 internal constant POLICY_EXIT_USAGE = keccak256("420/VPN/POLICY/EXIT_USAGE/V1");
    bytes32 internal constant POLICY_SLA = keccak256("420/VPN/POLICY/SLA/V1");

    bytes32 internal constant ACTION_REGISTER_PROVIDER = keccak256("420/VPN/ACTION/REGISTER_PROVIDER/V1");
    bytes32 internal constant ACTION_UPDATE_PROVIDER = keccak256("420/VPN/ACTION/UPDATE_PROVIDER/V1");
    bytes32 internal constant ACTION_SET_PROVIDER_STATUS = keccak256("420/VPN/ACTION/SET_PROVIDER_STATUS/V1");
    bytes32 internal constant ACTION_REGISTER_NODE = keccak256("420/VPN/ACTION/REGISTER_NODE/V1");
    bytes32 internal constant ACTION_UPDATE_NODE = keccak256("420/VPN/ACTION/UPDATE_NODE/V1");
    bytes32 internal constant ACTION_SET_NODE_STATUS = keccak256("420/VPN/ACTION/SET_NODE_STATUS/V1");
    bytes32 internal constant ACTION_FUND_SESSION = keccak256("420/VPN/ACTION/FUND_SESSION/V1");
    bytes32 internal constant ACTION_ACTIVATE_SESSION = keccak256("420/VPN/ACTION/ACTIVATE_SESSION/V1");
    bytes32 internal constant ACTION_CLOSE_SESSION = keccak256("420/VPN/ACTION/CLOSE_SESSION/V1");
    bytes32 internal constant ACTION_SUBMIT_RECEIPT = keccak256("420/VPN/ACTION/SUBMIT_RECEIPT/V1");
    bytes32 internal constant ACTION_SETTLE_SESSION = keccak256("420/VPN/ACTION/SETTLE_SESSION/V1");
    bytes32 internal constant ACTION_DISPUTE_SESSION = keccak256("420/VPN/ACTION/DISPUTE_SESSION/V1");
}
