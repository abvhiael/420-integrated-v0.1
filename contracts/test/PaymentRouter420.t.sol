// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/PaymentRouter420.sol";
import "./helpers/GenesisMocks420.sol";

contract PaymentRouter420Test {
    function testProtocolFeeZero() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        PaymentRouter420 r = new PaymentRouter420(address(this), address(env.registry()), keccak256("pay-test"));
        env.registerResident(address(r), r.componentId());
        require(r.PROTOCOL_FEE_BPS() == 0, "fee");
        require(r.registry() == address(env.registry()), "registry");
        Types420.Version memory v = r.protocolVersion();
        require(v.major == 1 && v.minor == 0 && v.patch == 0, "version");
    }
}
