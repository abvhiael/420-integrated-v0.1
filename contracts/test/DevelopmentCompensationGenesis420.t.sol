// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";

contract DevelopmentCompensationGenesis420Test {
    function testDevelopmentCompensationIsCanonicalGenesisServiceId() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        require(
            registry.isGenesisCanonicalServiceId(keccak256("420/service/development-compensation/v1")),
            "development compensation service id"
        );
    }
}
