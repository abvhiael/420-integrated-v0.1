// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/PaymentRouter420.sol";
import "../src/pay/adapters/CanonicalSettlementAdapter420.sol";
import "../src/swap/CanonicalMarketRegistry.sol";
import "../src/swap/CanonicalSwapExecutor420.sol";
import "../src/interfaces/ICanonicalSettlement420.sol";
import "./SwapGenesisIntegration420.t.sol";
import "./helpers/GenesisMocks420.sol";

contract PaySwapGenesisIntegration420Test {
    bytes32 constant MARKET_ID = keccak256("CADC/420");
    address constant INPUT = address(0x420);
    address constant SETTLEMENT = address(0xCA420);

    function testPayToRealSwapBoundaryAtomicSuccess() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        CanonicalMarketRegistry markets = new CanonicalMarketRegistry(address(this), address(env.registry()), keccak256("markets"));
        CanonicalSwapExecutor420 swapExecutor = new CanonicalSwapExecutor420(address(this), address(env.registry()), keccak256("swap-executor"));
        MockCanonicalPoolExecution420 pool = new MockCanonicalPoolExecution420();
        CanonicalSettlementAdapter420 settlementAdapter = new CanonicalSettlementAdapter420(
            address(this), address(env.registry()), keccak256("pay-adapter"), address(swapExecutor)
        );
        PaymentRouter420 pay = new PaymentRouter420(address(this), address(env.registry()), keccak256("pay-router"));

        env.registerResident(address(markets), markets.componentId());
        env.registerResident(address(swapExecutor), swapExecutor.componentId());
        env.registerResident(address(settlementAdapter), settlementAdapter.componentId());
        env.registerResident(address(pay), pay.componentId());
        env.setSettlementAsset(SETTLEMENT, keccak256("CADC"), true);
        env.health().setMarket(MARKET_ID, true);
        env.fees().set(1 ether, 0, false);

        markets.setMarket(
            MARKET_ID, address(pool), INPUT, SETTLEMENT,
            CanonicalMarketRegistry.Role.CANONICAL_CAD, keccak256("canonical-cad-market"), true
        );
        swapExecutor.setTrustedCaller(address(settlementAdapter), true);
        pay.setSettlementAdapter(address(settlementAdapter));
        pool.setResult(90 ether, 84 ether, false);

        ICanonicalSettlement420.Quote memory q = ICanonicalSettlement420.Quote({
            quoteId: keccak256("pay-swap-quote"),
            marketId: MARKET_ID,
            inputAsset: INPUT,
            settlementAsset: SETTLEMENT,
            inputAmount: 100 ether,
            minimumSettlementAmount: 84 ether,
            quotedSettlementAmount: 85 ether,
            conversionFee: 1 ether,
            slippageBps: 42,
            quotedAt: uint64(block.timestamp)
        });
        PaymentRouter420.PayerLimits memory limits = PaymentRouter420.PayerLimits({
            maxInputAmount: 100 ether,
            maxGasCost420: 1 ether,
            maxSlippageBps: 42,
            maxTip: 0,
            maxConversionFee: 1 ether,
            maxProtocolFee: 0,
            quoteTimestamp: uint64(block.timestamp)
        });

        (uint256 spent, uint256 delivered) = pay.executeSwapSettlement(
            keccak256("pay-swap-payment"), q, address(0xA11CE), address(0xB0B), 84 ether, limits, 0, 0
        );
        require(spent == 90 ether, "spent");
        require(delivered == 84 ether, "delivered");
    }

    function testPoolFailureRollsBackPayAndAdapterReplayState() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        CanonicalMarketRegistry markets = new CanonicalMarketRegistry(address(this), address(env.registry()), keccak256("markets"));
        CanonicalSwapExecutor420 swapExecutor = new CanonicalSwapExecutor420(address(this), address(env.registry()), keccak256("swap-executor"));
        MockCanonicalPoolExecution420 pool = new MockCanonicalPoolExecution420();
        CanonicalSettlementAdapter420 settlementAdapter = new CanonicalSettlementAdapter420(
            address(this), address(env.registry()), keccak256("pay-adapter"), address(swapExecutor)
        );
        PaymentRouter420 pay = new PaymentRouter420(address(this), address(env.registry()), keccak256("pay-router"));
        env.registerResident(address(markets), markets.componentId());
        env.registerResident(address(swapExecutor), swapExecutor.componentId());
        env.registerResident(address(settlementAdapter), settlementAdapter.componentId());
        env.registerResident(address(pay), pay.componentId());
        env.setSettlementAsset(SETTLEMENT, keccak256("CADC"), true);
        env.health().setMarket(MARKET_ID, true);
        env.fees().set(0, 0, false);
        markets.setMarket(MARKET_ID, address(pool), INPUT, SETTLEMENT, CanonicalMarketRegistry.Role.CANONICAL_CAD, bytes32(0), true);
        swapExecutor.setTrustedCaller(address(settlementAdapter), true);
        pay.setSettlementAdapter(address(settlementAdapter));
        pool.setResult(0, 0, true);

        bytes32 paymentId = keccak256("pay-swap-rollback");
        bytes32 quoteId = keccak256("pay-swap-failed-quote");
        ICanonicalSettlement420.Quote memory q = ICanonicalSettlement420.Quote(
            quoteId, MARKET_ID, INPUT, SETTLEMENT, 100 ether, 84 ether, 85 ether, 0, 42, uint64(block.timestamp)
        );
        PaymentRouter420.PayerLimits memory limits = PaymentRouter420.PayerLimits(
            100 ether, 1 ether, 42, 0, 0, 0, uint64(block.timestamp)
        );
        (bool ok,) = address(pay).call(abi.encodeWithSelector(
            pay.executeSwapSettlement.selector,
            paymentId, q, address(0xA11CE), address(0xB0B), 84 ether, limits, 0, 0
        ));
        require(!ok, "failed pool accepted");
        require(!pay.consumedPaymentAuthorization(paymentId), "pay replay not rolled back");
        require(!settlementAdapter.consumedQuote(quoteId), "adapter replay not rolled back");
    }
}
