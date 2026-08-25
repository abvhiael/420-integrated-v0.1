// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/GasSponsor420.sol";
import "./helpers/GenesisMocks420.sol";

contract GasSponsor420Test {
    function testConstants() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        GasSponsor420 s = new GasSponsor420(address(this), address(env.registry()), keccak256("sponsor"));
        env.registerResident(address(s), s.componentId());
        require(s.MAX_GAS_PER_OPERATION() == 420_000, "gas");
        require(s.RESERVE_FLOOR_BPS() == 1_000, "floor");
        require(s.WALLET_SUCCESS_CAP() == 2, "success cap");
    }
}
