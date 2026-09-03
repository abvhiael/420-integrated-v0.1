// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ExchangeRouteRegistry420.sol";

interface ICanonicalSwapExecutorExchange420 {
    function executeCanonicalSwap(
        bytes32 marketId,
        address payer,
        address recipient,
        address inputAsset,
        address settlementAsset,
        uint256 inputAmount,
        uint256 exactSettlementAmount
    ) external payable returns (uint256 inputSpent, uint256 settlementDelivered);
}

interface ICanonicalMarketRegistryExchange420 {
    function markets(bytes32 marketId) external view returns (
        address pool,
        address asset0,
        address asset1,
        uint8 role,
        bytes32 metadataHash,
        bool active
    );
}

/// @notice 420Exchange adapter for the canonical 420Swap execution boundary.
/// @dev routeData is exactly abi.encode(bytes32 canonicalMarketId). The adapter never takes custody itself.
contract CanonicalSwapAdapter420 is IExchangeQuoteAdapter420, IExchangeExecutionAdapter420 {
    ICanonicalSwapExecutorExchange420 public immutable executor;
    ICanonicalMarketRegistryExchange420 public immutable canonicalMarketRegistry;

    error InvalidAddress();
    error InvalidRouteData();
    error InactiveCanonicalMarket();
    error PairMismatch();
    error QuoteUnavailable();
    error InputOverspend();
    error UnderSettlement();

    constructor(address executor_, address canonicalMarketRegistry_) {
        if (executor_ == address(0) || canonicalMarketRegistry_ == address(0)) revert InvalidAddress();
        executor = ICanonicalSwapExecutorExchange420(executor_);
        canonicalMarketRegistry = ICanonicalMarketRegistryExchange420(canonicalMarketRegistry_);
    }

    /// @notice Contract that pulls ERC20 input during canonical settlement.
    /// @dev Atomic multi-hop routers use this to grant an exact, transaction-local intermediate-token allowance.
    function allowanceTarget() external view returns (address) {
        return address(executor);
    }

    function quote(address tokenIn, address tokenOut, uint256 amountIn, bytes calldata routeData)
        external
        view
        override
        returns (uint256 amountOut, uint256 priceImpactBps)
    {
        if (tokenIn == address(0) || tokenOut == address(0) || tokenIn == tokenOut || amountIn == 0) revert PairMismatch();
        bytes32 canonicalMarketId = _decodeRoute(routeData);
        address pool = _requireCanonicalPair(canonicalMarketId, tokenIn, tokenOut);

        (bool ok, bytes memory data) = pool.staticcall(
            abi.encodeWithSignature("quoteCanonicalSwap(address,address,uint256)", tokenIn, tokenOut, amountIn)
        );
        if (!ok || data.length != 64) revert QuoteUnavailable();
        (amountOut, priceImpactBps) = abi.decode(data, (uint256, uint256));
    }

    function executeSwap(
        address payer,
        address recipient,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata routeData
    ) external override returns (uint256 amountOut) {
        if (
            payer == address(0) || recipient == address(0) || tokenIn == address(0) || tokenOut == address(0)
                || tokenIn == tokenOut || amountIn == 0 || minAmountOut == 0
        ) revert PairMismatch();

        bytes32 canonicalMarketId = _decodeRoute(routeData);
        _requireCanonicalPair(canonicalMarketId, tokenIn, tokenOut);

        (uint256 inputSpent, uint256 settlementDelivered) = executor.executeCanonicalSwap(
            canonicalMarketId,
            payer,
            recipient,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut
        );
        if (inputSpent > amountIn) revert InputOverspend();
        if (settlementDelivered < minAmountOut) revert UnderSettlement();
        return settlementDelivered;
    }

    function _decodeRoute(bytes calldata routeData) private pure returns (bytes32 canonicalMarketId) {
        if (routeData.length != 32) revert InvalidRouteData();
        canonicalMarketId = abi.decode(routeData, (bytes32));
        if (canonicalMarketId == bytes32(0)) revert InvalidRouteData();
    }

    function _requireCanonicalPair(bytes32 canonicalMarketId, address tokenIn, address tokenOut)
        private
        view
        returns (address pool)
    {
        address asset0;
        address asset1;
        bool active;
        (pool, asset0, asset1,,, active) = canonicalMarketRegistry.markets(canonicalMarketId);
        if (!active || pool == address(0) || pool.code.length == 0) revert InactiveCanonicalMarket();
        bool matches = (asset0 == tokenIn && asset1 == tokenOut) || (asset1 == tokenIn && asset0 == tokenOut);
        if (!matches) revert PairMismatch();
    }
}
