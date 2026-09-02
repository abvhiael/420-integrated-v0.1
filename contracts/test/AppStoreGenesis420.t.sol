// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";

contract AppStoreGenesis420Test {
    function testAppStoreIsCanonicalGenesisServiceId() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        require(registry.isGenesisCanonicalServiceId(keccak256("420/service/appstore/v1")), "appstore service id");
    }
}
