// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../libraries/AppDependencyIds420.sol";

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "../interfaces/genesis/IMetadataCommitment420.sol";
import "../libraries/GenesisInterfaceIds420.sol";
import "./PayIds420.sol";

contract InvoiceRegistry420 is GenesisResidentAccess420 {
    enum Mode { SINGLE_USE, MULTI_USE, PARTIAL_PAYMENT }
    enum Acceptance { FAST, FINALIZED, HIGH_VALUE }

    bytes32 public constant INVOICE_DOMAIN = keccak256("420/APP/420PAY_INVOICE");
    uint32 public constant PROTOCOL_VERSION = 1;

    struct Invoice {
        bytes32 merchantId;
        address merchant;
        bytes32 metadataHash;
        bytes3 currency;
        uint256 amount;
        uint64 expiresAt;
        uint64 refundUntil;
        Mode mode;
        Acceptance acceptance;
        bool partialPayments;
        uint16 quoteMaxSlippageBps;
        bytes32 acceptedAssetsHash;
        bytes32 settlementPlanHash;
        bytes32 tipPolicyHash;
        bool active;
    }

    // Deliberately non-public: Solidity 0.8.24 cannot code-generate the implicit
    // 15-field tuple getter for Invoice without exceeding the EVM stack limit.
    // Stable, purpose-specific read methods below expose the fields needed by
    // runtime consumers without widening the generated ABI surface.
    mapping(bytes32 => Invoice) private _invoices;
    mapping(bytes32 => uint256) public paidAmount;
    mapping(bytes32 => bool) public closed;

    event InvoiceCreated(
        bytes32 indexed invoiceId,
        bytes32 indexed merchantId,
        address indexed merchant,
        uint256 amount,
        Mode mode
    );
    event InvoiceClosed(bytes32 indexed invoiceId);

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) {
        return PayIds420.INVOICE_REGISTRY;
    }

    function invoiceSigningRoot(bytes32 invoiceId, Invoice memory i) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                INVOICE_DOMAIN,
                PROTOCOL_VERSION,
                invoiceId,
                i.merchantId,
                i.merchant,
                i.amount,
                i.currency,
                i.acceptedAssetsHash,
                i.settlementPlanHash,
                i.expiresAt,
                i.refundUntil,
                i.tipPolicyHash,
                i.quoteMaxSlippageBps,
                i.mode,
                i.acceptance
            )
        );
    }

    function createInvoice(bytes32 invoiceId, Invoice calldata i) external {
        _requireOperational(
            PayIds420.ACTION_CREATE_INVOICE,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.INBOUND
        );
        require(invoiceId != bytes32(0) && _invoices[invoiceId].merchant == address(0), "invalid/exists");
        require(i.merchant == msg.sender, "merchant");
        require(i.amount > 0 && i.expiresAt > block.timestamp, "amount/expiry");
        require(i.refundUntil >= i.expiresAt, "refund window");
        require(i.quoteMaxSlippageBps <= 42, "slippage cap");
        if (i.mode == Mode.SINGLE_USE) require(!i.partialPayments, "single use");

        if (i.metadataHash != bytes32(0)) {
            IMetadataCommitment420.MetadataCommitment memory metadata = IMetadataCommitment420(
                _resolveRequired(AppDependencyIds420.METADATA_COMMITMENT)
            ).metadataCommitment(invoiceId);
            require(metadata.contentHash == i.metadataHash, "metadata commitment");
        }

        _invoices[invoiceId] = i;
        _invoices[invoiceId].active = true;
        emit InvoiceCreated(invoiceId, i.merchantId, msg.sender, i.amount, i.mode);
    }

    function merchantOf(bytes32 invoiceId) external view returns (address) { return _invoices[invoiceId].merchant; }
    function amountOf(bytes32 invoiceId) external view returns (uint256) { return _invoices[invoiceId].amount; }
    function expiresAtOf(bytes32 invoiceId) external view returns (uint64) { return _invoices[invoiceId].expiresAt; }
    function isClosed(bytes32 invoiceId) external view returns (bool) { return closed[invoiceId]; }

    function markPaid(bytes32 invoiceId, uint256 amount) external {
        _requireGenesisGovernance(PayIds420.ACTION_MARK_PAID);
        _requireOperational(
            PayIds420.ACTION_MARK_PAID,
            ISystemSafety420.ActionClass.SAFE_WHEN_PAUSED,
            Types420.Direction.NONE
        );
        Invoice storage i = _invoices[invoiceId];
        require(i.active && !closed[invoiceId], "inactive");
        require(block.timestamp <= i.expiresAt, "expired");
        require(amount > 0, "amount");
        if (i.mode == Mode.SINGLE_USE) {
            require(paidAmount[invoiceId] == 0 && amount == i.amount, "single-use duplicate/amount");
            paidAmount[invoiceId] = amount;
            closed[invoiceId] = true;
        } else if (i.mode == Mode.PARTIAL_PAYMENT || i.partialPayments) {
            require(paidAmount[invoiceId] + amount <= i.amount, "overpay");
            paidAmount[invoiceId] += amount;
            if (paidAmount[invoiceId] == i.amount) closed[invoiceId] = true;
        } else {
            paidAmount[invoiceId] += amount;
        }
    }

    function close(bytes32 invoiceId) external {
        _requireOperational(
            PayIds420.ACTION_CREATE_INVOICE,
            ISystemSafety420.ActionClass.SAFE_WHEN_PAUSED,
            Types420.Direction.NONE
        );
        require(_invoices[invoiceId].merchant == msg.sender, "merchant");
        closed[invoiceId] = true;
        emit InvoiceClosed(invoiceId);
    }
}
