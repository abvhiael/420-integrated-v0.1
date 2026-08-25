// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/PaymentRouter420.sol";
import "./helpers/GenesisMocks420.sol";

contract PaymentRouter420LimitsTest {
    function _router() internal returns (PaymentRouter420) {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        PaymentRouter420 r = new PaymentRouter420(address(this), address(env.registry()), keccak256("router-limits"));
        env.registerResident(address(r), r.componentId());
        return r;
    }

    function testFuzz_InputLimit(uint96 maxInput, uint96 input) public {
        PaymentRouter420 r = _router();
        PaymentRouter420.PayerLimits memory l = PaymentRouter420.PayerLimits(
            maxInput, type(uint256).max, 42, type(uint256).max, type(uint256).max, 0, uint64(block.timestamp)
        );
        bool shouldPass = input <= maxInput;
        (bool ok,) = address(r).call(
            abi.encodeWithSelector(r.validateLimits.selector, l, input, 0, 0, 0, 0, 0)
        );
        require(ok == shouldPass, "input boundary");
    }

    function testProtocolFeeCannotBecomeNonzero() public {
        PaymentRouter420 r = _router();
        PaymentRouter420.PayerLimits memory l = PaymentRouter420.PayerLimits(
            100, 100, 42, 100, 100, 100, uint64(block.timestamp)
        );
        (bool ok,) = address(r).call(
            abi.encodeWithSelector(r.validateLimits.selector, l, 1, 1, 1, 1, 1, 1)
        );
        require(!ok, "protocol fee accepted");
    }
}
