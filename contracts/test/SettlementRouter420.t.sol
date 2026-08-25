// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/SettlementRouter420.sol";
import "./helpers/GenesisMocks420.sol";

contract SettlementRouter420Test {
    function testSplitValidation() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        SettlementRouter420 r = new SettlementRouter420(address(this), address(env.registry()), keccak256("settlement"));
        env.registerResident(address(r), r.componentId());
        address[] memory recipients = new address[](2);
        recipients[0] = address(1);
        recipients[1] = address(2);
        uint16[] memory bps = new uint16[](2);
        bps[0] = 5000;
        bps[1] = 5000;
        require(r.validateSplit(recipients, bps, 0), "valid split");
    }
}
