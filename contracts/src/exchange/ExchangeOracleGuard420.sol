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

    /// @notice Reverts unless an execution/quote price is within the configured reference-price band.
    /// @param executionPriceE18 observed venue price, quote units per base unit, scaled by 1e18.
    function requireHealthy(bytes32 marketId, uint256 executionPriceE18) external view {
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
}
