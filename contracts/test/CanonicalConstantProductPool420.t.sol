// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/swap/CanonicalConstantProductPool420.sol";

contract MockERC20CanonicalPool420 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "balance");
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract CanonicalPoolExecutorMock420 {
    function execute(
        address pool,
        address payer,
        address recipient,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256 inputSpent, uint256 settlementDelivered) {
        return CanonicalConstantProductPool420(pool).executeCanonicalSwap(
            payer,
            recipient,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut
        );
    }

    function tryExecute(
        address pool,
        address payer,
        address recipient,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (bool ok) {
        (ok,) = pool.call(
            abi.encodeWithSignature(
                "executeCanonicalSwap(address,address,address,address,uint256,uint256)",
                payer,
                recipient,
                tokenIn,
                tokenOut,
                amountIn,
                minAmountOut
            )
        );
    }
}

contract UnauthorizedPoolCaller420 {
    function execute(address pool, address payer, address recipient, address tokenIn, address tokenOut)
        external
        returns (bool ok)
    {
        (ok,) = pool.call(
            abi.encodeWithSignature(
                "executeCanonicalSwap(address,address,address,address,uint256,uint256)",
                payer,
                recipient,
                tokenIn,
                tokenOut,
                1 ether,
                1
            )
        );
    }
}

contract CanonicalConstantProductPool420Test {
    MockERC20CanonicalPool420 private token0;
    MockERC20CanonicalPool420 private token1;
    CanonicalPoolExecutorMock420 private executor;
    CanonicalConstantProductPool420 private pool;

    constructor() {
        token0 = new MockERC20CanonicalPool420();
        token1 = new MockERC20CanonicalPool420();
        executor = new CanonicalPoolExecutorMock420();
        pool = new CanonicalConstantProductPool420(address(token0), address(token1), address(executor), 30);

        token0.mint(address(this), 2_000_000 ether);
        token1.mint(address(this), 2_000_000 ether);
        token0.approve(address(pool), type(uint256).max);
        token1.approve(address(pool), type(uint256).max);
    }

    function _seed() private returns (uint256 minted) {
        minted = pool.addLiquidity(1_000_000 ether, 1_000_000 ether, 1, address(this));
    }

    function testInitialLiquidityMintsLockedMinimumAndProviderShares() public {
        uint256 minted = _seed();
        require(minted > 0, "shares");
        require(pool.totalShares() == minted + 1_000, "minimum liquidity");
        require(pool.shares(address(this)) == minted, "provider shares");
        require(pool.reserve0() == 1_000_000 ether && pool.reserve1() == 1_000_000 ether, "reserves");
    }

    function testQuoteAndExecuteConserveProductAfterFee() public {
        _seed();
        uint256 kBefore = pool.reserve0() * pool.reserve1();
        (uint256 quoted,) = pool.quoteCanonicalSwap(address(token0), address(token1), 10_000 ether);
        require(quoted > 0 && quoted < 10_000 ether, "quote");

        uint256 recipientBefore = token1.balanceOf(address(this));
        (uint256 spent, uint256 delivered) = executor.execute(
            address(pool),
            address(this),
            address(this),
            address(token0),
            address(token1),
            10_000 ether,
            quoted
        );

        require(spent == 10_000 ether && delivered == quoted, "execution");
        require(token1.balanceOf(address(this)) == recipientBefore + quoted, "recipient");
        require(pool.reserve0() * pool.reserve1() >= kBefore, "constant product");
    }

    function testSlippageMinimumFailsClosed() public {
        _seed();
        (uint256 quoted,) = pool.quoteCanonicalSwap(address(token0), address(token1), 1_000 ether);
        bool ok = executor.tryExecute(
            address(pool),
            address(this),
            address(this),
            address(token0),
            address(token1),
            1_000 ether,
            quoted + 1
        );
        require(!ok, "slippage accepted");
    }

    function testUnauthorizedExecutorCannotTrade() public {
        _seed();
        UnauthorizedPoolCaller420 attacker = new UnauthorizedPoolCaller420();
        bool ok = attacker.execute(address(pool), address(this), address(this), address(token0), address(token1));
        require(!ok, "unauthorized executor");
    }

    function testLiquidityRemovalIsProRataAndBounded() public {
        uint256 minted = _seed();
        uint256 burn = minted / 4;
        uint256 before0 = token0.balanceOf(address(this));
        uint256 before1 = token1.balanceOf(address(this));
        (uint256 amount0, uint256 amount1) = pool.removeLiquidity(burn, 1, 1, address(this));
        require(amount0 > 0 && amount1 > 0, "amounts");
        require(token0.balanceOf(address(this)) == before0 + amount0, "token0");
        require(token1.balanceOf(address(this)) == before1 + amount1, "token1");
        require(pool.shares(address(this)) == minted - burn, "shares burned");
    }
}
