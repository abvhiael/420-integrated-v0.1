// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library TokenIds420 {
    bytes32 internal constant COMPONENT_TOKEN = keccak256("420/component/token/v1");
    bytes32 internal constant COMMUNITY_TOKEN_REVENUE_VAULT = keccak256("420/treasury/vault/token-creation-community-revenue/v1");
    bytes32 internal constant ERC20_FIXED = keccak256("420/token/template/erc20-fixed/v1");
    bytes32 internal constant ERC20_MINTABLE = keccak256("420/token/template/erc20-mintable/v1");
    bytes32 internal constant ERC20_CAPPED = keccak256("420/token/template/erc20-capped/v1");
    bytes32 internal constant ERC20_BURNABLE = keccak256("420/token/template/erc20-burnable/v1");
    bytes32 internal constant ERC20_PERMIT = keccak256("420/token/template/erc20-permit/v1");
    bytes32 internal constant ERC20_VOTES = keccak256("420/token/template/erc20-votes/v1");
    bytes32 internal constant ERC721_COLLECTION = keccak256("420/token/template/erc721-collection/v1");
    bytes32 internal constant ERC1155_MULTI = keccak256("420/token/template/erc1155-multi/v1");
}
