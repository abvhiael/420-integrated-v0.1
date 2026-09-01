// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library AttentionIds420 {
    bytes32 internal constant COMPONENT_ATTENTION = keccak256("420/COMPONENT/ATTENTION/V1");
    bytes32 internal constant ACTION_MANAGE_CAMPAIGN = keccak256("420/ATTENTION/ACTION/MANAGE_CAMPAIGN/V1");
    bytes32 internal constant ACTION_MANAGE_CONSENT = keccak256("420/ATTENTION/ACTION/MANAGE_CONSENT/V1");
    bytes32 internal constant ACTION_CLAIM_REWARD = keccak256("420/ATTENTION/ACTION/CLAIM_REWARD/V1");
}
