// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";

contract VerifyGenesis420Test {
    function testVerifyIsCanonicalGenesisServiceId() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        require(registry.isGenesisCanonicalServiceId(keccak256("420/service/verify/v1")), "verify service id");
    }
}
