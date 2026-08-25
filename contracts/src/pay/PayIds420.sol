// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library PayIds420 {
    bytes32 internal constant INVOICE_REGISTRY = keccak256("420/APP/420PAY/INVOICE_REGISTRY");
    bytes32 internal constant PAYMENT_REGISTRY = keccak256("420/APP/420PAY/PAYMENT_REGISTRY");
    bytes32 internal constant MERCHANT_REGISTRY = keccak256("420/APP/420PAY/MERCHANT_REGISTRY");
    bytes32 internal constant PAYMENT_ROUTER = keccak256("420/APP/420PAY/PAYMENT_ROUTER");
    bytes32 internal constant SETTLEMENT_ROUTER = keccak256("420/APP/420PAY/SETTLEMENT_ROUTER");
    bytes32 internal constant REFUND_MANAGER = keccak256("420/APP/420PAY/REFUND_MANAGER");
    bytes32 internal constant GAS_SPONSOR = keccak256("420/APP/420PAY/GAS_SPONSOR");
    bytes32 internal constant SETTLEMENT_ADAPTER = keccak256("420/APP/420PAY/SETTLEMENT_ADAPTER");
    bytes32 internal constant SWAP_HEALTH_ADAPTER = keccak256("420/APP/420PAY/SWAP_HEALTH_ADAPTER");

    bytes32 internal constant ACTION_CONFIGURE = keccak256("420/PAY/ACTION/CONFIGURE");
    bytes32 internal constant ACTION_CREATE_INVOICE = keccak256("420/PAY/ACTION/CREATE_INVOICE");
    bytes32 internal constant ACTION_MARK_PAID = keccak256("420/PAY/ACTION/MARK_PAID");
    bytes32 internal constant ACTION_SETTLE = keccak256("420/PAY/ACTION/SETTLE");
    bytes32 internal constant ACTION_REFUND = keccak256("420/PAY/ACTION/REFUND");
    bytes32 internal constant ACTION_SPONSOR = keccak256("420/PAY/ACTION/SPONSOR");
}
