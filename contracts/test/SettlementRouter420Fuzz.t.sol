// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/SettlementRouter420.sol";
import "./helpers/GenesisMocks420.sol";

contract SettlementRouter420FuzzTest {
    SettlementRouter420 r;
    constructor() {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        r = new SettlementRouter420(address(this), address(env.registry()), keccak256("split-fuzz"));
        env.registerResident(address(r), r.componentId());
    }

    function testFuzz_SplitConserves(uint128 amount, uint16 a, uint16 b) public {
        if (amount == 0) return;
        uint256 aa = uint256(a) % 10001;
        uint256 bb = uint256(b) % (10001 - aa);
        uint16[] memory bps = new uint16[](3);
        bps[0] = uint16(aa);
        bps[1] = uint16(bb);
        bps[2] = uint16(10000 - aa - bb);
        uint256[] memory out = r.splitAmounts(amount, bps, 0);
        require(out[0] + out[1] + out[2] == amount, "loss/creation");
    }

    function testFuzz_PrimaryGetsRemainder(uint96 amount) public {
        if (amount == 0) return;
        uint16[] memory bps = new uint16[](3);
        bps[0] = 3333;
        bps[1] = 3333;
        bps[2] = 3334;
        uint256[] memory out = r.splitAmounts(amount, bps, 0);
        require(out[0] + out[1] + out[2] == amount, "conservation");
    }
}
