// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/InvoiceRegistry420.sol";
import "./helpers/GenesisMocks420.sol";

contract InvoiceRegistry420FuzzTest {
    function testFuzz_SingleUseCannotBeMarkedTwice(uint96 amount) public {
        if (amount == 0) return;
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        InvoiceRegistry420 r = new InvoiceRegistry420(address(this), address(env.registry()), keccak256("invoice-fuzz"));
        env.registerResident(address(r), r.componentId());
        InvoiceRegistry420.Invoice memory i = InvoiceRegistry420.Invoice({
            merchantId: bytes32(uint256(1)),
            merchant: address(this),
            metadataHash: bytes32(0),
            currency: bytes3("CAD"),
            amount: amount,
            expiresAt: uint64(block.timestamp + 1000),
            refundUntil: uint64(block.timestamp + 2000),
            mode: InvoiceRegistry420.Mode.SINGLE_USE,
            acceptance: InvoiceRegistry420.Acceptance.FINALIZED,
            partialPayments: false,
            quoteMaxSlippageBps: 42,
            acceptedAssetsHash: bytes32(uint256(2)),
            settlementPlanHash: bytes32(uint256(3)),
            tipPolicyHash: bytes32(uint256(4)),
            active: true
        });
        bytes32 id = keccak256(abi.encode(amount));
        r.createInvoice(id, i);
        r.markPaid(id, amount);
        (bool ok,) = address(r).call(abi.encodeWithSignature("markPaid(bytes32,uint256)", id, amount));
        require(!ok, "duplicate accepted");
    }

    function testFuzz_PartialNeverExceedsInvoice(uint96 total, uint96 first, uint96 second) public {
        if (total == 0) return;
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        InvoiceRegistry420 r = new InvoiceRegistry420(address(this), address(env.registry()), keccak256("invoice-partial"));
        env.registerResident(address(r), r.componentId());
        InvoiceRegistry420.Invoice memory i = InvoiceRegistry420.Invoice({
            merchantId: bytes32(uint256(1)), merchant: address(this), metadataHash: bytes32(0), currency: bytes3("CAD"),
            amount: total, expiresAt: uint64(block.timestamp + 1000), refundUntil: uint64(block.timestamp + 2000),
            mode: InvoiceRegistry420.Mode.PARTIAL_PAYMENT, acceptance: InvoiceRegistry420.Acceptance.FINALIZED,
            partialPayments: true, quoteMaxSlippageBps: 42, acceptedAssetsHash: bytes32(0), settlementPlanHash: bytes32(0),
            tipPolicyHash: bytes32(0), active: true
        });
        bytes32 id = keccak256(abi.encode(total, first, second));
        r.createInvoice(id, i);
        uint256 a = uint256(first) % (uint256(total) + 1);
        if (a > 0) r.markPaid(id, a);
        uint256 room = uint256(total) - a;
        uint256 b = room == type(uint256).max ? second : uint256(second) % (room + 1);
        if (b > 0) r.markPaid(id, b);
        require(r.paidAmount(id) <= total, "over invoice");
    }
}
