// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/InvoiceRegistry420.sol";
import "./helpers/GenesisMocks420.sol";

interface VmInvoiceBuilder420 {
    function prank(address) external;
}

contract PayMerchantInvoiceBuilder420Test {
    VmInvoiceBuilder420 private constant vm =
        VmInvoiceBuilder420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant CONTROLLER = address(0x4201);
    address private constant OUTSIDER = address(0x4202);
    bytes32 private constant TENANT = keccak256("merchant");
    bytes32 private constant ID = keccak256("invoice");
    InvoiceRegistry420 private invoices;
    MerchantRegistry420 private merchants;

    function setUp() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        bytes32 config = keccak256("invoice builder qualification");
        invoices = new InvoiceRegistry420(address(this), address(env.registry()), config);
        merchants = new MerchantRegistry420(address(this), address(env.registry()), config);
        env.registerResident(address(invoices), invoices.componentId());
        env.registerResident(address(merchants), merchants.componentId());
        vm.prank(CONTROLLER);
        merchants.registerForController(TENANT, CONTROLLER, CONTROLLER);
    }

    function _terms() private view returns (InvoiceRegistry420.Invoice memory terms) {
        terms = InvoiceRegistry420.Invoice({
            merchantId:TENANT, merchant:CONTROLLER, metadataHash:bytes32(0), currency:bytes3("420"),
            amount:100, expiresAt:uint64(block.timestamp + 60), refundUntil:uint64(block.timestamp + 120),
            mode:InvoiceRegistry420.Mode.PARTIAL_PAYMENT, acceptance:InvoiceRegistry420.Acceptance.FINALIZED,
            partialPayments:true, quoteMaxSlippageBps:42, acceptedAssetsHash:keccak256("native"),
            settlementPlanHash:bytes32(0), tipPolicyHash:keccak256("tip policy"), active:true
        });
    }

    function testControllerPublicationPreservesTermsAndLifecycle() public {
        InvoiceRegistry420.Invoice memory terms = _terms();
        vm.prank(CONTROLLER);
        invoices.createMerchantInvoice(ID, terms);
        InvoiceRegistry420.Invoice memory live = invoices.getInvoice(ID);
        require(live.merchantId == TENANT && live.tipPolicyHash == terms.tipPolicyHash && live.partialPayments);
        vm.prank(CONTROLLER);
        (bool duplicate,) = address(invoices).call(abi.encodeCall(invoices.createMerchantInvoice, (ID, terms)));
        require(!duplicate);
        invoices.markPaid(ID, 40);
        require(!invoices.closed(ID) && invoices.paidAmount(ID) == 40);
        vm.prank(CONTROLLER);
        invoices.close(ID);
        require(invoices.closed(ID));
    }

    function testTenantAndInactiveControllersCannotPublish() public {
        InvoiceRegistry420.Invoice memory terms = _terms();
        terms.merchant = OUTSIDER;
        vm.prank(OUTSIDER);
        (bool wrongController,) = address(invoices).call(abi.encodeCall(invoices.createMerchantInvoice, (ID, terms)));
        require(!wrongController);
        merchants.setStatus(TENANT, MerchantRegistry420.Status.REGISTERED, false);
        terms.merchant = CONTROLLER;
        vm.prank(CONTROLLER);
        (bool inactive,) = address(invoices).call(abi.encodeCall(invoices.createMerchantInvoice, (ID, terms)));
        require(!inactive && invoices.merchantOf(ID) == address(0));
    }
}
