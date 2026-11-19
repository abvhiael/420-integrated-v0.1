// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./InvoiceRegistry420.sol";
import "./MerchantRegistry420.sol";
import "../interfaces/genesis/IFeeQuote420.sol";

/// @notice Canonical fixed-price source for native 420 invoice settlement.
contract CanonicalPayQuote420 is GenesisResidentAccess420, IFeeQuote420 {
    uint64 public constant QUOTE_LIFETIME = 42 seconds;
    bytes32 public immutable nativeAcceptedAssetsHash;

    struct NativeQuote {
        bytes32 quoteId;
        address merchant;
        address recipient;
        uint256 amount;
        uint64 expiresAt;
    }

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_, bytes32 acceptedAssetsHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {
        require(acceptedAssetsHash_ != bytes32(0), "native asset policy");
        nativeAcceptedAssetsHash = acceptedAssetsHash_;
    }

    function componentId() public pure override returns (bytes32) {
        return PayIds420.NATIVE_QUOTE_SOURCE;
    }

    function quoteNative(bytes32 invoiceId, address payer, uint256 payerNonce, uint64 quotedAt)
        public view returns (NativeQuote memory q)
    {
        _requireResidentActive();
        require(payer != address(0) && payerNonce != 0, "quote payer/nonce");
        require(quotedAt <= block.timestamp && block.timestamp - quotedAt <= QUOTE_LIFETIME, "quote expired");
        InvoiceRegistry420 invoices = InvoiceRegistry420(_resolveRequired(PayIds420.INVOICE_REGISTRY));
        InvoiceRegistry420.Invoice memory i = invoices.getInvoice(invoiceId);
        require(i.active && !invoices.isClosed(invoiceId) && block.timestamp <= i.expiresAt, "invoice unavailable");
        require(i.currency == bytes3("420") && i.acceptedAssetsHash == nativeAcceptedAssetsHash, "native asset");
        require(i.settlementPlanHash == bytes32(0) && i.tipPolicyHash == bytes32(0), "unsupported invoice policy");
        _canonicalSettlementAsset(address(0));

        MerchantRegistry420 merchants = MerchantRegistry420(_resolveRequired(PayIds420.MERCHANT_REGISTRY));
        (address controller,,,, bool active,) = merchants.merchants(i.merchantId);
        require(active && controller == i.merchant, "merchant");
        (address recipient, uint32 version, bytes32 planHash) = merchants.currentPayout(i.merchantId);
        require(recipient != address(0) && version != 0 && planHash == i.settlementPlanHash, "payout");

        uint256 amount = i.amount;
        if (i.mode == InvoiceRegistry420.Mode.PARTIAL_PAYMENT || i.partialPayments) {
            amount -= invoices.paidAmount(invoiceId);
        }
        require(amount > 0, "invoice fulfilled");
        uint64 expiresAt = i.expiresAt;
        uint256 deadline = uint256(quotedAt) + QUOTE_LIFETIME;
        if (deadline < expiresAt) expiresAt = uint64(deadline);
        bytes32 terms = keccak256(abi.encode(invoices.invoiceSigningRoot(invoiceId, i), recipient, version, amount));
        q = NativeQuote({
            quoteId: keccak256(abi.encode(address(this), block.chainid, terms, payer, payerNonce, quotedAt)),
            merchant: controller, recipient: recipient, amount: amount, expiresAt: expiresAt
        });
    }

    /// @dev Native quote fees are zero at the protocol layer. Wallet estimates transaction gas separately.
    function feeQuote(bytes32 contextId, bytes calldata request) external view returns (FeeQuote memory fee) {
        require(request.length == 128, "native fee request");
        (bytes32 invoiceId, address payer, uint256 payerNonce, uint64 quotedAt) =
            abi.decode(request, (bytes32, address, uint256, uint64));
        NativeQuote memory q = quoteNative(invoiceId, payer, payerNonce, quotedAt);
        require(contextId == q.quoteId, "quote changed");
        fee.quoteId = q.quoteId;
        fee.quotedAt = quotedAt;
        fee.expiresAt = q.expiresAt;
    }
}
