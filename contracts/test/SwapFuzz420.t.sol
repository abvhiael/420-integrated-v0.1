// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./SwapGenesisIntegration420.t.sol";

contract SwapFuzz420Test {
    bytes32 constant MARKET_ID = keccak256("CADC/420");
    address constant INPUT = address(0x420);
    address constant SETTLEMENT = address(0xCA420);

    function testFuzz_ExecutorPreservesPostconditions(uint96 rawInput, uint96 rawSpent, uint96 rawExtra) public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        CanonicalMarketRegistry markets = new CanonicalMarketRegistry(address(this), address(env.registry()), keccak256("m"));
        CanonicalSwapExecutor420 executor = new CanonicalSwapExecutor420(address(this), address(env.registry()), keccak256("e"));
        MockCanonicalPoolExecution420 pool = new MockCanonicalPoolExecution420();
        env.registerResident(address(markets), markets.componentId());
        env.registerResident(address(executor), executor.componentId());
        env.setSettlementAsset(SETTLEMENT, keccak256("CADC"), true);
        env.health().setMarket(MARKET_ID, true);
        markets.setMarket(MARKET_ID, address(pool), INPUT, SETTLEMENT, CanonicalMarketRegistry.Role.CANONICAL_CAD, bytes32(0), true);
        executor.setTrustedCaller(address(this), true);

        uint256 input = uint256(rawInput) + 1;
        uint256 spent = uint256(rawSpent) % (input + 1);
        uint256 exactSettlement = (input % 1_000_000 ether) + 1;
        uint256 delivered = exactSettlement + (uint256(rawExtra) % 1_000_000 ether);
        pool.setResult(spent == 0 ? 1 : spent, delivered, false);

        (uint256 actualSpent, uint256 actualDelivered) = executor.executeCanonicalSwap(
            MARKET_ID, address(1), address(2), INPUT, SETTLEMENT, input, exactSettlement
        );
        require(actualSpent <= input, "overspend");
        require(actualDelivered >= exactSettlement, "underdelivery");
    }
}
