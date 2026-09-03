// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ExchangeAuthorization420.sol";
import "./ExchangeEmergencyControl420.sol";
import "./ExchangeMarketRegistry420.sol";
import "./ExchangeRouteRegistry420.sol";
import "./ExchangeAssetRegistry420.sol";

/// @notice Non-custodial spot execution boundary for 420Exchange.
/// @dev The payer is always msg.sender. Approved execution adapters perform venue-specific execution.
contract ExchangeRouter420 {
    ExchangeMarketRegistry420 public immutable marketRegistry;
    ExchangeAssetRegistry420 public immutable assetRegistry;
    ExchangeRouteRegistry420 public immutable routeRegistry;
    ExchangeAuthorization420 public immutable authorization;
    ExchangeEmergencyControl420 public immutable emergencyControl;

    uint256 private _entered;

    error InvalidAddress();
    error InactiveMarket();
    error InvalidPair();
    error UnauthorizedSwap();
    error SlippageExceeded();
    error Reentrancy();

    event ExchangeSwapExecuted(
        bytes32 indexed marketId,
        bytes32 indexed routeId,
        address indexed payer,
        address recipient,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(
        address marketRegistry_,
        address assetRegistry_,
        address routeRegistry_,
        address authorization_,
        address emergencyControl_
    ) {
        if (
            marketRegistry_ == address(0) || assetRegistry_ == address(0) || routeRegistry_ == address(0)
                || authorization_ == address(0) || emergencyControl_ == address(0)
        ) revert InvalidAddress();
        marketRegistry = ExchangeMarketRegistry420(marketRegistry_);
        assetRegistry = ExchangeAssetRegistry420(assetRegistry_);
        routeRegistry = ExchangeRouteRegistry420(routeRegistry_);
        authorization = ExchangeAuthorization420(authorization_);
        emergencyControl = ExchangeEmergencyControl420(emergencyControl_);
    }

    modifier nonReentrant() {
        if (_entered != 0) revert Reentrancy();
        _entered = 1;
        _;
        _entered = 0;
    }

    function quoteExactInput(
        bytes32 marketId,
        bytes32 routeId,
        address tokenIn,
        uint256 amountIn,
        bytes calldata routeData
    ) external view returns (address tokenOut, uint256 amountOut, uint256 priceImpactBps) {
        if (tokenIn == address(0) || amountIn == 0) revert InvalidPair();
        tokenOut = _resolveTokenOut(marketId, tokenIn);
        ExchangeRouteRegistry420.RouteAdapter memory route = routeRegistry.requireActive(routeId);
        (amountOut, priceImpactBps) = IExchangeQuoteAdapter420(route.quoteAdapter).quote(
            tokenIn,
            tokenOut,
            amountIn,
            routeData
        );
    }

    function swapExactInput(
        bytes32 marketId,
        bytes32 routeId,
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        bytes calldata routeData
    ) external nonReentrant returns (uint256 amountOut) {
        if (recipient == address(0) || tokenIn == address(0) || amountIn == 0 || minAmountOut == 0) {
            revert InvalidAddress();
        }

        emergencyControl.requireOpen(ExchangeEmergencyControl420.Domain.SWAPS);
        if (!authorization.canSwap(msg.sender, marketId, amountIn)) revert UnauthorizedSwap();

        address tokenOut = _resolveTokenOut(marketId, tokenIn);
        ExchangeRouteRegistry420.RouteAdapter memory route = routeRegistry.requireActive(routeId);

        amountOut = IExchangeExecutionAdapter420(route.executionAdapter).executeSwap(
            msg.sender,
            recipient,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            routeData
        );
        if (amountOut < minAmountOut) revert SlippageExceeded();

        emit ExchangeSwapExecuted(
            marketId,
            routeId,
            msg.sender,
            recipient,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut
        );
    }

    function _resolveTokenOut(bytes32 marketId, address tokenIn) private view returns (address tokenOut) {
        if (!marketRegistry.isActive(marketId)) revert InactiveMarket();

        (bytes32 baseAssetId, bytes32 quoteAssetId,,,,) = marketRegistry.markets(marketId);
        (,,, address baseToken,,,,,) = assetRegistry.assets(baseAssetId);
        (,,, address quoteToken,,,,,) = assetRegistry.assets(quoteAssetId);
        if (baseToken == address(0) || quoteToken == address(0) || baseToken == quoteToken) revert InvalidPair();

        if (tokenIn == baseToken) return quoteToken;
        if (tokenIn == quoteToken) return baseToken;
        revert InvalidPair();
    }
}
