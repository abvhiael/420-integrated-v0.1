// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library GamingIds420 {
    bytes32 internal constant COMPONENT_GAMING = keccak256("420/GAMING/COMPONENT/V1");

    bytes32 internal constant ACTION_REGISTER_GAME = keccak256("420/GAMING/ACTION/REGISTER_GAME/V1");
    bytes32 internal constant ACTION_UPDATE_GAME = keccak256("420/GAMING/ACTION/UPDATE_GAME/V1");
    bytes32 internal constant ACTION_SET_GAME_STATUS = keccak256("420/GAMING/ACTION/SET_GAME_STATUS/V1");

    bytes32 internal constant ENTITLEMENT_CLASS_CONTENT = keccak256("420/GAMING/ENTITLEMENT/CONTENT/V1");
    bytes32 internal constant ENTITLEMENT_CLASS_COSMETIC = keccak256("420/GAMING/ENTITLEMENT/COSMETIC/V1");
    bytes32 internal constant ENTITLEMENT_CLASS_EVENT = keccak256("420/GAMING/ENTITLEMENT/EVENT/V1");
    bytes32 internal constant ENTITLEMENT_CLASS_PRESTIGE = keccak256("420/GAMING/ENTITLEMENT/PRESTIGE/V1");
    bytes32 internal constant ENTITLEMENT_CLASS_CROSS_GAME = keccak256("420/GAMING/ENTITLEMENT/CROSS_GAME/V1");
}
