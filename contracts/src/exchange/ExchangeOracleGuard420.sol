// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";

interface IExchangeReferenceOracle420 {
    /// @notice Returns quote units per one base unit, scaled by 1e18.
    function referencePrice(bytes32 marketId) external view returns (uint256 priceE18, uint256 updatedAt);
}

/// @notice Provider-neutral fail-closed oracle/TWAP sanity guard for 420Exchange.
/// @dev The oracle is a circuit-breaker reference only; it never sets the executable market price.
contract ExchangeOracleGuard420 is SystemAccess {
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_DEVIATION_BPS = 5_000;
    uint256 public constant MAX_STALENESS = 7 days;
    uint256 public constant PRICE_SCALE = 1e18;
    uint8 public constant MAX_TOKEN_DECIMALS = 36;

    struct GuardConfig {
        address oracle;
        uint32 maxStaleness;
        uint16 maxDeviationBps;
        bool enabled;
    }

    mapping(bytes32 => GuardConfig) public guards;

    error InvalidConfig();
    error GuardDisabled();
    error OracleStale();
    error InvalidOraclePrice();
    error PriceDeviation();
    error InvalidTokenDecimals();
    error InvalidExecutionAmount();
    error NormalizationOverflow();

    event GuardConfigured(
        bytes32 indexed marketId,
        address indexed oracle,
        uint32 maxStaleness,
        uint16 maxDeviationBps,
        bool enabled
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    function configureGuard(
        bytes32 marketId,
        address oracle,
        uint32 maxStaleness,
        uint16 maxDeviationBps,
        bool enabled
    ) external onlyGovernance {
        if (marketId == bytes32(0)) revert InvalidConfig();
        if (enabled) {
            if (
                oracle == address(0) || oracle.code.length == 0 || maxStaleness == 0 || maxStaleness > MAX_STALENESS
                    || maxDeviationBps == 0 || maxDeviationBps > MAX_DEVIATION_BPS
            ) revert InvalidConfig();
        }
        guards[marketId] = GuardConfig(oracle, maxStaleness, maxDeviationBps, enabled);
        emit GuardConfigured(marketId, oracle, maxStaleness, maxDeviationBps, enabled);
    }

    /// @notice Reverts unless an already-normalized execution/quote price is within the configured reference band.
    /// @param executionPriceE18 observed venue price, quote units per base unit, scaled by 1e18.
    function requireHealthy(bytes32 marketId, uint256 executionPriceE18) external view {
        _requireHealthy(marketId, executionPriceE18);
    }

    /// @notice Normalizes raw ERC20 base/quote amounts and validates the resulting quote-per-base execution price.
    /// @dev Token decimals are read from the registered token contracts, not inferred from raw integer amounts.
    function requireHealthyAmounts(
        bytes32 marketId,
        address baseToken,
        address quoteToken,
        uint256 baseAmount,
        uint256 quoteAmount
    ) external view returns (uint256 executionPriceE18) {
        executionPriceE18 = normalizedExecutionPriceE18(baseToken, quoteToken, baseAmount, quoteAmount);
        _requireHealthy(marketId, executionPriceE18);
    }

    /// @notice Returns quote units per one base unit at 1e18 precision from raw ERC20 amounts.
    function normalizedExecutionPriceE18(
        address baseToken,
        address quoteToken,
        uint256 baseAmount,
        uint256 quoteAmount
    ) public view returns (uint256 executionPriceE18) {
        if (
            baseToken == address(0) || quoteToken == address(0) || baseToken == quoteToken || baseAmount == 0
                || quoteAmount == 0
        ) revert InvalidExecutionAmount();

        uint256 normalizedBase = _normalizeAmount(baseAmount, _tokenDecimals(baseToken));
        uint256 normalizedQuote = _normalizeAmount(quoteAmount, _tokenDecimals(quoteToken));
        if (normalizedBase == 0 || normalizedQuote == 0) revert InvalidExecutionAmount();
        if (normalizedQuote > type(uint256).max / PRICE_SCALE) revert NormalizationOverflow();

        executionPriceE18 = normalizedQuote * PRICE_SCALE / normalizedBase;
        if (executionPriceE18 == 0) revert InvalidExecutionAmount();
    }

    function _requireHealthy(bytes32 marketId, uint256 executionPriceE18) private view {
        GuardConfig memory config = guards[marketId];
        if (!config.enabled) revert GuardDisabled();
        if (executionPriceE18 == 0) revert InvalidOraclePrice();

        (uint256 referencePriceE18, uint256 updatedAt) =
            IExchangeReferenceOracle420(config.oracle).referencePrice(marketId);
        if (referencePriceE18 == 0 || updatedAt == 0 || updatedAt > block.timestamp) revert InvalidOraclePrice();
        if (block.timestamp - updatedAt > config.maxStaleness) revert OracleStale();

        uint256 difference = executionPriceE18 > referencePriceE18
            ? executionPriceE18 - referencePriceE18
            : referencePriceE18 - executionPriceE18;
        uint256 deviationBps = difference * BPS_DENOMINATOR / referencePriceE18;
        if (deviationBps > config.maxDeviationBps) revert PriceDeviation();
    }

    function _tokenDecimals(address token) private view returns (uint8 decimals_) {
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSignature("decimals()"));
        if (!ok || data.length != 32) revert InvalidTokenDecimals();
        uint256 decoded = abi.decode(data, (uint256));
        if (decoded > MAX_TOKEN_DECIMALS) revert InvalidTokenDecimals();
        decimals_ = uint8(decoded);
    }

    function _normalizeAmount(uint256 amount, uint8 decimals_) private pure returns (uint256 normalized) {
        if (decimals_ == 18) return amount;
        if (decimals_ < 18) {
            uint256 factor = 10 ** uint256(18 - decimals_);
            if (amount > type(uint256).max / factor) revert NormalizationOverflow();
            return amount * factor;
        }

        uint256 divisor = 10 ** uint256(decimals_ - 18);
        normalized = amount / divisor;
    }
}
