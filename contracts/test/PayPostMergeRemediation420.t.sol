// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/PaymentRegistry420.sol";
import "../src/pay/PaymentRouter420.sol";
import "../src/interfaces/ICanonicalSettlement420.sol";
import "./helpers/GenesisMocks420.sol";

interface VmPayRemediation420 {
    function prank(address) external;
}

contract SuccessfulSettlementAdapter420 is ICanonicalSettlement420 {
    function quote(bytes32, address, address, uint256) external pure returns (Quote memory) { revert(); }

    function execute(Quote calldata q, address, address, uint256 exactSettlementAmount)
        external payable returns (uint256 inputSpent, uint256 settlementDelivered)
    {
        return (q.inputAmount, exactSettlementAmount);
    }
}

contract PayPostMergeRemediation420Test {
    VmPayRemediation420 internal constant vm =
        VmPayRemediation420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant SETTLEMENT = address(0xCA420);
    bytes32 internal constant ASSET_ID = keccak256("CADC");
    bytes32 internal constant MARKET_ID = keccak256("420/CADC");

    function _quote() internal view returns (ICanonicalSettlement420.Quote memory) {
        return ICanonicalSettlement420.Quote({
            quoteId: keccak256("remediation-quote"),
            marketId: MARKET_ID,
            inputAsset: address(0x420),
            settlementAsset: SETTLEMENT,
            inputAmount: 100,
            minimumSettlementAmount: 84,
            quotedSettlementAmount: 84,
            conversionFee: 0,
            slippageBps: 0,
            quotedAt: uint64(block.timestamp)
        });
    }

    function testPayerCanRegisterPaymentWithoutGovernanceAuthorization() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        PaymentRegistry420 registry =
            new PaymentRegistry420(address(this), address(env.registry()), keccak256("pay-remediation-registry"));
        env.registerResident(address(registry), registry.componentId());
        env.setSettlementAsset(SETTLEMENT, ASSET_ID, true);
        env.governance().set(false, false);

        vm.prank(ALICE);
        bytes32 paymentId = registry.createPayment(
            keccak256("invoice"), ALICE, BOB, address(0x420), 100, SETTLEMENT, 84, keccak256("quote"), 1
        );
        require(paymentId != bytes32(0), "payer registration failed");

        vm.prank(BOB);
        (bool thirdPartyOk,) = address(registry).call(
            abi.encodeWithSelector(
                registry.createPayment.selector,
                keccak256("invoice-2"), ALICE, BOB, address(0x420), 100, SETTLEMENT, 84, keccak256("quote-2"), 2
            )
        );
        require(!thirdPartyOk, "third party bypassed governance");
    }

    function testPayerCanExecuteSettlementWithoutGovernanceAuthorization() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        PaymentRouter420 router =
            new PaymentRouter420(address(this), address(env.registry()), keccak256("pay-remediation-router"));
        env.registerResident(address(router), router.componentId());
        env.setSettlementAsset(SETTLEMENT, ASSET_ID, true);
        env.health().setMarket(MARKET_ID, true);
        env.fees().set(0, 0, false);

        SuccessfulSettlementAdapter420 adapter = new SuccessfulSettlementAdapter420();
        router.setSettlementAdapter(address(adapter));
        env.governance().set(false, false);

        ICanonicalSettlement420.Quote memory q = _quote();
        PaymentRouter420.PayerLimits memory limits = PaymentRouter420.PayerLimits({
            maxInputAmount: 100,
            maxGasCost420: 0,
            maxSlippageBps: 0,
            maxTip: 0,
            maxConversionFee: 0,
            maxProtocolFee: 0,
            quoteTimestamp: q.quotedAt
        });

        bytes32 paymentId = keccak256("payer-direct");
        vm.prank(ALICE);
        (, uint256 delivered) = router.executeSwapSettlement(paymentId, q, ALICE, BOB, 84, limits, 0, 0);
        require(delivered == 84, "payer settlement failed");
        require(router.consumedPaymentAuthorization(paymentId), "local replay not consumed");

        bytes32 thirdPartyId = keccak256("third-party");
        vm.prank(BOB);
        (bool thirdPartyOk,) = address(router).call(
            abi.encodeWithSelector(router.executeSwapSettlement.selector, thirdPartyId, q, ALICE, BOB, 84, limits, 0, 0)
        );
        require(!thirdPartyOk, "third party bypassed governance");
    }
}
