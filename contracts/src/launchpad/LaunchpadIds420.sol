// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library LaunchpadIds420 {
    bytes32 internal constant COMPONENT_LAUNCHPAD = keccak256("420/COMPONENT/LAUNCHPAD/V1");
    bytes32 internal constant ACTION_CONTRIBUTE = keccak256("420/LAUNCHPAD/ACTION/CONTRIBUTE/V1");
    bytes32 internal constant ACTION_CLAIM = keccak256("420/LAUNCHPAD/ACTION/CLAIM/V1");
    bytes32 internal constant ACTION_REFUND = keccak256("420/LAUNCHPAD/ACTION/REFUND/V1");
}
