// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";

/// @notice Registry of approved execution/quote adapters. 420Swap remains the underlying liquidity layer.
contract ExchangeRouteRegistry420 is SystemAccess {
    struct RouteAdapter {
        address executionAdapter;
        address quoteAdapter;
        bytes32 venueId;
        bytes32 metadataHash;
        bool active;
    }

    mapping(bytes32 => RouteAdapter) public routes;

    event RouteConfigured(bytes32 indexed routeId, bytes32 indexed venueId, address executionAdapter, address quoteAdapter, bool active);

    constructor(address timelock_) SystemAccess(timelock_) {}

    function configureRoute(
        bytes32 routeId,
        bytes32 venueId,
        address executionAdapter,
        address quoteAdapter,
        bytes32 metadataHash,
        bool active
    ) external onlyGovernance {
        require(routeId != bytes32(0) && venueId != bytes32(0), "id");
        require(executionAdapter != address(0) && executionAdapter.code.length != 0, "execution");
        require(quoteAdapter != address(0) && quoteAdapter.code.length != 0, "quote");
        routes[routeId] = RouteAdapter(executionAdapter, quoteAdapter, venueId, metadataHash, active);
        emit RouteConfigured(routeId, venueId, executionAdapter, quoteAdapter, active);
    }

    function requireActive(bytes32 routeId) external view returns (RouteAdapter memory route) {
        route = routes[routeId];
        require(route.active, "inactive route");
    }
}

interface IExchangeQuoteAdapter420 {
    function quote(address tokenIn, address tokenOut, uint256 amountIn, bytes calldata routeData)
        external
        view
        returns (uint256 amountOut, uint256 priceImpactBps);
}

interface IExchangeExecutionAdapter420 {
    function executeSwap(
        address payer,
        address recipient,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata routeData
    ) external returns (uint256 amountOut);
}
