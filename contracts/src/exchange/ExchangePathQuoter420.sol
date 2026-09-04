// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ExchangeRouteRegistry420.sol";

/// @notice Bounded, non-custodial multi-hop quote aggregation for 420Exchange.
/// @dev This contract never moves funds. It composes quotes from governance-approved route adapters.
contract ExchangePathQuoter420 {
    uint256 public constant MAX_HOPS = 4;

    ExchangeRouteRegistry420 public immutable routeRegistry;

    struct Hop {
        bytes32 routeId;
        address tokenOut;
        bytes routeData;
    }

    error InvalidAddress();
    error InvalidPath();
    error ZeroQuote();

    constructor(address routeRegistry_) {
        if (routeRegistry_ == address(0) || routeRegistry_.code.length == 0) revert InvalidAddress();
        routeRegistry = ExchangeRouteRegistry420(routeRegistry_);
    }

    function quotePath(address tokenIn, uint256 amountIn, Hop[] calldata hops)
        external
        view
        returns (uint256 amountOut, uint256 aggregateImpactBps)
    {
        if (tokenIn == address(0) || amountIn == 0 || hops.length == 0 || hops.length > MAX_HOPS) {
            revert InvalidPath();
        }

        address currentToken = tokenIn;
        uint256 currentAmount = amountIn;
        uint256 impact;

        for (uint256 i = 0; i < hops.length; ++i) {
            Hop calldata hop = hops[i];
            if (hop.routeId == bytes32(0) || hop.tokenOut == address(0) || hop.tokenOut == currentToken) {
                revert InvalidPath();
            }

            ExchangeRouteRegistry420.RouteAdapter memory route = routeRegistry.requireActive(hop.routeId);
            (uint256 nextAmount, uint256 hopImpactBps) = IExchangeQuoteAdapter420(route.quoteAdapter).quote(
                currentToken,
                hop.tokenOut,
                currentAmount,
                hop.routeData
            );
            if (nextAmount == 0) revert ZeroQuote();

            currentToken = hop.tokenOut;
            currentAmount = nextAmount;
            impact += hopImpactBps;
        }

        amountOut = currentAmount;
        aggregateImpactBps = impact;
    }
}
