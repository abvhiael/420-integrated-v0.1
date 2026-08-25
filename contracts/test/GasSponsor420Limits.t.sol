// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/GasSponsor420.sol";
import "./helpers/GenesisMocks420.sol";

contract GasSponsor420LimitsTest {
    receive() external payable {}

    function testGasCapRejects() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        GasSponsor420 s = new GasSponsor420(address(this), address(env.registry()), keccak256("sponsor-limits"));
        env.registerResident(address(s), s.componentId());
        bytes32 op = keccak256("pay");
        s.setOperation(op, true);
        (bool ok,) = address(s).call(
            abi.encodeWithSelector(s.recordSponsored.selector, address(1), bytes32(uint256(2)), op, 420_001, 0, true, false)
        );
        require(!ok, "gas cap");
    }

    function testSystemHaltRejectsNewSponsorship() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        GasSponsor420 s = new GasSponsor420(address(this), address(env.registry()), keccak256("sponsor-halt"));
        env.registerResident(address(s), s.componentId());
        bytes32 op = keccak256("pay");
        s.setOperation(op, true);
        env.safety().setState(ISystemSafety420.SafetyState.HALTED);
        (bool ok,) = address(s).call(
            abi.encodeWithSelector(s.recordSponsored.selector, address(1), bytes32(uint256(2)), op, 1, 0, true, false)
        );
        require(!ok, "halt accepted");
    }
}
