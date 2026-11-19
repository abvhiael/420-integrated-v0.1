// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./InvoiceRegistry420.sol";
import "./MerchantRegistry420.sol";
import "./SettlementRouter420.sol";
import "../interfaces/genesis/IFeeQuote420.sol";
import "../interfaces/ICanonicalSettlement420.sol";
import "../swap/SwapIds420.sol";

interface IPayMarketRegistry420 {
    function markets(bytes32 marketId) external view returns (address, address, address, uint8, bytes32, bool);
}
interface IPaySwapPool420 {
    function quoteCanonicalSwap(address input, address output, uint256 amount) external view returns (uint256, uint256);
    function feeBps() external view returns (uint16);
}

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

    struct NativePolicy {
        address[] recipients;
        uint16[] bps;
        uint8 primary;
        address tipRecipient;
        uint256 tipMaximum;
        uint256 tip;
    }

    struct ConversionRequest {
        bytes32 invoiceId;
        address payer;
        uint256 payerNonce;
        uint64 quotedAt;
        bytes32 marketId;
        address inputAsset;
        address settlementAsset;
        uint256 maxInput;
        uint256 minOutput;
    }

    struct InvoiceTerms {
        bytes32 root;
        address merchant;
        address recipient;
        uint256 amount;
        uint64 expiresAt;
        bytes3 currency;
        bytes32 assetPolicy;
        uint16 maxSlippageBps;
        bytes32 settlementPlan;
        bytes32 tipPolicy;
    }

    struct ConversionQuote {
        ICanonicalSettlement420.Quote swap;
        address merchant;
        address recipient;
        uint256 invoiceAmount;
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
        InvoiceTerms memory i = _invoiceTerms(invoiceId, payer, payerNonce, quotedAt);
        require(i.settlementPlan == bytes32(0) && i.tipPolicy == bytes32(0), "unsupported invoice policy");
        require(i.currency == bytes3("420") && i.assetPolicy == nativeAcceptedAssetsHash, "native asset");
        _canonicalSettlementAsset(address(0));
        q = NativeQuote({
            quoteId: keccak256(abi.encode(address(this), block.chainid, i.root, payer, payerNonce, quotedAt)),
            merchant: i.merchant, recipient: i.recipient, amount: i.amount, expiresAt: i.expiresAt
        });
    }

    function splitCommitment(address[] calldata recipients, uint16[] calldata bps, uint8 primary)
        public pure returns (bytes32)
    {
        return keccak256(abi.encode(keccak256("420/PAY/SPLIT/V1"), recipients, bps, primary));
    }

    function tipCommitment(address recipient, uint256 maximum) public pure returns (bytes32) {
        return keccak256(abi.encode(keccak256("420/PAY/TIP/V1"), recipient, maximum));
    }

    function quoteNativePolicy(
        bytes32 invoiceId, address payer, uint256 payerNonce, uint64 quotedAt, NativePolicy calldata policy
    ) public view returns (NativeQuote memory q) {
        InvoiceTerms memory i = _invoiceTerms(invoiceId, payer, payerNonce, quotedAt);
        require(i.currency == bytes3("420") && i.assetPolicy == nativeAcceptedAssetsHash, "native asset");
        _canonicalSettlementAsset(address(0));
        SettlementRouter420(_resolveRequired(PayIds420.SETTLEMENT_ROUTER))
            .validateSplit(policy.recipients, policy.bps, policy.primary);
        require(policy.recipients[policy.primary] == i.recipient, "primary payout");
        if (i.settlementPlan == bytes32(0)) require(policy.recipients.length == 1, "unexpected split");
        else require(i.settlementPlan == splitCommitment(policy.recipients, policy.bps, policy.primary), "split plan");
        if (i.tipPolicy == bytes32(0)) {
            require(policy.tipRecipient == address(0) && policy.tipMaximum == 0 && policy.tip == 0, "unexpected tip");
        } else {
            require(policy.tipRecipient != address(0) && policy.tipMaximum > 0 && policy.tip <= policy.tipMaximum
                && i.tipPolicy == tipCommitment(policy.tipRecipient, policy.tipMaximum), "tip policy");
        }
        require(policy.tip <= type(uint256).max - i.amount, "total overflow");
        q = NativeQuote(
            keccak256(abi.encode(address(this), block.chainid, i.root, payer, payerNonce, quotedAt, policy)),
            i.merchant, i.recipient, i.amount, i.expiresAt
        );
    }

    function conversionAssetCommitment(bytes32 marketId, address input, address settlement)
        public pure returns (bytes32)
    {
        return keccak256(abi.encode(keccak256("420/PAY/CONVERSION_ASSETS/V1"), marketId, input, settlement));
    }

    function quoteConversion(ConversionRequest memory r) public view returns (ConversionQuote memory q) {
        InvoiceTerms memory i = _invoiceTerms(r.invoiceId, r.payer, r.payerNonce, r.quotedAt);
        require(i.settlementPlan == bytes32(0) && i.tipPolicy == bytes32(0), "unsupported invoice policy");
        require(r.inputAsset != address(0) && r.settlementAsset != address(0) && r.inputAsset != r.settlementAsset,
            "conversion pair");
        require(i.assetPolicy == conversionAssetCommitment(r.marketId, r.inputAsset, r.settlementAsset),
            "invoice asset policy");
        _canonicalSettlementAsset(r.inputAsset);
        bytes32 assetId = _canonicalSettlementAsset(r.settlementAsset);
        ICanonicalAssetRegistry420 assets =
            ICanonicalAssetRegistry420(_resolveRequired(GenesisInterfaceIds420.CANONICAL_ASSET_REGISTRY));
        require(assets.asset(assetId).currency == i.currency, "settlement denomination");
        _requireHealthyMarket(r.marketId);
        (address pool, address asset0, address asset1,,, bool active) =
            IPayMarketRegistry420(_resolveRequired(SwapIds420.CANONICAL_MARKET_REGISTRY)).markets(r.marketId);
        require(active && pool.code.length != 0 && ((asset0 == r.inputAsset && asset1 == r.settlementAsset)
            || (asset1 == r.inputAsset && asset0 == r.settlementAsset)), "canonical market");
        require(r.maxInput > 0 && r.minOutput >= i.amount, "conversion bounds");
        (uint256 output, uint256 impact) =
            IPaySwapPool420(pool).quoteCanonicalSwap(r.inputAsset, r.settlementAsset, r.maxInput);
        require(output >= r.minOutput && impact <= i.maxSlippageBps, "conversion price");
        uint256 fee = r.maxInput * IPaySwapPool420(pool).feeBps() / 10_000;
        q.swap = ICanonicalSettlement420.Quote({
            quoteId: keccak256(abi.encode(address(this), block.chainid, i.root, pool, pool.codehash, r, output, impact, fee)),
            marketId: r.marketId, inputAsset: r.inputAsset, settlementAsset: r.settlementAsset,
            inputAmount: r.maxInput, minimumSettlementAmount: r.minOutput, quotedSettlementAmount: output,
            conversionFee: fee, slippageBps: uint16(impact), quotedAt: r.quotedAt
        });
        q.merchant = i.merchant;
        q.recipient = i.recipient;
        q.invoiceAmount = i.amount;
        q.expiresAt = i.expiresAt;
    }

    function _invoiceTerms(bytes32 invoiceId, address payer, uint256 payerNonce, uint64 quotedAt)
        private view returns (InvoiceTerms memory terms)
    {
        _requireResidentActive();
        require(payer != address(0) && payerNonce != 0, "quote payer/nonce");
        require(quotedAt <= block.timestamp && block.timestamp - quotedAt <= QUOTE_LIFETIME, "quote expired");
        InvoiceRegistry420 invoices = InvoiceRegistry420(_resolveRequired(PayIds420.INVOICE_REGISTRY));
        InvoiceRegistry420.Invoice memory i = invoices.getInvoice(invoiceId);
        require(i.active && !invoices.isClosed(invoiceId) && block.timestamp <= i.expiresAt, "invoice unavailable");
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
        uint256 deadline = uint256(quotedAt) + QUOTE_LIFETIME;
        terms = InvoiceTerms({
            root: keccak256(abi.encode(invoices.invoiceSigningRoot(invoiceId, i), recipient, version, amount)),
            merchant: controller, recipient: recipient, amount: amount,
            expiresAt: deadline < i.expiresAt ? uint64(deadline) : i.expiresAt,
            currency: i.currency, assetPolicy: i.acceptedAssetsHash, maxSlippageBps: i.quoteMaxSlippageBps,
            settlementPlan: i.settlementPlanHash, tipPolicy: i.tipPolicyHash
        });
    }

    /// @dev Native quote fees are zero at the protocol layer. Wallet estimates transaction gas separately.
    function feeQuote(bytes32 contextId, bytes calldata request) external view returns (FeeQuote memory fee) {
        if (request.length == 288) {
            ConversionQuote memory conversion = quoteConversion(abi.decode(request, (ConversionRequest)));
            require(contextId == conversion.swap.quoteId, "quote changed");
            fee.quoteId = contextId;
            fee.conversionFee = conversion.swap.conversionFee;
            fee.quotedAt = conversion.swap.quotedAt;
            fee.expiresAt = conversion.expiresAt;
            return fee;
        }
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
