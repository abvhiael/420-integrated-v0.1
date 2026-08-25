// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/PaymentRouter420.sol";
import "../src/pay/adapters/CanonicalSettlementAdapter420.sol";
import "../src/interfaces/ICanonicalSettlement420.sol";
import "./helpers/GenesisMocks420.sol";

contract MockCanonicalSwapExecutor420 {
    bool public fail;
    uint256 public spendOverride;
    uint256 public deliveryOverride;

    function setResult(bool fail_, uint256 spend_, uint256 delivery_) external {
        fail = fail_;
        spendOverride = spend_;
        deliveryOverride = delivery_;
    }

    function executeCanonicalSwap(
        bytes32,
        address,
        address,
        address,
        address,
        uint256 inputAmount,
        uint256 exactSettlementAmount
    ) external payable returns (uint256 inputSpent, uint256 delivered) {
        require(!fail, "executor failure");
        inputSpent = spendOverride == 0 ? inputAmount : spendOverride;
        delivered = deliveryOverride == 0 ? exactSettlementAmount : deliveryOverride;
    }
}

contract PaymentGenesisIntegration420Test {
    function _quote(address settlementAsset, uint256 conversionFee)
        internal
        view
        returns (ICanonicalSettlement420.Quote memory)
    {
        return ICanonicalSettlement420.Quote({
            quoteId: keccak256("integration-quote"),
            marketId: keccak256("CADC/420"),
            inputAsset: address(0x420),
            settlementAsset: settlementAsset,
            inputAmount: 100 ether,
            minimumSettlementAmount: 84 ether,
            quotedSettlementAmount: 85 ether,
            conversionFee: conversionFee,
            slippageBps: 42,
            quotedAt: uint64(block.timestamp)
        });
    }

    function testRouterAdapterExecutorAtomicSuccess() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        MockCanonicalSwapExecutor420 executor = new MockCanonicalSwapExecutor420();
        CanonicalSettlementAdapter420 adapter = new CanonicalSettlementAdapter420(
            address(this), address(env.registry()), keccak256("adapter"), address(executor)
        );
        PaymentRouter420 router = new PaymentRouter420(
            address(this), address(env.registry()), keccak256("router")
        );
        env.registerResident(address(adapter), adapter.componentId());
        env.registerResident(address(router), router.componentId());

        address settlementAsset = address(0xCA420);
        bytes32 assetId = keccak256("CADC");
        bytes32 marketId = keccak256("CADC/420");
        env.setSettlementAsset(settlementAsset, assetId, true);
        env.health().setMarket(marketId, true);
        env.fees().set(1 ether, 0, false);
        router.setSettlementAdapter(address(adapter));

        ICanonicalSettlement420.Quote memory q = _quote(settlementAsset, 1 ether);
        PaymentRouter420.PayerLimits memory limits = PaymentRouter420.PayerLimits({
            maxInputAmount: 100 ether,
            maxGasCost420: 0.01 ether,
            maxSlippageBps: 42,
            maxTip: 1 ether,
            maxConversionFee: 1 ether,
            maxProtocolFee: 0,
            quoteTimestamp: uint64(block.timestamp)
        });

        (uint256 spent, uint256 delivered) = router.executeSwapSettlement(
            keccak256("integration-payment"), q, address(0xA11CE), address(0xB0B), 84 ether, limits, 0, 0
        );
        require(spent == 100 ether, "spent");
        require(delivered == 84 ether, "delivered");
        require(router.consumedPaymentAuthorization(keccak256("integration-payment")), "payment replay state");
        require(adapter.consumedQuote(keccak256("integration-quote")), "quote replay state");
    }

    function testExecutorFailureRollsBackBothReplayLayers() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        MockCanonicalSwapExecutor420 executor = new MockCanonicalSwapExecutor420();
        executor.setResult(true, 0, 0);
        CanonicalSettlementAdapter420 adapter = new CanonicalSettlementAdapter420(
            address(this), address(env.registry()), keccak256("adapter"), address(executor)
        );
        PaymentRouter420 router = new PaymentRouter420(
            address(this), address(env.registry()), keccak256("router")
        );
        env.registerResident(address(adapter), adapter.componentId());
        env.registerResident(address(router), router.componentId());
        address settlementAsset = address(0xCA420);
        env.setSettlementAsset(settlementAsset, keccak256("CADC"), true);
        env.health().setMarket(keccak256("CADC/420"), true);
        env.fees().set(0, 0, false);
        router.setSettlementAdapter(address(adapter));

        ICanonicalSettlement420.Quote memory q = _quote(settlementAsset, 0);
        PaymentRouter420.PayerLimits memory limits = PaymentRouter420.PayerLimits(
            100 ether, 1 ether, 42, 0, 0, 0, uint64(block.timestamp)
        );
        bytes32 paymentId = keccak256("rollback-payment");
        (bool ok,) = address(router).call(
            abi.encodeWithSelector(
                router.executeSwapSettlement.selector,
                paymentId,
                q,
                address(0xA11CE),
                address(0xB0B),
                84 ether,
                limits,
                0,
                0
            )
        );
        require(!ok, "executor failure accepted");
        require(!router.consumedPaymentAuthorization(paymentId), "router replay did not roll back");
        require(!adapter.consumedQuote(q.quoteId), "adapter replay did not roll back");
    }

    function testRegistryCodeHashMismatchFailsClosed() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        PaymentRouter420 router = new PaymentRouter420(
            address(this), address(env.registry()), keccak256("router")
        );
        env.registerResident(address(router), router.componentId());
        env.registry().setCodeHash(router.componentId(), bytes32(uint256(1)));
        PaymentRouter420.PayerLimits memory limits = PaymentRouter420.PayerLimits(
            1, 1, 42, 0, 0, 0, uint64(block.timestamp)
        );
        ICanonicalSettlement420.Quote memory q;
        (bool ok,) = address(router).call(
            abi.encodeWithSelector(
                router.executeSwapSettlement.selector,
                keccak256("bad-hash"), q, address(1), address(2), 1, limits, 0, 0
            )
        );
        require(!ok, "code-hash mismatch accepted");
    }
}
