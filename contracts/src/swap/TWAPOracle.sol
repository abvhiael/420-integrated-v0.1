// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "./SwapIds420.sol";

interface ICanonicalMarketRegistryTWAP420 {
    function markets(bytes32 marketId)
        external view
        returns (
            address pool,
            address asset0,
            address asset1,
            uint8 role,
            bytes32 metadataHash,
            bool active
        );
}

interface ICanonicalPoolTWAP420 {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function currentCumulativePrices()
        external view
        returns (uint256 cumulative0X96, uint256 cumulative1X96, uint64 timestamp);
}

/// @notice Canonical Swap TWAP derived exclusively from canonical on-chain pool cumulative prices.
/// @dev Governance configures bounded observation windows and freshness; it cannot submit arbitrary prices.
///      Anyone may checkpoint because the checkpoint is derived from the canonical market/pool state.
contract TWAPOracle is GenesisResidentAccess420 {
    uint256 private constant Q96 = 1 << 96;
    uint8 public constant MAX_TOKEN_DECIMALS = 36;

    struct MarketConfig {
        uint32 minWindowSeconds;
        uint32 maxWindowSeconds;
        uint32 maxStalenessSeconds;
        bool enabled;
    }

    /// @dev Preserved public compatibility surface consumed by TWAPOracleSourceAdapter420.
    struct Observation {
        uint64 timestamp;
        uint192 priceX96;
    }

    struct Baseline {
        uint64 timestamp;
        uint256 cumulativeX96;
        bytes32 sourceHash;
    }

    mapping(bytes32 => MarketConfig) public marketConfig;
    mapping(bytes32 => Observation) public latest;
    mapping(bytes32 => uint32) public latestWindowSeconds;
    mapping(bytes32 => bytes32) public latestSourceHash;
    mapping(bytes32 => Baseline) public baseline;

    error InvalidConfig();
    error OracleDisabled();
    error InvalidMarket();
    error InvalidPool();
    error WindowTooShort();
    error ObservationUnavailable();
    error ObservationStale();
    error InvalidTokenDecimals();
    error PriceOverflow();

    event MarketConfigured(
        bytes32 indexed marketId,
        uint32 minWindowSeconds,
        uint32 maxWindowSeconds,
        uint32 maxStalenessSeconds,
        bool enabled
    );
    event SourceSeeded(bytes32 indexed marketId, address indexed pool, uint64 timestamp, bytes32 sourceHash);
    event ObservationApplied(
        bytes32 indexed marketId,
        uint64 timestamp,
        uint192 priceX96,
        uint32 observationWindowSeconds,
        bytes32 sourceHash
    );

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) { return SwapIds420.TWAP_ORACLE; }

    /// @notice Configure a canonical market's minimum/maximum TWAP window and maximum accepted staleness.
    /// @dev Any configuration change invalidates the old baseline/observation so prior policy cannot leak forward.
    function configureMarket(
        bytes32 marketId,
        uint32 minWindowSeconds,
        uint32 maxWindowSeconds,
        uint32 maxStalenessSeconds,
        bool enabled
    ) external {
        _requireGenesisGovernance(SwapIds420.ACTION_CONFIGURE);
        if (marketId == bytes32(0)) revert InvalidConfig();
        if (enabled) {
            if (
                minWindowSeconds == 0 || maxWindowSeconds < minWindowSeconds
                    || maxStalenessSeconds == 0
            ) revert InvalidConfig();
        }

        marketConfig[marketId] =
            MarketConfig(minWindowSeconds, maxWindowSeconds, maxStalenessSeconds, enabled);
        delete baseline[marketId];
        delete latest[marketId];
        delete latestWindowSeconds[marketId];
        delete latestSourceHash[marketId];

        emit MarketConfigured(
            marketId, minWindowSeconds, maxWindowSeconds, maxStalenessSeconds, enabled
        );
    }

    /// @notice Advance a market's TWAP from canonical pool cumulative price state.
    /// @return observationCreated True only when a complete, policy-compliant TWAP window was produced.
    function checkpoint(bytes32 marketId) external returns (bool observationCreated) {
        _requireOperational(
            SwapIds420.ACTION_PUBLISH_ORACLE,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.INBOUND
        );

        MarketConfig memory config = marketConfig[marketId];
        if (!config.enabled) revert OracleDisabled();

        (
            address pool,
            address asset0,
            address asset1,
            uint256 cumulativeX96,
            uint64 timestamp,
            bytes32 sourceHash
        ) = _canonicalSource(marketId);

        Baseline memory previous = baseline[marketId];
        if (previous.timestamp == 0 || previous.sourceHash != sourceHash) {
            _seed(marketId, pool, timestamp, cumulativeX96, sourceHash);
            return false;
        }

        if (timestamp <= previous.timestamp) revert WindowTooShort();
        uint256 elapsed = uint256(timestamp - previous.timestamp);
        if (elapsed < config.minWindowSeconds) revert WindowTooShort();

        if (elapsed > config.maxWindowSeconds) {
            _seed(marketId, pool, timestamp, cumulativeX96, sourceHash);
            return false;
        }

        uint256 cumulativeDelta;
        unchecked {
            cumulativeDelta = cumulativeX96 - previous.cumulativeX96;
        }
        uint256 rawAverageX96 = cumulativeDelta / elapsed;
        uint192 normalizedX96 = _normalizePriceX96(rawAverageX96, asset0, asset1);

        latest[marketId] = Observation(timestamp, normalizedX96);
        latestWindowSeconds[marketId] = uint32(elapsed);
        latestSourceHash[marketId] = sourceHash;
        baseline[marketId] = Baseline(timestamp, cumulativeX96, sourceHash);

        emit ObservationApplied(marketId, timestamp, normalizedX96, uint32(elapsed), sourceHash);
        return true;
    }

    /// @notice Fail-closed, normalized TWAP observation for security-sensitive consumers.
    function readObservation(bytes32 marketId)
        public view
        returns (
            uint192 priceX96,
            uint64 observedAt,
            uint64 validUntil,
            uint32 observationWindowSeconds,
            uint16 confidenceBps,
            bytes32 sourceHash,
            Types420.Health health
        )
    {
        MarketConfig memory config = marketConfig[marketId];
        if (!config.enabled) revert OracleDisabled();

        Observation memory observation = latest[marketId];
        observationWindowSeconds = latestWindowSeconds[marketId];
        sourceHash = latestSourceHash[marketId];
        if (
            observation.timestamp == 0 || observation.priceX96 == 0 || sourceHash == bytes32(0)
                || observationWindowSeconds < config.minWindowSeconds
                || observationWindowSeconds > config.maxWindowSeconds
        ) revert ObservationUnavailable();

        uint256 expiry = uint256(observation.timestamp) + uint256(config.maxStalenessSeconds);
        if (block.timestamp > expiry) revert ObservationStale();

        priceX96 = observation.priceX96;
        observedAt = observation.timestamp;
        validUntil = uint64(expiry);
        confidenceBps = 0;
        health = Types420.Health.HEALTHY;
    }

    /// @notice Exchange-compatible quote-per-base reference price at 1e18 precision.
    /// @dev This is a circuit-breaker reference only; it never sets executable swap pricing.
    function referencePrice(bytes32 marketId) external view returns (uint256 priceE18, uint256 updatedAt) {
        (uint192 priceX96, uint64 observedAt,,,,,) = readObservation(marketId);
        priceE18 = (uint256(priceX96) * 1e18) >> 96;
        if (priceE18 == 0) revert ObservationUnavailable();
        updatedAt = observedAt;
    }

    function _seed(
        bytes32 marketId,
        address pool,
        uint64 timestamp,
        uint256 cumulativeX96,
        bytes32 sourceHash
    ) private {
        baseline[marketId] = Baseline(timestamp, cumulativeX96, sourceHash);
        delete latest[marketId];
        delete latestWindowSeconds[marketId];
        delete latestSourceHash[marketId];
        emit SourceSeeded(marketId, pool, timestamp, sourceHash);
    }

    function _canonicalSource(bytes32 marketId)
        private view
        returns (
            address pool,
            address asset0,
            address asset1,
            uint256 cumulativeX96,
            uint64 timestamp,
            bytes32 sourceHash
        )
    {
        address registryAddress = _resolveRequired(SwapIds420.CANONICAL_MARKET_REGISTRY);
        uint8 role;
        bytes32 metadataHash;
        bool active;
        (pool, asset0, asset1, role, metadataHash, active) =
            ICanonicalMarketRegistryTWAP420(registryAddress).markets(marketId);

        if (
            marketId == bytes32(0) || !active || role == 0 || pool == address(0)
                || pool.code.length == 0 || asset0 == address(0) || asset1 == address(0)
                || asset0 == asset1
        ) revert InvalidMarket();

        address poolToken0 = ICanonicalPoolTWAP420(pool).token0();
        address poolToken1 = ICanonicalPoolTWAP420(pool).token1();
        (uint256 cumulative0X96, uint256 cumulative1X96, uint64 cumulativeTimestamp) =
            ICanonicalPoolTWAP420(pool).currentCumulativePrices();

        if (cumulativeTimestamp == 0 || cumulativeTimestamp > block.timestamp) revert InvalidPool();

        if (poolToken0 == asset0 && poolToken1 == asset1) {
            cumulativeX96 = cumulative0X96;
        } else if (poolToken1 == asset0 && poolToken0 == asset1) {
            cumulativeX96 = cumulative1X96;
        } else {
            revert InvalidPool();
        }

        timestamp = cumulativeTimestamp;
        sourceHash = keccak256(
            abi.encode(
                marketId,
                pool,
                pool.codehash,
                asset0,
                asset1,
                role,
                metadataHash
            )
        );
    }

    function _normalizePriceX96(uint256 rawPriceX96, address baseAsset, address quoteAsset)
        private view returns (uint192 normalized)
    {
        if (rawPriceX96 == 0) revert ObservationUnavailable();
        uint8 baseDecimals = _tokenDecimals(baseAsset);
        uint8 quoteDecimals = _tokenDecimals(quoteAsset);

        uint256 adjusted = rawPriceX96;
        if (baseDecimals > quoteDecimals) {
            uint256 factor = 10 ** uint256(baseDecimals - quoteDecimals);
            if (adjusted > uint256(type(uint192).max) / factor) revert PriceOverflow();
            adjusted *= factor;
        } else if (quoteDecimals > baseDecimals) {
            adjusted /= 10 ** uint256(quoteDecimals - baseDecimals);
        }

        if (adjusted == 0 || adjusted > type(uint192).max) revert PriceOverflow();
        normalized = uint192(adjusted);
    }

    function _tokenDecimals(address token) private view returns (uint8 decimals_) {
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSignature("decimals()"));
        if (!ok || data.length != 32) revert InvalidTokenDecimals();
        uint256 decoded = abi.decode(data, (uint256));
        if (decoded > MAX_TOKEN_DECIMALS) revert InvalidTokenDecimals();
        decimals_ = uint8(decoded);
    }
}
