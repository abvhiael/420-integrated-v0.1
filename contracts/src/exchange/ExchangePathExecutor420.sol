// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ExchangeAuthorization420.sol";
import "./ExchangeEmergencyControl420.sol";
import "./ExchangeMarketRegistry420.sol";
import "./ExchangeRouteRegistry420.sol";
import "./ExchangeAssetRegistry420.sol";

/// @notice Atomic, bounded multi-hop execution boundary for 420Exchange.
/// @dev The caller remains the payer for every hop. Intermediate outputs settle back to the caller,
///      so this contract never takes custody and approved adapters can pull the next hop's input
///      from the same Smart Account within the same transaction.
contract ExchangePathExecutor420 {
    uint256 public constant MAX_HOPS = 4;

    ExchangeMarketRegistry420 public immutable marketRegistry;
    ExchangeAssetRegistry420 public immutable assetRegistry;
    ExchangeRouteRegistry420 public immutable routeRegistry;
    ExchangeAuthorization420 public immutable authorization;
    ExchangeEmergencyControl420 public immutable emergencyControl;

    struct Hop {
        bytes32 marketId;
        bytes32 routeId;
        address tokenOut;
        uint256 minAmountOut;
        bytes routeData;
    }

    uint256 private _entered;

    error InvalidAddress();
    error InvalidPath();
    error PathHashMismatch();
    error InactiveMarket();
    error InvalidMarketPair();
    error UnauthorizedSwap();
    error SlippageExceeded();
    error Reentrancy();

    event ExchangePathExecuted(
        bytes32 indexed pathHash,
        address indexed payer,
        address indexed recipient,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 hopCount
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
                || marketRegistry_.code.length == 0 || assetRegistry_.code.length == 0
                || routeRegistry_.code.length == 0 || authorization_.code.length == 0
                || emergencyControl_.code.length == 0
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

    /// @notice Hashes every execution-critical field so a Smart Account can bind authorization
    ///         to the exact path, route payloads and slippage constraints presented for execution.
    function hashPath(
        address principal,
        address tokenIn,
        uint256 amountIn,
        uint256 minFinalAmountOut,
        address recipient,
        Hop[] calldata hops
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                "420/EXCHANGE/PATH/V6",
                block.chainid,
                address(this),
                principal,
                tokenIn,
                amountIn,
                minFinalAmountOut,
                recipient,
                hops
            )
        );
    }

    function executeExactInputPath(
        address tokenIn,
        uint256 amountIn,
        uint256 minFinalAmountOut,
        address recipient,
        bytes32 expectedPathHash,
        Hop[] calldata hops
    ) external nonReentrant returns (uint256 amountOut) {
        if (
            tokenIn == address(0) || recipient == address(0) || amountIn == 0 || minFinalAmountOut == 0
                || hops.length == 0 || hops.length > MAX_HOPS
        ) revert InvalidPath();

        bytes32 actualPathHash = hashPath(msg.sender, tokenIn, amountIn, minFinalAmountOut, recipient, hops);
        if (expectedPathHash == bytes32(0) || expectedPathHash != actualPathHash) revert PathHashMismatch();

        emergencyControl.requireOpen(ExchangeEmergencyControl420.Domain.SWAPS);

        address currentToken = tokenIn;
        uint256 currentAmount = amountIn;

        for (uint256 i = 0; i < hops.length; ++i) {
            Hop calldata hop = hops[i];
            if (
                hop.marketId == bytes32(0) || hop.routeId == bytes32(0) || hop.tokenOut == address(0)
                    || hop.tokenOut == currentToken || hop.minAmountOut == 0
            ) revert InvalidPath();

            _requireActiveMarketPair(hop.marketId, currentToken, hop.tokenOut);
            if (!authorization.canSwap(msg.sender, hop.marketId, currentAmount)) revert UnauthorizedSwap();

            ExchangeRouteRegistry420.RouteAdapter memory route = routeRegistry.requireActive(hop.routeId);
            address hopRecipient = i + 1 == hops.length ? recipient : msg.sender;

            uint256 nextAmount = IExchangeExecutionAdapter420(route.executionAdapter).executeSwap(
                msg.sender,
                hopRecipient,
                currentToken,
                hop.tokenOut,
                currentAmount,
                hop.minAmountOut,
                hop.routeData
            );
            if (nextAmount < hop.minAmountOut) revert SlippageExceeded();

            currentToken = hop.tokenOut;
            currentAmount = nextAmount;
        }

        if (currentAmount < minFinalAmountOut) revert SlippageExceeded();

        amountOut = currentAmount;
        emit ExchangePathExecuted(
            actualPathHash,
            msg.sender,
            recipient,
            tokenIn,
            currentToken,
            amountIn,
            amountOut,
            hops.length
        );
    }

    function _requireActiveMarketPair(bytes32 marketId, address tokenIn, address tokenOut) private view {
        if (!marketRegistry.isActive(marketId)) revert InactiveMarket();

        (bytes32 baseAssetId, bytes32 quoteAssetId,,,,) = marketRegistry.markets(marketId);
        (,,, address baseToken,,,,,) = assetRegistry.assets(baseAssetId);
        (,,, address quoteToken,,,,,) = assetRegistry.assets(quoteAssetId);

        if (baseToken == address(0) || quoteToken == address(0) || baseToken == quoteToken) {
            revert InvalidMarketPair();
        }

        bool matches = (baseToken == tokenIn && quoteToken == tokenOut)
            || (baseToken == tokenOut && quoteToken == tokenIn);
        if (!matches) revert InvalidMarketPair();
    }
}
