// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library HighCountryGamingIds {
    bytes32 internal constant GAME_ID = keccak256("420/GAMING/GAME/HIGH_COUNTRY/V1");

    bytes32 internal constant ENTITLEMENT_BONUS_REGION = keccak256("420/HC/ENTITLEMENT/BONUS_REGION/V1");
    bytes32 internal constant ENTITLEMENT_COSMETIC = keccak256("420/HC/ENTITLEMENT/COSMETIC/V1");
    bytes32 internal constant ENTITLEMENT_COMPETITION = keccak256("420/HC/ENTITLEMENT/COMPETITION/V1");
    bytes32 internal constant ENTITLEMENT_GENETICS = keccak256("420/HC/ENTITLEMENT/GENETICS/V1");
    bytes32 internal constant ENTITLEMENT_CROSS_GAME = keccak256("420/HC/ENTITLEMENT/CROSS_GAME/V1");
}
