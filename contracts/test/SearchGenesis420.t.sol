// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";

contract SearchGenesis420Test {
    function testSearchIsCanonicalGenesisServiceId() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        require(registry.isGenesisCanonicalServiceId(keccak256("420/service/search/v1")), "search service id");
    }
}
