// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ExchangeAssetRegistry420.sol";
import "./ExchangeAuthorization420.sol";
import "./ExchangeEmergencyControl420.sol";
import "./ExchangeMarketRegistry420.sol";
import "./ExchangeRouteRegistry420.sol";

interface IERC20AtomicRouter420 {
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Optional execution-adapter extension required for atomic multi-hop settlement.
/// @dev The allowance target is the contract that actually pulls an intermediate ERC20 from this router.
interface IExchangeAtomicExecutionAdapter420 {
    function allowanceTarget() external view returns (address);
}

/// @notice Bounded atomic multi-hop execution for 420Exchange.
/// @dev First-hop funds remain with msg.sender until an approved venue pulls them. Intermediate tokens may
///      exist on this router only during the transaction and must be consumed exactly by the following hop.
contract ExchangeAtomicRouter420 {
    uint256 public constant MAX_HOPS = 4;

    ExchangeMarketRegistry420 public immutable marketRegistry;
    ExchangeAssetRegistry420 public immutable assetRegistry;
    ExchangeRouteRegistry420 public immutable routeRegistry;
    ExchangeAuthorization420 public immutable authorization;
    ExchangeEmergencyControl420 public immutable emergencyControl;

    uint256 private _entered;

    struct Hop {
        bytes32 marketId;
        bytes32 routeId;
        address tokenOut;
        uint256 minAmountOut;
        bytes routeData;
    }

    error InvalidAddress();
    error InvalidPath();
    error PathHashMismatch();
    error InactiveMarket();
    error InvalidPair();
    error UnauthorizedSwap();
    error SlippageExceeded();
    error InvalidAllowanceTarget();
    error TokenCallFailed();
    error IntermediateInputMismatch();
    error IntermediateOutputMismatch();
    error RepeatedToken();
    error Reentrancy();

    event AtomicPathExecuted(
        bytes32 indexed pathHash,
        address indexed payer,
        address indexed recipient,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 hops
    );

    constructor(
        address marketRegistry_,
        address assetRegistry_,
        address routeRegistry_,
        address authorization_,
        address emergencyControl_
    ) {
        if (
            marketRegistry_ == address(0) || marketRegistry_.code.length == 0 || assetRegistry_ == address(0)
                || assetRegistry_.code.length == 0 || routeRegistry_ == address(0) || routeRegistry_.code.length == 0
                || authorization_ == address(0) || authorization_.code.length == 0 || emergencyControl_ == address(0)
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

    function hashPath(address tokenIn, uint256 amountIn, address recipient, Hop[] calldata hops)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(tokenIn, amountIn, recipient, hops));
    }

    function swapExactInputPath(
        address tokenIn,
        uint256 amountIn,
        uint256 minFinalAmountOut,
        address recipient,
        bytes32 expectedPathHash,
        Hop[] calldata hops
    ) external nonReentrant returns (uint256 amountOut) {
        if (
            tokenIn == address(0) || amountIn == 0 || minFinalAmountOut == 0 || recipient == address(0)
                || hops.length == 0 || hops.length > MAX_HOPS
        ) revert InvalidPath();

        bytes32 pathHash = hashPath(tokenIn, amountIn, recipient, hops);
        if (pathHash != expectedPathHash) revert PathHashMismatch();

        emergencyControl.requireOpen(ExchangeEmergencyControl420.Domain.SWAPS);

        address currentToken = tokenIn;
        uint256 currentAmount = amountIn;
        address[MAX_HOPS + 1] memory visitedTokens;
        visitedTokens[0] = tokenIn;

        for (uint256 i = 0; i < hops.length; ++i) {
            Hop calldata hop = hops[i];
            if (
                hop.marketId == bytes32(0) || hop.routeId == bytes32(0) || hop.tokenOut == address(0)
                    || hop.tokenOut == currentToken || hop.minAmountOut == 0
            ) revert InvalidPath();

            for (uint256 j = 0; j <= i; ++j) {
                if (visitedTokens[j] == hop.tokenOut) revert RepeatedToken();
            }
            visitedTokens[i + 1] = hop.tokenOut;

            _requireActiveMarketPair(hop.marketId, currentToken, hop.tokenOut);
            if (!authorization.canSwap(msg.sender, hop.marketId, currentAmount)) revert UnauthorizedSwap();

            ExchangeRouteRegistry420.RouteAdapter memory route = routeRegistry.requireActive(hop.routeId);
            bool finalHop = i + 1 == hops.length;
            address hopRecipient = finalHop ? recipient : address(this);
            address payer = i == 0 ? msg.sender : address(this);

            uint256 inputBalanceBefore;
            address allowanceTarget;
            if (i != 0) {
                inputBalanceBefore = _balanceOf(currentToken, address(this));
                if (inputBalanceBefore < currentAmount) revert IntermediateInputMismatch();
                allowanceTarget = _allowanceTarget(route.executionAdapter);
                _forceApprove(currentToken, allowanceTarget, currentAmount);
            }

            uint256 outputBalanceBefore;
            if (!finalHop) outputBalanceBefore = _balanceOf(hop.tokenOut, address(this));

            uint256 nextAmount = IExchangeExecutionAdapter420(route.executionAdapter).executeSwap(
                payer,
                hopRecipient,
                currentToken,
                hop.tokenOut,
                currentAmount,
                hop.minAmountOut,
                hop.routeData
            );
            if (nextAmount < hop.minAmountOut) revert SlippageExceeded();

            if (i != 0) {
                _forceApprove(currentToken, allowanceTarget, 0);
                uint256 inputBalanceAfter = _balanceOf(currentToken, address(this));
                if (inputBalanceBefore - inputBalanceAfter != currentAmount) revert IntermediateInputMismatch();
            }

            if (!finalHop) {
                uint256 outputBalanceAfter = _balanceOf(hop.tokenOut, address(this));
                if (outputBalanceAfter - outputBalanceBefore != nextAmount) revert IntermediateOutputMismatch();
            }

            currentToken = hop.tokenOut;
            currentAmount = nextAmount;
        }

        if (currentAmount < minFinalAmountOut) revert SlippageExceeded();
        amountOut = currentAmount;

        emit AtomicPathExecuted(
            pathHash,
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
        if (baseToken == address(0) || quoteToken == address(0) || baseToken == quoteToken) revert InvalidPair();

        bool matches = (baseToken == tokenIn && quoteToken == tokenOut) || (baseToken == tokenOut && quoteToken == tokenIn);
        if (!matches) revert InvalidPair();
    }

    function _allowanceTarget(address executionAdapter) private view returns (address target) {
        (bool ok, bytes memory data) = executionAdapter.staticcall(
            abi.encodeWithSelector(IExchangeAtomicExecutionAdapter420.allowanceTarget.selector)
        );
        if (!ok || data.length != 32) revert InvalidAllowanceTarget();
        target = abi.decode(data, (address));
        if (target == address(0) || target.code.length == 0) revert InvalidAllowanceTarget();
    }

    function _balanceOf(address token, address account) private view returns (uint256 balance) {
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSelector(IERC20AtomicRouter420.balanceOf.selector, account));
        if (!ok || data.length != 32) revert TokenCallFailed();
        balance = abi.decode(data, (uint256));
    }

    function _forceApprove(address token, address spender, uint256 amount) private {
        if (amount != 0) _safeApprove(token, spender, 0);
        _safeApprove(token, spender, amount);
    }

    function _safeApprove(address token, address spender, uint256 amount) private {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSignature("approve(address,uint256)", spender, amount));
        if (!ok || (data.length != 0 && (data.length != 32 || !abi.decode(data, (bool))))) revert TokenCallFailed();
    }
}
