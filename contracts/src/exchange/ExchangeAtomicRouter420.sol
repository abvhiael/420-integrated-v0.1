// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ExchangeAssetRegistry420.sol";
import "./ExchangeAuthorization420.sol";
import "./ExchangeEmergencyControl420.sol";
import "./ExchangeMarketRegistry420.sol";
import "./ExchangeOracleGuard420.sol";
import "./ExchangeRouteRegistry420.sol";

interface IERC20AtomicRouter420 {
    function balanceOf(address account) external view returns (uint256);
}

interface IWrapped420AtomicRouter420 {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}

/// @notice Optional execution-adapter extension required for atomic multi-hop settlement.
/// @dev The allowance target is the contract that actually pulls an intermediate ERC20 from this router.
interface IExchangeAtomicExecutionAdapter420 {
    function allowanceTarget() external view returns (address);
}

/// @notice Bounded atomic multi-hop execution for 420Exchange.
/// @dev ERC20 first-hop funds remain with the caller until an approved venue pulls them. Native $420 is wrapped
///      into the canonical wrapped token and held only for the duration of the transaction. Intermediate tokens
///      may exist on this router only during the transaction and must be consumed exactly by the following hop.
contract ExchangeAtomicRouter420 {
    uint256 public constant MAX_HOPS = 4;

    ExchangeMarketRegistry420 public immutable marketRegistry;
    ExchangeAssetRegistry420 public immutable assetRegistry;
    ExchangeRouteRegistry420 public immutable routeRegistry;
    ExchangeAuthorization420 public immutable authorization;
    ExchangeEmergencyControl420 public immutable emergencyControl;
    ExchangeOracleGuard420 public immutable oracleGuard;
    address public immutable wrappedNative420;

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
    error InvalidNativeValue();
    error NativeTransferFailed();
    error UnexpectedNativeSender();
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
    event NativePathExecuted(
        bytes32 indexed pathHash,
        address indexed payer,
        address indexed recipient,
        bool nativeIn,
        bool nativeOut,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(
        address marketRegistry_,
        address assetRegistry_,
        address routeRegistry_,
        address authorization_,
        address emergencyControl_,
        address oracleGuard_,
        address wrappedNative420_
    ) {
        if (
            marketRegistry_ == address(0) || marketRegistry_.code.length == 0 || assetRegistry_ == address(0)
                || assetRegistry_.code.length == 0 || routeRegistry_ == address(0) || routeRegistry_.code.length == 0
                || authorization_ == address(0) || authorization_.code.length == 0 || emergencyControl_ == address(0)
                || emergencyControl_.code.length == 0 || oracleGuard_ == address(0) || oracleGuard_.code.length == 0
                || wrappedNative420_ == address(0) || wrappedNative420_.code.length == 0
        ) revert InvalidAddress();

        marketRegistry = ExchangeMarketRegistry420(marketRegistry_);
        assetRegistry = ExchangeAssetRegistry420(assetRegistry_);
        routeRegistry = ExchangeRouteRegistry420(routeRegistry_);
        authorization = ExchangeAuthorization420(authorization_);
        emergencyControl = ExchangeEmergencyControl420(emergencyControl_);
        oracleGuard = ExchangeOracleGuard420(oracleGuard_);
        wrappedNative420 = wrappedNative420_;
    }

    receive() external payable {
        if (msg.sender != wrappedNative420) revert UnexpectedNativeSender();
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
        amountOut = _swapExactInputPath(
            msg.sender,
            msg.sender,
            tokenIn,
            amountIn,
            minFinalAmountOut,
            recipient,
            expectedPathHash,
            hops,
            false
        );
    }

    /// @notice Executes an exact-input path beginning with native $420.
    /// @dev `msg.value` is the exact input amount and is wrapped atomically before the first hop.
    function swapExactInputNativePath(
        uint256 minFinalAmountOut,
        address recipient,
        bytes32 expectedPathHash,
        Hop[] calldata hops
    ) external payable nonReentrant returns (uint256 amountOut) {
        if (msg.value == 0) revert InvalidNativeValue();
        IWrapped420AtomicRouter420(wrappedNative420).deposit{value: msg.value}();

        amountOut = _swapExactInputPath(
            msg.sender,
            address(this),
            wrappedNative420,
            msg.value,
            minFinalAmountOut,
            recipient,
            expectedPathHash,
            hops,
            false
        );
        emit NativePathExecuted(expectedPathHash, msg.sender, recipient, true, false, msg.value, amountOut);
    }

    /// @notice Executes an ERC20 exact-input path whose final asset is canonical wrapped $420, then unwraps it.
    function swapExactInputPathForNative(
        address tokenIn,
        uint256 amountIn,
        uint256 minNativeOut,
        address recipient,
        bytes32 expectedPathHash,
        Hop[] calldata hops
    ) external nonReentrant returns (uint256 amountOut) {
        if (hops.length == 0 || hops[hops.length - 1].tokenOut != wrappedNative420) revert InvalidPath();

        amountOut = _swapExactInputPath(
            msg.sender,
            msg.sender,
            tokenIn,
            amountIn,
            minNativeOut,
            recipient,
            expectedPathHash,
            hops,
            true
        );

        IWrapped420AtomicRouter420(wrappedNative420).withdraw(amountOut);
        (bool ok,) = recipient.call{value: amountOut}("");
        if (!ok) revert NativeTransferFailed();
        emit NativePathExecuted(expectedPathHash, msg.sender, recipient, false, true, amountIn, amountOut);
    }

    function _swapExactInputPath(
        address principal,
        address initialPayer,
        address tokenIn,
        uint256 amountIn,
        uint256 minFinalAmountOut,
        address recipient,
        bytes32 expectedPathHash,
        Hop[] calldata hops,
        bool unwrapFinal
    ) private returns (uint256 amountOut) {
        if (
            principal == address(0) || initialPayer == address(0) || tokenIn == address(0) || amountIn == 0
                || minFinalAmountOut == 0 || recipient == address(0) || hops.length == 0 || hops.length > MAX_HOPS
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

            (address baseToken, address quoteToken, bool inputIsBase) =
                _requireActiveMarketPair(hop.marketId, currentToken, hop.tokenOut);
            if (!authorization.canSwap(principal, hop.marketId, currentAmount)) revert UnauthorizedSwap();

            ExchangeRouteRegistry420.RouteAdapter memory route = routeRegistry.requireActive(hop.routeId);
            bool finalHop = i + 1 == hops.length;
            bool routerReceivesOutput = !finalHop || unwrapFinal;
            address hopRecipient = routerReceivesOutput ? address(this) : recipient;
            address payer = i == 0 ? initialPayer : address(this);

            uint256 inputBalanceBefore;
            address allowanceTarget;
            if (payer == address(this)) {
                inputBalanceBefore = _balanceOf(currentToken, address(this));
                if (inputBalanceBefore < currentAmount) revert IntermediateInputMismatch();
                allowanceTarget = _allowanceTarget(route.executionAdapter);
                _forceApprove(currentToken, allowanceTarget, currentAmount);
            }

            uint256 outputBalanceBefore;
            if (routerReceivesOutput) outputBalanceBefore = _balanceOf(hop.tokenOut, address(this));

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

            uint256 baseAmount = inputIsBase ? currentAmount : nextAmount;
            uint256 quoteAmount = inputIsBase ? nextAmount : currentAmount;
            oracleGuard.requireHealthyAmounts(hop.marketId, baseToken, quoteToken, baseAmount, quoteAmount);

            if (payer == address(this)) {
                _forceApprove(currentToken, allowanceTarget, 0);
                uint256 inputBalanceAfter = _balanceOf(currentToken, address(this));
                if (inputBalanceBefore - inputBalanceAfter != currentAmount) revert IntermediateInputMismatch();
            }

            if (routerReceivesOutput) {
                uint256 outputBalanceAfter = _balanceOf(hop.tokenOut, address(this));
                if (outputBalanceAfter - outputBalanceBefore != nextAmount) revert IntermediateOutputMismatch();
            }

            currentToken = hop.tokenOut;
            currentAmount = nextAmount;
        }

        if (unwrapFinal && currentToken != wrappedNative420) revert InvalidPath();
        if (currentAmount < minFinalAmountOut) revert SlippageExceeded();
        amountOut = currentAmount;

        emit AtomicPathExecuted(
            pathHash,
            principal,
            recipient,
            tokenIn,
            currentToken,
            amountIn,
            amountOut,
            hops.length
        );
    }

    function _requireActiveMarketPair(bytes32 marketId, address tokenIn, address tokenOut)
        private
        view
        returns (address baseToken, address quoteToken, bool inputIsBase)
    {
        if (!marketRegistry.isActive(marketId)) revert InactiveMarket();

        (bytes32 baseAssetId, bytes32 quoteAssetId,,,,) = marketRegistry.markets(marketId);
        (,,, baseToken,,,,,) = assetRegistry.assets(baseAssetId);
        (,,, quoteToken,,,,,) = assetRegistry.assets(quoteAssetId);
        if (baseToken == address(0) || quoteToken == address(0) || baseToken == quoteToken) revert InvalidPair();

        inputIsBase = baseToken == tokenIn && quoteToken == tokenOut;
        bool inputIsQuote = baseToken == tokenOut && quoteToken == tokenIn;
        if (!inputIsBase && !inputIsQuote) revert InvalidPair();
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
