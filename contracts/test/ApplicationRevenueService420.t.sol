// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";

contract ApplicationRevenueService420Test {
    function testApplicationRevenueIsCanonicalGenesisServiceId() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        require(
            registry.isGenesisCanonicalServiceId(keccak256("420/service/application-revenue/v1")),
            "application revenue service id"
        );
    }
}
