// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../libraries/AppDependencyIds420.sol";
import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "../interfaces/genesis/Errors420.sol";
import "../interfaces/ICanonicalSettlement420.sol";
import "../interfaces/genesis/IFeeQuote420.sol";
import "../interfaces/genesis/IReplayProtection420.sol";
import "../interfaces/genesis/IReplayConsumer420.sol";
import "./PayIds420.sol";
import "./ReplayDomainIds420.sol";
import "./SettlementRouter420.sol";
import "./CanonicalPayQuote420.sol";
import "./PaymentRegistry420.sol";

interface ICanonicalSplitSettlement420 {
    function executeSplit(
        ICanonicalSettlement420.Quote calldata q,
        address payer,
        bytes32 paymentId,
        uint256 exactSettlementAmount,
        address[] calldata recipients,
        uint16[] calldata bps,
        uint8 primaryIndex
    ) external payable returns (uint256 inputSpent, uint256 settlementDelivered);
}

contract PaymentRouter420 is GenesisResidentAccess420 {
    uint64 public constant QUOTE_LIFETIME = 42 seconds;
    uint256 public constant DEFAULT_MAX_SLIPPAGE_BPS = 42;
    uint256 public constant PROTOCOL_FEE_BPS = 0;

    struct PayerLimits {
        uint256 maxInputAmount;
        uint256 maxGasCost420;
        uint16 maxSlippageBps;
        uint256 maxTip;
        uint256 maxConversionFee;
        uint256 maxProtocolFee;
        uint64 quoteTimestamp;
    }

    address public settlementAdapter;
    address public settlementRouter;
    mapping(bytes32 => bool) public consumedPaymentAuthorization;

    mapping(address => mapping(uint256 => bool)) public usedCheckoutNonces;
    bool private checkoutEntered;

    event SettlementAdapterSet(address indexed adapter);
    event SettlementRouterSet(address indexed router);
    event PaymentAuthorized(
        bytes32 indexed paymentId, address indexed payer, uint256 inputSpent, uint256 settlementDelivered
    );

    constructor(
        address timelock_,
        address registry_,
        bytes32 genesisConfigHash_
    ) GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_) { }

    function componentId() public pure override returns (bytes32) {
        return PayIds420.PAYMENT_ROUTER;
    }

    function setSettlementAdapter(
        address adapter
    ) external {
        _requireGenesisGovernance(PayIds420.ACTION_CONFIGURE);
        require(adapter != address(0) && adapter.code.length != 0, "adapter");
        settlementAdapter = adapter;
        emit SettlementAdapterSet(adapter);
    }

    function setSettlementRouter(
        address router
    ) external {
        _requireGenesisGovernance(PayIds420.ACTION_CONFIGURE);
        require(router != address(0) && router.code.length != 0, "settlement router");
        settlementRouter = router;
        emit SettlementRouterSet(router);
    }

    function validateLimits(
        PayerLimits calldata limits,
        uint256 inputAmount,
        uint256 gasCost420,
        uint256 slippageBps,
        uint256 tip,
        uint256 conversionFee,
        uint256 protocolFee
    ) public view returns (bool) {
        require(block.timestamp <= uint256(limits.quoteTimestamp) + QUOTE_LIFETIME, "stale quote");
        require(inputAmount <= limits.maxInputAmount, "input overspend");
        require(gasCost420 <= limits.maxGasCost420, "gas overspend");
        require(slippageBps <= limits.maxSlippageBps && limits.maxSlippageBps <= DEFAULT_MAX_SLIPPAGE_BPS, "slippage");
        require(tip <= limits.maxTip, "tip overspend");
        require(conversionFee <= limits.maxConversionFee, "conversion fee");
        require(protocolFee <= limits.maxProtocolFee && protocolFee == 0, "protocol fee");
        return true;
    }

    function requireSettlementHealth(
        address asset,
        bytes32 marketId,
        bool conversionRequired
    ) public view {
        _canonicalSettlementAsset(asset);
        if (conversionRequired) _requireHealthyMarket(marketId);
    }

    /// @notice Deliver a reviewed native invoice and commit invoice and payment state in the same transaction.
    function payNativeInvoice(bytes32 invoiceId, uint256 payerNonce, uint64 quotedAt, bytes32 expectedQuoteId)
        external payable returns (bytes32 paymentId)
    {
        require(!checkoutEntered, "checkout reentrancy");
        checkoutEntered = true;
        _requireOperational(
            PayIds420.ACTION_SETTLE, ISystemSafety420.ActionClass.NORMAL_ONLY, Types420.Direction.OUTBOUND
        );
        require(!usedCheckoutNonces[msg.sender][payerNonce], "checkout nonce used");
        CanonicalPayQuote420 quoteSource = CanonicalPayQuote420(_resolveRequired(PayIds420.NATIVE_QUOTE_SOURCE));
        CanonicalPayQuote420.NativeQuote memory q = quoteSource.quoteNative(invoiceId, msg.sender, payerNonce, quotedAt);
        require(q.quoteId == expectedQuoteId && msg.value == q.amount, "checkout quote changed");
        require(settlementRouter == _resolveRequired(PayIds420.SETTLEMENT_ROUTER), "settlement router");
        usedCheckoutNonces[msg.sender][payerNonce] = true;
        InvoiceRegistry420(_resolveRequired(PayIds420.INVOICE_REGISTRY)).applyCheckoutPayment(invoiceId, q.amount);
        PaymentRegistry420 payments = PaymentRegistry420(_resolveRequired(PayIds420.PAYMENT_REGISTRY));
        paymentId = payments.derivePaymentId(invoiceId, msg.sender, q.merchant, address(0), q.amount,
            address(0), q.amount, q.quoteId, payerNonce);
        _consumePaymentAuthorization(paymentId);
        address[] memory recipients = new address[](1);
        recipients[0] = q.recipient;
        uint16[] memory bps = new uint16[](1);
        bps[0] = 10_000;
        SettlementRouter420(settlementRouter).executeNativeSplit{value: msg.value}(paymentId, q.amount, recipients, bps, 0);
        require(payments.recordInvoiceCheckout(invoiceId, msg.sender, q.merchant, address(0), q.amount,
            address(0), q.amount, q.quoteId, payerNonce)
            == paymentId, "checkout payment identity");
        emit PaymentAuthorized(paymentId, msg.sender, q.amount, q.amount);
        checkoutEntered = false;
    }

    function payNativeInvoiceWithPolicy(
        bytes32 invoiceId, uint256 payerNonce, uint64 quotedAt, bytes32 expectedQuoteId,
        CanonicalPayQuote420.NativePolicy calldata policy
    ) external payable returns (bytes32 paymentId) {
        require(!checkoutEntered, "checkout reentrancy");
        checkoutEntered = true;
        _requireOperational(PayIds420.ACTION_SETTLE, ISystemSafety420.ActionClass.NORMAL_ONLY, Types420.Direction.OUTBOUND);
        require(!usedCheckoutNonces[msg.sender][payerNonce], "checkout nonce used");
        CanonicalPayQuote420.NativeQuote memory q = CanonicalPayQuote420(_resolveRequired(PayIds420.NATIVE_QUOTE_SOURCE))
            .quoteNativePolicy(invoiceId, msg.sender, payerNonce, quotedAt, policy);
        require(q.quoteId == expectedQuoteId && msg.value == q.amount + policy.tip, "checkout quote changed");
        require(settlementRouter == _resolveRequired(PayIds420.SETTLEMENT_ROUTER), "settlement router");
        usedCheckoutNonces[msg.sender][payerNonce] = true;
        InvoiceRegistry420(_resolveRequired(PayIds420.INVOICE_REGISTRY)).applyCheckoutPayment(invoiceId, q.amount);
        PaymentRegistry420 payments = PaymentRegistry420(_resolveRequired(PayIds420.PAYMENT_REGISTRY));
        paymentId = payments.derivePaymentId(invoiceId, msg.sender, q.merchant, address(0), msg.value,
            address(0), q.amount, q.quoteId, payerNonce);
        _consumePaymentAuthorization(paymentId);
        SettlementRouter420(settlementRouter).executeNativeSplit{value: q.amount}(
            paymentId, q.amount, policy.recipients, policy.bps, policy.primary
        );
        if (policy.tip != 0) {
            address[] memory recipients = new address[](1);
            recipients[0] = policy.tipRecipient;
            uint16[] memory bps = new uint16[](1);
            bps[0] = 10_000;
            SettlementRouter420(settlementRouter).executeNativeSplit{value: policy.tip}(
                keccak256(abi.encode(keccak256("420/PAY/TIP_DELIVERY/V1"), paymentId)), policy.tip, recipients, bps, 0
            );
        }
        require(payments.recordNativeCheckoutWithTip(invoiceId, msg.sender, q.merchant, q.amount, policy.tip,
            q.quoteId, payerNonce) == paymentId, "checkout payment identity");
        emit PaymentAuthorized(paymentId, msg.sender, msg.value, q.amount);
        checkoutEntered = false;
    }

    function payConvertedInvoice(CanonicalPayQuote420.ConversionRequest calldata r, bytes32 expectedQuoteId)
        external returns (bytes32 paymentId)
    {
        require(!checkoutEntered, "checkout reentrancy");
        checkoutEntered = true;
        _requireOperational(PayIds420.ACTION_SETTLE, ISystemSafety420.ActionClass.NORMAL_ONLY, Types420.Direction.OUTBOUND);
        require(msg.sender == r.payer && !usedCheckoutNonces[msg.sender][r.payerNonce], "checkout payer/nonce");
        require(settlementAdapter == _resolveRequired(PayIds420.SETTLEMENT_ADAPTER), "settlement adapter");
        CanonicalPayQuote420 source = CanonicalPayQuote420(_resolveRequired(PayIds420.NATIVE_QUOTE_SOURCE));
        CanonicalPayQuote420.ConversionQuote memory q = source.quoteConversion(r);
        require(q.swap.quoteId == expectedQuoteId, "checkout quote changed");
        usedCheckoutNonces[msg.sender][r.payerNonce] = true;
        InvoiceRegistry420(_resolveRequired(PayIds420.INVOICE_REGISTRY)).applyCheckoutPayment(r.invoiceId, q.invoiceAmount);
        PaymentRegistry420 payments = PaymentRegistry420(_resolveRequired(PayIds420.PAYMENT_REGISTRY));
        paymentId = payments.derivePaymentId(r.invoiceId, msg.sender, q.merchant, r.inputAsset, r.maxInput,
            r.settlementAsset, q.swap.quotedSettlementAmount, q.swap.quoteId, r.payerNonce);
        _consumePaymentAuthorization(paymentId);
        (uint256 spent, uint256 delivered) = ICanonicalSettlement420(settlementAdapter)
            .execute(q.swap, msg.sender, q.recipient, r.minOutput);
        require(spent == r.maxInput && delivered == q.swap.quotedSettlementAmount, "conversion execution changed");
        require(payments.recordInvoiceCheckout(r.invoiceId, msg.sender, q.merchant, r.inputAsset, spent,
            r.settlementAsset, delivered, q.swap.quoteId, r.payerNonce) == paymentId, "checkout payment identity");
        emit PaymentAuthorized(paymentId, msg.sender, spent, delivered);
        checkoutEntered = false;
    }

    function executeSwapSettlement(
        bytes32 paymentId,
        ICanonicalSettlement420.Quote calldata q,
        address payer,
        address recipient,
        uint256 invoiceSettlementAmount,
        PayerLimits calldata limits,
        uint256 gasCost420,
        uint256 tip
    ) external payable returns (uint256 inputSpent, uint256 delivered) {
        require(recipient != address(0), "recipient");
        _authorizeSwap(paymentId, q, payer, invoiceSettlementAmount, limits, gasCost420, tip);
        (inputSpent, delivered) = ICanonicalSettlement420(settlementAdapter).execute{ value: msg.value }(
            q, payer, recipient, invoiceSettlementAmount
        );
        require(inputSpent <= limits.maxInputAmount, "post input overspend");
        require(delivered >= invoiceSettlementAmount, "merchant underpaid");
        emit PaymentAuthorized(paymentId, payer, inputSpent, delivered);
    }

    function executeSwapSplitSettlement(
        bytes32 paymentId,
        ICanonicalSettlement420.Quote calldata q,
        address payer,
        uint256 invoiceSettlementAmount,
        address[] calldata recipients,
        uint16[] calldata bps,
        uint8 primaryIndex,
        PayerLimits calldata limits,
        uint256 gasCost420,
        uint256 tip
    ) external payable returns (uint256 inputSpent, uint256 delivered) {
        require(settlementRouter != address(0) && settlementRouter.code.length != 0, "settlement router");
        _authorizeSwap(paymentId, q, payer, invoiceSettlementAmount, limits, gasCost420, tip);
        (inputSpent, delivered) = ICanonicalSplitSettlement420(settlementAdapter).executeSplit{ value: msg.value }(
            q, payer, paymentId, invoiceSettlementAmount, recipients, bps, primaryIndex
        );
        require(inputSpent <= limits.maxInputAmount, "post input overspend");
        require(delivered >= invoiceSettlementAmount, "merchant underpaid");
        emit PaymentAuthorized(paymentId, payer, inputSpent, delivered);
    }

    function executeDirectTokenSplitSettlement(
        bytes32 paymentId,
        address payer,
        address settlementAsset,
        uint256 amount,
        address[] calldata recipients,
        uint16[] calldata bps,
        uint8 primaryIndex
    ) external {
        require(msg.sender == payer && payer != address(0), "payer");
        require(settlementRouter != address(0) && settlementRouter.code.length != 0, "settlement router");
        _requireOperational(
            PayIds420.ACTION_SETTLE, ISystemSafety420.ActionClass.NORMAL_ONLY, Types420.Direction.OUTBOUND
        );
        requireSettlementHealth(settlementAsset, bytes32(0), false);
        _consumePaymentAuthorization(paymentId);
        SettlementRouter420(settlementRouter)
            .executeDirectTokenSplit(paymentId, payer, settlementAsset, amount, recipients, bps, primaryIndex);
        emit PaymentAuthorized(paymentId, payer, amount, amount);
    }

    function executeNativeSplitSettlement(
        bytes32 paymentId,
        address payer,
        address[] calldata recipients,
        uint16[] calldata bps,
        uint8 primaryIndex
    ) external payable {
        require(msg.sender == payer && payer != address(0), "payer");
        require(msg.value > 0, "amount");
        require(settlementRouter != address(0) && settlementRouter.code.length != 0, "settlement router");
        _requireOperational(
            PayIds420.ACTION_SETTLE, ISystemSafety420.ActionClass.NORMAL_ONLY, Types420.Direction.OUTBOUND
        );
        _consumePaymentAuthorization(paymentId);
        SettlementRouter420(settlementRouter).executeNativeSplit{ value: msg.value }(
            paymentId, msg.value, recipients, bps, primaryIndex
        );
        emit PaymentAuthorized(paymentId, payer, msg.value, msg.value);
    }

    function _authorizeSwap(
        bytes32 paymentId,
        ICanonicalSettlement420.Quote calldata q,
        address payer,
        uint256 invoiceSettlementAmount,
        PayerLimits calldata limits,
        uint256 gasCost420,
        uint256 tip
    ) private {
        require(payer != address(0), "payer");
        _requirePayerOrGovernance(payer);
        _requireOperational(
            PayIds420.ACTION_SETTLE, ISystemSafety420.ActionClass.NORMAL_ONLY, Types420.Direction.OUTBOUND
        );
        require(settlementAdapter != address(0) && settlementAdapter.code.length != 0, "settlement adapter");
        require(q.quotedAt == limits.quoteTimestamp, "quote timestamp mismatch");
        require(block.timestamp <= uint256(q.quotedAt) + QUOTE_LIFETIME, "stale quote");
        requireSettlementHealth(q.settlementAsset, q.marketId, true);
        _requireSharedFeeQuote(q);
        validateLimits(limits, q.inputAmount, gasCost420, q.slippageBps, tip, q.conversionFee, 0);
        require(q.minimumSettlementAmount >= invoiceSettlementAmount, "merchant minimum");
        _consumePaymentAuthorization(paymentId);
    }

    function _requireSharedFeeQuote(
        ICanonicalSettlement420.Quote calldata q
    ) internal view {
        IFeeQuote420 feeSource = IFeeQuote420(_resolveRequired(AppDependencyIds420.FEE_QUOTE));
        bytes memory request = abi.encode(
            q.marketId, q.inputAsset, q.settlementAsset, q.inputAmount, q.minimumSettlementAmount, q.slippageBps
        );
        IFeeQuote420.FeeQuote memory fees = feeSource.feeQuote(q.quoteId, request);
        if (fees.quoteId != q.quoteId || block.timestamp > fees.expiresAt) revert Errors420.StaleQuote(q.quoteId);
        require(fees.protocolFee == 0, "protocol fee");
        require(fees.conversionFee == q.conversionFee, "fee quote mismatch");
    }

    function _requirePayerOrGovernance(
        address payer
    ) internal view {
        if (msg.sender != payer) _requireGenesisGovernance(PayIds420.ACTION_SETTLE);
    }

    function _consumePaymentAuthorization(
        bytes32 paymentId
    ) private {
        require(paymentId != bytes32(0), "payment id");
        require(!consumedPaymentAuthorization[paymentId], "payment authorization used");

        address replayAddress = _resolveRequired(AppDependencyIds420.REPLAY_PROTECTION);
        IReplayProtection420 replay = IReplayProtection420(replayAddress);
        if (replay.isConsumed(paymentId)) revert Errors420.Replay(paymentId);

        consumedPaymentAuthorization[paymentId] = true;
        _consumeSharedReplay(replayAddress, paymentId);
    }

    function _consumeSharedReplay(
        address replayAddress,
        bytes32 paymentId
    ) internal {
        (bool advertised, bytes memory consumerData) = replayAddress.staticcall(
            abi.encodeWithSignature("domainConsumer(bytes32)", ReplayDomainIds420.PAY_SETTLEMENT)
        );
        if (!advertised || consumerData.length != 32) return;
        require(abi.decode(consumerData, (address)) == address(this), "replay domain binding");
        IReplayConsumer420(replayAddress).consume(paymentId, ReplayDomainIds420.PAY_SETTLEMENT);
    }
}
