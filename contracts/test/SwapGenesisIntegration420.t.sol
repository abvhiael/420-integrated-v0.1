// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/swap/CanonicalMarketRegistry.sol";
import "../src/swap/CanonicalSwapExecutor420.sol";
import "./helpers/GenesisMocks420.sol";

contract MockCanonicalPoolExecution420 {
    uint256 public spent;
    uint256 public delivered;
    bool public fail;

    function setResult(uint256 spent_, uint256 delivered_, bool fail_) external {
        spent = spent_;
        delivered = delivered_;
        fail = fail_;
    }

    function executeCanonicalSwap(address,address,address,address,uint256 inputAmount,uint256 exactSettlementAmount)
        external payable returns (uint256 inputSpent, uint256 settlementDelivered)
    {
        require(!fail, "pool fail");
        inputSpent = spent == 0 ? inputAmount : spent;
        settlementDelivered = delivered == 0 ? exactSettlementAmount : delivered;
    }
}

contract SwapGenesisIntegration420Test {
    bytes32 constant MARKET_ID = keccak256("CADC/420");
    address constant INPUT = address(0x420);
    address constant SETTLEMENT = address(0xCA420);

    function _setup() internal returns (
        GenesisMockEnvironment420 env,
        CanonicalMarketRegistry markets,
        CanonicalSwapExecutor420 executor,
        MockCanonicalPoolExecution420 pool
    ) {
        env = new GenesisMockEnvironment420();
        markets = new CanonicalMarketRegistry(address(this), address(env.registry()), keccak256("swap-market-registry"));
        executor = new CanonicalSwapExecutor420(address(this), address(env.registry()), keccak256("swap-executor"));
        pool = new MockCanonicalPoolExecution420();
        env.registerResident(address(markets), markets.componentId());
        env.registerResident(address(executor), executor.componentId());
        env.setSettlementAsset(SETTLEMENT, keccak256("CADC"), true);
        env.health().setMarket(MARKET_ID, true);
        markets.setMarket(
            MARKET_ID, address(pool), INPUT, SETTLEMENT,
            CanonicalMarketRegistry.Role.CANONICAL_CAD, keccak256("market-metadata"), true
        );
        executor.setTrustedCaller(address(this), true);
    }

    function testCanonicalExecutionSuccess() public {
        (, , CanonicalSwapExecutor420 executor, MockCanonicalPoolExecution420 pool) = _setup();
        pool.setResult(90 ether, 85 ether, false);
        (uint256 spent, uint256 delivered) = executor.executeCanonicalSwap(
            MARKET_ID, address(0xA11CE), address(0xB0B), INPUT, SETTLEMENT, 100 ether, 84 ether
        );
        require(spent == 90 ether && delivered == 85 ether, "result");
    }

    function testUnderDeliveryFailsClosed() public {
        (, , CanonicalSwapExecutor420 executor, MockCanonicalPoolExecution420 pool) = _setup();
        pool.setResult(90 ether, 83 ether, false);
        (bool ok,) = address(executor).call(abi.encodeWithSelector(
            executor.executeCanonicalSwap.selector,
            MARKET_ID, address(0xA11CE), address(0xB0B), INPUT, SETTLEMENT, 100 ether, 84 ether
        ));
        require(!ok, "underdelivery accepted");
    }

    function testSharedPauseFailsClosed() public {
        (GenesisMockEnvironment420 env,, CanonicalSwapExecutor420 executor,) = _setup();
        env.pause().setPaused(true);
        (bool ok,) = address(executor).call(abi.encodeWithSelector(
            executor.executeCanonicalSwap.selector,
            MARKET_ID, address(0xA11CE), address(0xB0B), INPUT, SETTLEMENT, 100 ether, 84 ether
        ));
        require(!ok, "paused swap accepted");
    }
}
