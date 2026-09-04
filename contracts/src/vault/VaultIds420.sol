// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library VaultIds420 {
    bytes32 internal constant COMPONENT_VAULT = keccak256("420/COMPONENT/VAULT/V1");

    bytes32 internal constant VAULT_PERSONAL = keccak256("420/VAULT/TYPE/PERSONAL/V1");
    bytes32 internal constant VAULT_ESCROW = keccak256("420/VAULT/TYPE/ESCROW/V1");
    bytes32 internal constant VAULT_TREASURY = keccak256("420/VAULT/TYPE/TREASURY/V1");
    bytes32 internal constant VAULT_RESERVE = keccak256("420/VAULT/TYPE/RESERVE/V1");
    bytes32 internal constant VAULT_COLLATERAL = keccak256("420/VAULT/TYPE/COLLATERAL/V1");
    bytes32 internal constant VAULT_ROYALTY = keccak256("420/VAULT/TYPE/ROYALTY/V1");
    bytes32 internal constant VAULT_BENEFICIARY = keccak256("420/VAULT/TYPE/BENEFICIARY/V1");
    bytes32 internal constant VAULT_PROJECT = keccak256("420/VAULT/TYPE/PROJECT/V1");
    bytes32 internal constant VAULT_COMMUNITY = keccak256("420/VAULT/TYPE/COMMUNITY/V1");
    bytes32 internal constant VAULT_APPLICATION = keccak256("420/VAULT/TYPE/APPLICATION/V1");

    bytes32 internal constant POLICY_AUTHORIZATION = keccak256("420/VAULT/POLICY/AUTHORIZATION/V1");
    bytes32 internal constant POLICY_ASSET = keccak256("420/VAULT/POLICY/ASSET/V1");
    bytes32 internal constant POLICY_RELEASE = keccak256("420/VAULT/POLICY/RELEASE/V1");
    bytes32 internal constant POLICY_ACCOUNTING = keccak256("420/VAULT/POLICY/ACCOUNTING/V1");

    bytes32 internal constant ACTION_UPDATE_METADATA = keccak256("420/VAULT/ACTION/UPDATE_METADATA/V1");
    bytes32 internal constant ACTION_UPDATE_AUTH_POLICY = keccak256("420/VAULT/ACTION/UPDATE_AUTH_POLICY/V1");
    bytes32 internal constant ACTION_UPDATE_ASSET_POLICY = keccak256("420/VAULT/ACTION/UPDATE_ASSET_POLICY/V1");
    bytes32 internal constant ACTION_UPDATE_RELEASE_POLICY = keccak256("420/VAULT/ACTION/UPDATE_RELEASE_POLICY/V1");
    bytes32 internal constant ACTION_UPDATE_BENEFICIARIES = keccak256("420/VAULT/ACTION/UPDATE_BENEFICIARIES/V1");
    bytes32 internal constant ACTION_DEPOSIT = keccak256("420/VAULT/ACTION/DEPOSIT/V1");
    bytes32 internal constant ACTION_WITHDRAW = keccak256("420/VAULT/ACTION/WITHDRAW/V1");
    bytes32 internal constant ACTION_TRANSFER = keccak256("420/VAULT/ACTION/TRANSFER/V1");
    bytes32 internal constant ACTION_CREATE_OBLIGATION = keccak256("420/VAULT/ACTION/CREATE_OBLIGATION/V1");
    bytes32 internal constant ACTION_CANCEL_OBLIGATION = keccak256("420/VAULT/ACTION/CANCEL_OBLIGATION/V1");
    bytes32 internal constant ACTION_RELEASE_OBLIGATION = keccak256("420/VAULT/ACTION/RELEASE_OBLIGATION/V1");
    bytes32 internal constant ACTION_CLAIM = keccak256("420/VAULT/ACTION/CLAIM/V1");
    bytes32 internal constant ACTION_FREEZE = keccak256("420/VAULT/ACTION/FREEZE/V1");
    bytes32 internal constant ACTION_UNFREEZE = keccak256("420/VAULT/ACTION/UNFREEZE/V1");
    bytes32 internal constant ACTION_BEGIN_WIND_DOWN = keccak256("420/VAULT/ACTION/BEGIN_WIND_DOWN/V1");
    bytes32 internal constant ACTION_CLOSE = keccak256("420/VAULT/ACTION/CLOSE/V1");
    bytes32 internal constant ACTION_SETTLE_ESCROW = keccak256("420/VAULT/ACTION/SETTLE_ESCROW/V1");
    bytes32 internal constant ACTION_SETTLE_PROTOCOL = keccak256("420/VAULT/ACTION/SETTLE_PROTOCOL/V1");
    bytes32 internal constant ACTION_EXECUTE_STREAM = keccak256("420/VAULT/ACTION/EXECUTE_STREAM/V1");
}