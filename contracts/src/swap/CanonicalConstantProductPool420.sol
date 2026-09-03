// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IERC20CanonicalPool420 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Canonical constant-product liquidity pool for 420Swap spot execution.
/// @dev ERC20/ERC20 V1 pool. Native $420 wrapping/value-path support is intentionally deferred.
contract CanonicalConstantProductPool420 {
    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 private constant MINIMUM_LIQUIDITY = 1_000;

    address public immutable token0;
    address public immutable token1;
    address public immutable executor;
    uint16 public immutable feeBps;

    uint256 public reserve0;
    uint256 public reserve1;
    uint256 public totalShares;
    mapping(address => uint256) public shares;

    uint256 private _entered;

    error InvalidAddress();
    error InvalidPair();
    error InvalidAmount();
    error UnauthorizedExecutor();
    error TransferFailed();
    error UnsupportedTokenBehavior();
    error InsufficientLiquidity();
    error SlippageExceeded();
    error Reentrancy();

    event LiquidityAdded(address indexed provider, uint256 amount0, uint256 amount1, uint256 sharesMinted);
    event LiquidityRemoved(address indexed provider, address indexed recipient, uint256 amount0, uint256 amount1, uint256 sharesBurned);
    event Swap(
        address indexed payer,
        address indexed recipient,
        address indexed tokenIn,
        uint256 amountIn,
        uint256 amountOut,
        uint256 feeAmount
    );
    event Sync(uint256 reserve0, uint256 reserve1);

    constructor(address token0_, address token1_, address executor_, uint16 feeBps_) {
        if (token0_ == address(0) || token1_ == address(0) || executor_ == address(0)) revert InvalidAddress();
        if (token0_ == token1_) revert InvalidPair();
        if (token0_.code.length == 0 || token1_.code.length == 0 || executor_.code.length == 0) revert InvalidAddress();
        if (feeBps_ > 100) revert InvalidAmount();
        token0 = token0_;
        token1 = token1_;
        executor = executor_;
        feeBps = feeBps_;
    }

    modifier nonReentrant() {
        if (_entered != 0) revert Reentrancy();
        _entered = 1;
        _;
        _entered = 0;
    }

    function addLiquidity(uint256 amount0Desired, uint256 amount1Desired, uint256 minShares, address recipient)
        external
        nonReentrant
        returns (uint256 sharesMinted)
    {
        if (amount0Desired == 0 || amount1Desired == 0 || recipient == address(0)) revert InvalidAmount();

        _sync();
        uint256 r0 = reserve0;
        uint256 r1 = reserve1;
        _pullExact(token0, msg.sender, amount0Desired);
        _pullExact(token1, msg.sender, amount1Desired);

        if (totalShares == 0) {
            uint256 root = _sqrt(amount0Desired * amount1Desired);
            if (root <= MINIMUM_LIQUIDITY) revert InsufficientLiquidity();
            sharesMinted = root - MINIMUM_LIQUIDITY;
            totalShares = root;
            shares[address(0)] = MINIMUM_LIQUIDITY;
        } else {
            if (r0 == 0 || r1 == 0) revert InsufficientLiquidity();
            uint256 shares0 = amount0Desired * totalShares / r0;
            uint256 shares1 = amount1Desired * totalShares / r1;
            sharesMinted = shares0 < shares1 ? shares0 : shares1;
            if (sharesMinted == 0) revert InsufficientLiquidity();
            totalShares += sharesMinted;
        }

        if (sharesMinted < minShares) revert SlippageExceeded();
        shares[recipient] += sharesMinted;
        _sync();
        emit LiquidityAdded(recipient, amount0Desired, amount1Desired, sharesMinted);
    }

    function removeLiquidity(uint256 sharesBurned, uint256 minAmount0, uint256 minAmount1, address recipient)
        external
        nonReentrant
        returns (uint256 amount0, uint256 amount1)
    {
        if (sharesBurned == 0 || recipient == address(0) || shares[msg.sender] < sharesBurned) revert InvalidAmount();
        _sync();
        uint256 supply = totalShares;
        amount0 = reserve0 * sharesBurned / supply;
        amount1 = reserve1 * sharesBurned / supply;
        if (amount0 == 0 || amount1 == 0) revert InsufficientLiquidity();
        if (amount0 < minAmount0 || amount1 < minAmount1) revert SlippageExceeded();

        shares[msg.sender] -= sharesBurned;
        totalShares = supply - sharesBurned;
        _pushExact(token0, recipient, amount0);
        _pushExact(token1, recipient, amount1);
        _sync();
        emit LiquidityRemoved(msg.sender, recipient, amount0, amount1, sharesBurned);
    }

    function quoteCanonicalSwap(address tokenIn, address tokenOut, uint256 amountIn)
        external
        view
        returns (uint256 amountOut, uint256 priceImpactBps)
    {
        (uint256 reserveIn, uint256 reserveOut) = _reservesFor(tokenIn, tokenOut);
        amountOut = _quote(reserveIn, reserveOut, amountIn);
        if (amountOut == 0) revert InsufficientLiquidity();

        uint256 spotOut = amountIn * reserveOut / reserveIn;
        if (spotOut > amountOut && spotOut != 0) {
            priceImpactBps = (spotOut - amountOut) * BPS_DENOMINATOR / spotOut;
        }
    }

    function executeCanonicalSwap(
        address payer,
        address recipient,
        address inputAsset,
        address settlementAsset,
        uint256 inputAmount,
        uint256 exactSettlementAmount
    ) external nonReentrant returns (uint256 inputSpent, uint256 settlementDelivered) {
        if (msg.sender != executor) revert UnauthorizedExecutor();
        if (payer == address(0) || recipient == address(0) || inputAmount == 0 || exactSettlementAmount == 0) {
            revert InvalidAmount();
        }

        _sync();
        (uint256 reserveIn, uint256 reserveOut) = _reservesFor(inputAsset, settlementAsset);
        settlementDelivered = _quote(reserveIn, reserveOut, inputAmount);
        if (settlementDelivered < exactSettlementAmount) revert SlippageExceeded();
        if (settlementDelivered == 0 || settlementDelivered >= reserveOut) revert InsufficientLiquidity();

        _pullExact(inputAsset, payer, inputAmount);
        _pushExact(settlementAsset, recipient, settlementDelivered);
        _sync();

        inputSpent = inputAmount;
        uint256 feeAmount = inputAmount * feeBps / BPS_DENOMINATOR;
        emit Swap(payer, recipient, inputAsset, inputAmount, settlementDelivered, feeAmount);
    }

    function _reservesFor(address tokenIn, address tokenOut) private view returns (uint256 reserveIn, uint256 reserveOut) {
        if (tokenIn == token0 && tokenOut == token1) return (reserve0, reserve1);
        if (tokenIn == token1 && tokenOut == token0) return (reserve1, reserve0);
        revert InvalidPair();
    }

    function _reserveFor(address token) private view returns (uint256 reserve) {
        if (token == token0) return reserve0;
        if (token == token1) return reserve1;
        revert InvalidPair();
    }

    function _quote(uint256 reserveIn, uint256 reserveOut, uint256 amountIn) private view returns (uint256 amountOut) {
        if (amountIn == 0 || reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();
        uint256 amountInAfterFee = amountIn * (BPS_DENOMINATOR - feeBps);
        uint256 denominator = reserveIn * BPS_DENOMINATOR + amountInAfterFee;
        amountOut = amountInAfterFee * reserveOut / denominator;
    }

    function _pullExact(address token, address from, uint256 amount) private {
        uint256 expectedBalance = _reserveFor(token) + amount;
        if (!IERC20CanonicalPool420(token).transferFrom(from, address(this), amount)) revert TransferFailed();
        if (IERC20CanonicalPool420(token).balanceOf(address(this)) != expectedBalance) revert UnsupportedTokenBehavior();
    }

    function _pushExact(address token, address to, uint256 amount) private {
        uint256 reserve = _reserveFor(token);
        if (amount > reserve) revert InsufficientLiquidity();
        uint256 expectedBalance = reserve - amount;
        if (!IERC20CanonicalPool420(token).transfer(to, amount)) revert TransferFailed();
        if (IERC20CanonicalPool420(token).balanceOf(address(this)) != expectedBalance) revert UnsupportedTokenBehavior();
    }

    function _sync() private {
        reserve0 = IERC20CanonicalPool420(token0).balanceOf(address(this));
        reserve1 = IERC20CanonicalPool420(token1).balanceOf(address(this));
        emit Sync(reserve0, reserve1);
    }

    function _sqrt(uint256 y) private pure returns (uint256 z) {
        if (y == 0) return 0;
        z = y;
        uint256 x = y / 2 + 1;
        while (x < z) {
            z = x;
            x = (y / x + x) / 2;
        }
    }
}
