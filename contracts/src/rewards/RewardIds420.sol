// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library RewardIds420 {
    bytes32 internal constant COMPONENT_REWARDS = keccak256("420/COMPONENT/REWARDS/V1");

    bytes32 internal constant ACTION_PUBLISH_CONTRIBUTION = keccak256("420/REWARDS/ACTION/PUBLISH_CONTRIBUTION/V1");
    bytes32 internal constant ACTION_CLAIM_REWARD = keccak256("420/REWARDS/ACTION/CLAIM_REWARD/V1");
    bytes32 internal constant ACTION_BIND_DISTRIBUTOR = keccak256("420/REWARDS/ACTION/BIND_DISTRIBUTOR/V1");
}