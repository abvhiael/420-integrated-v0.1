// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/PaymentRouter420.sol";
import "../src/pay/PaymentRegistry420.sol";
import "../src/pay/SettlementRouter420.sol";
import "../src/pay/RefundManager420.sol";
import "../src/pay/GasSponsor420.sol";
import "../src/pay/adapters/CanonicalSettlementAdapter420.sol";
import "../src/interfaces/ICanonicalSettlement420.sol";
import "./helpers/GenesisMocks420.sol";

interface VmPayAudit4 {
    function prank(address) external;
    function deal(address account, uint256 newBalance) external;
}

contract PayAudit4Token420 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 approved = allowance[from][msg.sender];
        require(approved >= amount && balanceOf[from] >= amount, "allowance/balance");
        allowance[from][msg.sender] = approved - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract PayAudit4SwapExecutor420 {
    function executeCanonicalSwap(
        bytes32,
        address,
        address recipient,
        address,
        address settlementAsset,
        uint256 inputAmount,
        uint256 exactSettlementAmount
    ) external returns (uint256 inputSpent, uint256 settlementDelivered) {
        require(PayAudit4Token420(settlementAsset).transfer(recipient, exactSettlementAmount), "settlement transfer");
        return (inputAmount, exactSettlementAmount);
    }
}

contract PayAudit4SettlementAndAccounting420Test {
    VmPayAudit4 internal constant vm =
        VmPayAudit4(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant RECIPIENT_A = address(0xA001);
    address internal constant RECIPIENT_B = address(0xB002);
    address internal constant RECIPIENT_C = address(0xC003);
    bytes32 internal constant ASSET_ID = keccak256("CADC");
    bytes32 internal constant MARKET_ID = keccak256("420/CADC");
    bytes32 internal constant OPERATION = keccak256("420PAY/SPONSORED_PAYMENT");

    receive() external payable { }

    function _split()
        internal
        pure
        returns (address[] memory recipients, uint16[] memory bps)
    {
        recipients = new address[](3);
        recipients[0] = RECIPIENT_A;
        recipients[1] = RECIPIENT_B;
        recipients[2] = RECIPIENT_C;
        bps = new uint16[](3);
        bps[0] = 3333;
        bps[1] = 3333;
        bps[2] = 3334;
    }

    function _splitStack()
        internal
        returns (
            GenesisMockEnvironment420 env,
            PaymentRouter420 paymentRouter,
            SettlementRouter420 settlementRouter,
            CanonicalSettlementAdapter420 adapter,
            PayAudit4Token420 token,
            PayAudit4SwapExecutor420 executor
        )
    {
        env = new GenesisMockEnvironment420();
        paymentRouter = new PaymentRouter420(address(this), address(env.registry()), keccak256("pay-audit-4-router"));
        settlementRouter =
            new SettlementRouter420(address(this), address(env.registry()), keccak256("pay-audit-4-split"));
        executor = new PayAudit4SwapExecutor420();
        adapter = new CanonicalSettlementAdapter420(
            address(this), address(env.registry()), keccak256("pay-audit-4-adapter"), address(executor)
        );
        token = new PayAudit4Token420();

        env.registerResident(address(paymentRouter), paymentRouter.componentId());
        env.registerResident(address(settlementRouter), settlementRouter.componentId());
        env.registerResident(address(adapter), adapter.componentId());
        env.setSettlementAsset(address(token), ASSET_ID, true);
        env.health().setMarket(MARKET_ID, true);
        env.fees().set(0, 0, false);

        paymentRouter.setSettlementAdapter(address(adapter));
        paymentRouter.setSettlementRouter(address(settlementRouter));
        adapter.setPaymentRouter(address(paymentRouter));
        adapter.setSettlementRouter(address(settlementRouter));
        settlementRouter.setPaymentRouter(address(paymentRouter));
        settlementRouter.setSettlementAdapter(address(adapter));
    }

    function testDirectTokenSplitConservesValueAssignsRemainderAndRejectsReplay() public {
        (, PaymentRouter420 router, SettlementRouter420 settlement,, PayAudit4Token420 token,) = _splitStack();
        (address[] memory recipients, uint16[] memory bps) = _split();

        token.mint(ALICE, 101);
        vm.prank(ALICE);
        token.approve(address(settlement), 101);

        bytes32 paymentId = keccak256("direct-split");
        vm.prank(ALICE);
        router.executeDirectTokenSplitSettlement(
            paymentId, ALICE, address(token), 101, recipients, bps, 0
        );

        require(token.balanceOf(RECIPIENT_A) == 35, "primary remainder");
        require(token.balanceOf(RECIPIENT_B) == 33, "recipient b");
        require(token.balanceOf(RECIPIENT_C) == 33, "recipient c");
        require(token.balanceOf(address(settlement)) == 0, "router residue");

        vm.prank(ALICE);
        (bool replayOk,) = address(router).call(
            abi.encodeWithSelector(
                router.executeDirectTokenSplitSettlement.selector,
                paymentId,
                ALICE,
                address(token),
                101,
                recipients,
                bps,
                uint8(0)
            )
        );
        require(!replayOk, "split replay accepted");
    }

    function testDirectTokenSplitRequiresPayerCaller() public {
        (, PaymentRouter420 router, SettlementRouter420 settlement,, PayAudit4Token420 token,) = _splitStack();
        (address[] memory recipients, uint16[] memory bps) = _split();

        token.mint(ALICE, 100);
        vm.prank(ALICE);
        token.approve(address(settlement), 100);

        vm.prank(BOB);
        (bool ok,) = address(router).call(
            abi.encodeWithSelector(
                router.executeDirectTokenSplitSettlement.selector,
                keccak256("third-party-split"),
                ALICE,
                address(token),
                100,
                recipients,
                bps,
                uint8(0)
            )
        );
        require(!ok, "third party spent payer allowance");
        require(token.balanceOf(ALICE) == 100, "payer balance changed");
    }

    function testNativeSplitIsAtomicAndLeavesNoRouterResidue() public {
        (, PaymentRouter420 router, SettlementRouter420 settlement,,,,) = _splitStack();
        (address[] memory recipients, uint16[] memory bps) = _split();
        vm.deal(address(settlement), 7);
        vm.deal(ALICE, 101);

        vm.prank(ALICE);
        router.executeNativeSplitSettlement{value: 101}(
            keccak256("native-split"), ALICE, recipients, bps, 0
        );

        require(RECIPIENT_A.balance == 35, "native primary");
        require(RECIPIENT_B.balance == 33, "native b");
        require(RECIPIENT_C.balance == 33, "native c");
        require(address(settlement).balance == 7, "native new residue");
    }

    function testSwapBackedSplitRoutesThroughCanonicalAdapterAtomically() public {
        (
            ,
            PaymentRouter420 router,
            SettlementRouter420 settlement,
            ,
            PayAudit4Token420 token,
            PayAudit4SwapExecutor420 executor
        ) = _splitStack();
        (address[] memory recipients, uint16[] memory bps) = _split();
        token.mint(address(settlement), 7);
        token.mint(address(executor), 101);

        ICanonicalSettlement420.Quote memory q = ICanonicalSettlement420.Quote({
            quoteId: keccak256("split-quote"),
            marketId: MARKET_ID,
            inputAsset: address(0x420),
            settlementAsset: address(token),
            inputAmount: 110,
            minimumSettlementAmount: 101,
            quotedSettlementAmount: 101,
            conversionFee: 0,
            slippageBps: 0,
            quotedAt: uint64(block.timestamp)
        });
        PaymentRouter420.PayerLimits memory limits = PaymentRouter420.PayerLimits({
            maxInputAmount: 110,
            maxGasCost420: 0,
            maxSlippageBps: 0,
            maxTip: 0,
            maxConversionFee: 0,
            maxProtocolFee: 0,
            quoteTimestamp: q.quotedAt
        });

        vm.prank(ALICE);
        (, uint256 delivered) = router.executeSwapSplitSettlement(
            keccak256("swap-split"), q, ALICE, 101, recipients, bps, 0, limits, 0, 0
        );

        require(delivered == 101, "delivered");
        require(token.balanceOf(RECIPIENT_A) == 35, "swap primary");
        require(token.balanceOf(RECIPIENT_B) == 33, "swap b");
        require(token.balanceOf(RECIPIENT_C) == 33, "swap c");
        require(token.balanceOf(address(settlement)) == 7, "swap new residue");
    }

    function testRefundEvidenceCannotExceedCanonicalAuthorizedRefund() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        PaymentRegistry420 payments =
            new PaymentRegistry420(address(this), address(env.registry()), keccak256("pay-audit-4-payment"));
        RefundManager420 refunds =
            new RefundManager420(address(this), address(env.registry()), keccak256("pay-audit-4-refund"));
        PayAudit4Token420 token = new PayAudit4Token420();

        env.registerResident(address(payments), payments.componentId());
        env.registerResident(address(refunds), refunds.componentId());
        env.setSettlementAsset(address(token), ASSET_ID, true);
        refunds.setPaymentRegistry(address(payments));

        bytes32 invoiceId = keccak256("refund-invoice");
        bytes32 paymentId = payments.createPayment(
            invoiceId, address(this), BOB, address(0x420), 100, address(token), 84, keccak256("refund-quote"), 1
        );
        payments.recordFinalized(paymentId, invoiceId, keccak256("receipt"), address(token), 84, 6);
        payments.applyRefund(paymentId, 40, false);

        (bool inflatedMaximum,) = address(refunds).call(
            abi.encodeWithSelector(
                refunds.recordRefund.selector,
                keccak256("bad-max"),
                paymentId,
                address(token),
                address(this),
                40,
                91,
                bytes32(0)
            )
        );
        require(!inflatedMaximum, "caller selected refund maximum");

        refunds.recordRefund(
            keccak256("refund-1"), paymentId, address(token), address(this), 40, 90, bytes32(0)
        );
        require(refunds.refundedByPayment(paymentId) == 40, "authorized refund not recorded");

        (bool overAuthorized,) = address(refunds).call(
            abi.encodeWithSelector(
                refunds.recordRefund.selector,
                keccak256("refund-over"),
                paymentId,
                address(token),
                address(this),
                1,
                90,
                bytes32(0)
            )
        );
        require(!overAuthorized, "refund evidence exceeded authorized amount");

        payments.applyRefund(paymentId, 50, true);
        refunds.recordRefund(
            keccak256("refund-2"), paymentId, address(token), address(this), 50, 90, bytes32(0)
        );
        require(refunds.refundedByPayment(paymentId) == 90, "full refund reconciliation");
    }

    function testGasSponsorReimbursesOnlyAuthorizedRelayerAndPreservesReserve() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        GasSponsor420 sponsor =
            new GasSponsor420(address(this), address(env.registry()), keccak256("pay-audit-4-sponsor"));
        env.registerResident(address(sponsor), sponsor.componentId());
        sponsor.setOperation(OPERATION, true);
        sponsor.setRelayer(address(this), true);

        vm.deal(address(this), 2 ether);
        (bool funded,) = address(sponsor).call{value: 1 ether}("");
        require(funded, "funding");
        uint256 before = address(this).balance;

        sponsor.reimburseSponsored(ALICE, keccak256("merchant"), OPERATION, 210_000, 0.01 ether, true, false);
        require(address(this).balance == before + 0.01 ether, "relayer not reimbursed");
        require(sponsor.totalReimbursed() == 0.01 ether, "reimbursement accounting");
        require(address(sponsor).balance >= sponsor.reserveFloor(), "reserve breached");

        vm.prank(ALICE);
        (bool unauthorized,) = address(sponsor).call(
            abi.encodeWithSelector(
                sponsor.reimburseSponsored.selector,
                ALICE,
                keccak256("merchant-2"),
                OPERATION,
                100_000,
                0.001 ether,
                true,
                false
            )
        );
        require(!unauthorized, "unauthorized relayer reimbursed");
    }
}
