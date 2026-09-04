// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";

contract NotificationsGenesis420Test {
    function testNotificationsIsCanonicalGenesisServiceId() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        require(
            registry.isGenesisCanonicalServiceId(keccak256("420/service/notifications/v1")),
            "notifications service id"
        );
    }
}
