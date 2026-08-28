// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library BetSlotIds420 {
    bytes32 internal constant COMPONENT_BET_SLOTS = keccak256("420/BET/COMPONENT/SLOTS/V1");

    bytes32 internal constant ACTION_REGISTER = keccak256("420/BET/SLOT/ACTION/REGISTER/V1");
    bytes32 internal constant ACTION_SUBMIT_REVIEW = keccak256("420/BET/SLOT/ACTION/SUBMIT_REVIEW/V1");
    bytes32 internal constant ACTION_APPROVE = keccak256("420/BET/SLOT/ACTION/APPROVE/V1");
    bytes32 internal constant ACTION_ACTIVATE = keccak256("420/BET/SLOT/ACTION/ACTIVATE/V1");
    bytes32 internal constant ACTION_PAUSE = keccak256("420/BET/SLOT/ACTION/PAUSE/V1");
    bytes32 internal constant ACTION_DEPRECATE = keccak256("420/BET/SLOT/ACTION/DEPRECATE/V1");
    bytes32 internal constant ACTION_VAULT_AUTHORIZE = keccak256("420/BET/SLOT/ACTION/VAULT_AUTHORIZE/V1");
    bytes32 internal constant ACTION_VAULT_REVOKE = keccak256("420/BET/SLOT/ACTION/VAULT_REVOKE/V1");
}