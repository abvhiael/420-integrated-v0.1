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
import "../libraries/GenesisInterfaceIds420.sol";
import "./PayIds420.sol";

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
    mapping(bytes32 => bool) public consumedPaymentAuthorization;

    event SettlementAdapterSet(address indexed adapter);
    event PaymentAuthorized(
        bytes32 indexed paymentId,
        address indexed payer,
        uint256 inputSpent,
        uint256 settlementDelivered
    );

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) {
        return PayIds420.PAYMENT_ROUTER;
    }

    function setSettlementAdapter(address adapter) external {
        _requireGenesisGovernance(PayIds420.ACTION_CONFIGURE);
        require(adapter != address(0) && adapter.code.length != 0, "adapter");
        settlementAdapter = adapter;
        emit SettlementAdapterSet(adapter);
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
        require(
            slippageBps <= limits.maxSlippageBps && limits.maxSlippageBps <= DEFAULT_MAX_SLIPPAGE_BPS,
            "slippage"
        );
        require(tip <= limits.maxTip, "tip overspend");
        require(conversionFee <= limits.maxConversionFee, "conversion fee");
        require(protocolFee <= limits.maxProtocolFee && protocolFee == 0, "protocol fee");
        return true;
    }

    function requireSettlementHealth(address asset, bytes32 marketId, bool conversionRequired) public view {
        _canonicalSettlementAsset(asset);
        if (conversionRequired) _requireHealthyMarket(marketId);
    }

    function _requireSharedFeeQuote(ICanonicalSettlement420.Quote calldata q) internal view {
        IFeeQuote420 feeSource = IFeeQuote420(_resolveRequired(AppDependencyIds420.FEE_QUOTE));
        bytes memory request = abi.encode(
            q.marketId,
            q.inputAsset,
            q.settlementAsset,
            q.inputAmount,
            q.minimumSettlementAmount,
            q.slippageBps
        );
        IFeeQuote420.FeeQuote memory fees = feeSource.feeQuote(q.quoteId, request);
        if (fees.quoteId != q.quoteId || block.timestamp > fees.expiresAt) revert Errors420.StaleQuote(q.quoteId);
        require(fees.protocolFee == 0, "protocol fee");
        require(fees.conversionFee == q.conversionFee, "fee quote mismatch");
    }

    /// @notice Atomic canonical conversion/settlement entry.
    /// @dev If the swap execution or any postcondition fails, local replay state also rolls back.
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
        _requireGenesisGovernance(PayIds420.ACTION_SETTLE);
        _requireOperational(
            PayIds420.ACTION_SETTLE,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.OUTBOUND
        );
        require(paymentId != bytes32(0), "payment id");
        require(payer != address(0) && recipient != address(0), "party");
        require(!consumedPaymentAuthorization[paymentId], "payment authorization used");
        require(settlementAdapter != address(0) && settlementAdapter.code.length != 0, "settlement adapter");

        IReplayProtection420 replay = IReplayProtection420(_resolveRequired(AppDependencyIds420.REPLAY_PROTECTION));
        if (replay.isConsumed(paymentId)) revert Errors420.Replay(paymentId);

        require(q.quotedAt == limits.quoteTimestamp, "quote timestamp mismatch");
        require(block.timestamp <= uint256(q.quotedAt) + QUOTE_LIFETIME, "stale quote");
        requireSettlementHealth(q.settlementAsset, q.marketId, true);
        _requireSharedFeeQuote(q);
        validateLimits(limits, q.inputAmount, gasCost420, q.slippageBps, tip, q.conversionFee, 0);
        require(q.minimumSettlementAmount >= invoiceSettlementAmount, "merchant minimum");

        consumedPaymentAuthorization[paymentId] = true;
        (inputSpent, delivered) = ICanonicalSettlement420(settlementAdapter).execute{ value: msg.value }(
            q,
            payer,
            recipient,
            invoiceSettlementAmount
        );
        require(inputSpent <= limits.maxInputAmount, "post input overspend");
        require(delivered >= invoiceSettlementAmount, "merchant underpaid");
        emit PaymentAuthorized(paymentId, payer, inputSpent, delivered);
    }
}
