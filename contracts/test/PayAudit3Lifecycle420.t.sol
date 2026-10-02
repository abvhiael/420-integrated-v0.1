// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/InvoiceRegistry420.sol";
import "../src/pay/PaymentRegistry420.sol";
import "./helpers/GenesisMocks420.sol";

interface VmPayAudit3 {
    function prank(
        address
    ) external;
}

contract PayAudit3Lifecycle420Test {
    VmPayAudit3 internal constant vm = VmPayAudit3(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant SETTLEMENT = address(0xCA420);
    bytes32 internal constant ASSET_ID = keccak256("CADC");

    function _paymentRegistry() internal returns (GenesisMockEnvironment420 env, PaymentRegistry420 payments) {
        env = new GenesisMockEnvironment420();
        payments = new PaymentRegistry420(address(this), address(env.registry()), keccak256("pay-audit-3"));
        env.registerResident(address(payments), payments.componentId());
        env.setSettlementAsset(SETTLEMENT, ASSET_ID, true);
    }

    function _create(
        PaymentRegistry420 payments,
        uint256 nonce
    ) internal returns (bytes32) {
        return payments.createPayment(
            keccak256(abi.encode("invoice", nonce)),
            ALICE,
            BOB,
            address(0x420),
            100,
            SETTLEMENT,
            84,
            keccak256(abi.encode("quote", nonce)),
            nonce
        );
    }

    function _invoice(
        address merchant
    ) internal view returns (InvoiceRegistry420.Invoice memory i) {
        i = InvoiceRegistry420.Invoice({
            merchantId: keccak256(abi.encode(merchant)),
            merchant: merchant,
            metadataHash: bytes32(0),
            currency: bytes3("CAD"),
            amount: 100,
            expiresAt: uint64(block.timestamp + 1000),
            refundUntil: uint64(block.timestamp + 2000),
            mode: InvoiceRegistry420.Mode.SINGLE_USE,
            acceptance: InvoiceRegistry420.Acceptance.FINALIZED,
            partialPayments: false,
            quoteMaxSlippageBps: 42,
            acceptedAssetsHash: keccak256("CADC"),
            settlementPlanHash: keccak256("settlement"),
            tipPolicyHash: keccak256("tips"),
            active: true
        });
    }

    function testLifecycleSequentialPathReachesEveryNonRefundTerminalState() public {
        (, PaymentRegistry420 payments) = _paymentRegistry();
        bytes32 paymentId = _create(payments, 1);

        payments.recordIncluded(paymentId);
        (,,,,,,,,,,,, PaymentRegistry420.Status included) = payments.payments(paymentId);
        require(included == PaymentRegistry420.Status.INCLUDED, "included");

        payments.recordCertified(paymentId);
        (,,,,,,,,,,,, PaymentRegistry420.Status certified) = payments.payments(paymentId);
        require(certified == PaymentRegistry420.Status.CERTIFIED, "certified");

        bytes32 invoiceId = keccak256(abi.encode("invoice", uint256(1)));
        payments.recordFinalized(paymentId, invoiceId, keccak256("receipt"), SETTLEMENT, 84, 6);
        (,,,,,,,,,,,, PaymentRegistry420.Status finalized) = payments.payments(paymentId);
        require(finalized == PaymentRegistry420.Status.FINALIZED, "finalized");

        payments.recordSettled(paymentId);
        (,,,,,,,,,,,, PaymentRegistry420.Status settled) = payments.payments(paymentId);
        require(settled == PaymentRegistry420.Status.SETTLED, "settled");

        payments.applyRefund(paymentId, 40, false);
        (,,,,,,,,,,, uint256 refunded, PaymentRegistry420.Status partialStatus) = payments.payments(paymentId);
        require(refunded == 40, "partial amount");
        require(partialStatus == PaymentRegistry420.Status.PARTIALLY_REFUNDED, "partial status");

        payments.applyRefund(paymentId, 50, true);
        (,,,,,,,,,,, uint256 fullyRefunded, PaymentRegistry420.Status refundedStatus) = payments.payments(paymentId);
        require(fullyRefunded == 90, "full amount");
        require(refundedStatus == PaymentRegistry420.Status.REFUNDED, "refunded");
    }

    function testLifecycleRejectsInvalidPredecessorsAndTerminalResurrection() public {
        (, PaymentRegistry420 payments) = _paymentRegistry();
        bytes32 paymentId = _create(payments, 2);

        (bool certifyEarly,) =
            address(payments).call(abi.encodeWithSelector(payments.recordCertified.selector, paymentId));
        require(!certifyEarly, "certified before inclusion");

        (bool settleEarly,) = address(payments).call(abi.encodeWithSelector(payments.recordSettled.selector, paymentId));
        require(!settleEarly, "settled before finalization");

        payments.recordFailed(paymentId);
        (,,,,,,,,,,,, PaymentRegistry420.Status failed) = payments.payments(paymentId);
        require(failed == PaymentRegistry420.Status.FAILED, "failed");

        (bool includeAfterFailure,) =
            address(payments).call(abi.encodeWithSelector(payments.recordIncluded.selector, paymentId));
        require(!includeAfterFailure, "failed payment resurrected");

        bytes32 invoiceId = keccak256(abi.encode("invoice", uint256(2)));
        (bool finalizeAfterFailure,) = address(payments)
            .call(
                abi.encodeWithSelector(
                    payments.recordFinalized.selector, paymentId, invoiceId, keccak256("receipt"), SETTLEMENT, 84, 0
                )
            );
        require(!finalizeAfterFailure, "failed payment finalized");
    }

    function testLifecycleMutationRequiresGenesisGovernance() public {
        (GenesisMockEnvironment420 env, PaymentRegistry420 payments) = _paymentRegistry();
        bytes32 paymentId = _create(payments, 3);
        env.governance().set(false, false);

        vm.prank(ALICE);
        (bool included,) = address(payments).call(abi.encodeWithSelector(payments.recordIncluded.selector, paymentId));
        require(!included, "payer mutated canonical lifecycle");
    }

    function testOfflineInvoiceRootDoesNotGrantCanonicalCreationAuthority() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        InvoiceRegistry420 invoices =
            new InvoiceRegistry420(address(this), address(env.registry()), keccak256("pay-audit-3-invoice"));
        env.registerResident(address(invoices), invoices.componentId());

        InvoiceRegistry420.Invoice memory invoice = _invoice(ALICE);
        bytes32 invoiceId = keccak256("offline-invoice");
        bytes32 root = invoices.invoiceSigningRoot(invoiceId, invoice);
        require(root != bytes32(0), "signing root");

        vm.prank(BOB);
        (bool thirdPartyAccepted,) =
            address(invoices).call(abi.encodeWithSelector(invoices.createInvoice.selector, invoiceId, invoice));
        require(!thirdPartyAccepted, "offline root manufactured state authority");

        vm.prank(ALICE);
        invoices.createInvoice(invoiceId, invoice);
        require(invoices.merchantOf(invoiceId) == ALICE, "merchant online acceptance failed");
    }
}
