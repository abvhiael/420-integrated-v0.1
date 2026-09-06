// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/exchange/ExchangeAtomicRouter420.sol";
import "../src/exchange/ExchangeIds420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";

contract MockReentrantCapabilityRegistry420 is ICapabilityRegistry420 {
    address public principal;
    function setPrincipal(address principal_) external { principal = principal_; }
    function grant(bytes32) external pure override returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address principal_, bytes32 componentId, bytes32 capabilityId, bytes32, uint256)
        external view override returns (bool)
    {
        return principal_ == principal && componentId == ExchangeIds420.EXCHANGE_ROUTER
            && capabilityId == ExchangeIds420.ACTION_SWAP;
    }
}

contract MockReentrantOracle420 is IExchangeReferenceOracle420 {
    function referencePrice(bytes32) external view returns (uint256, uint256) {
        return (1e18, block.timestamp);
    }
}

contract MockReentrantToken420 {
    uint8 public constant decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public callbackTarget;
    bytes public callbackData;
    bool public callbackOnTransferFrom;
    bool public callbackOnTransfer;
    bool public callbackAttempted;
    bool public callbackSucceeded;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }

    function configureCallback(address target, bytes calldata data, bool onTransferFrom, bool onTransfer) external {
        callbackTarget = target;
        callbackData = data;
        callbackOnTransferFrom = onTransferFrom;
        callbackOnTransfer = onTransfer;
        callbackAttempted = false;
        callbackSucceeded = false;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        if (callbackOnTransfer && callbackTarget != address(0)) _callback();
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        require(balanceOf[from] >= amount, "balance");
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        if (callbackOnTransferFrom && callbackTarget != address(0)) _callback();
        return true;
    }

    function _callback() private {
        callbackAttempted = true;
        (bool ok,) = callbackTarget.call(callbackData);
        callbackSucceeded = ok;
    }
}

contract MockReentrantAdapter420 is IExchangeQuoteAdapter420, IExchangeExecutionAdapter420 {
    address public immutable sink = address(0xBEEF);
    address public router;
    bytes public reentryData;
    bool public reenter;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    function configureReentry(address router_, bytes calldata data, bool enabled) external {
        router = router_;
        reentryData = data;
        reenter = enabled;
        reentryAttempted = false;
        reentrySucceeded = false;
    }

    function allowanceTarget() external view returns (address) { return address(this); }

    function quote(address, address, uint256 amountIn, bytes calldata)
        external pure override returns (uint256 amountOut, uint256 priceImpactBps)
    {
        return (amountIn, 0);
    }

    function executeSwap(
        address payer,
        address recipient,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata
    ) external override returns (uint256 amountOut) {
        if (reenter && router != address(0)) {
            reentryAttempted = true;
            (bool ok,) = router.call(reentryData);
            reentrySucceeded = ok;
        }
        require(amountIn >= minAmountOut, "slippage");
        require(MockReentrantToken420(tokenIn).transferFrom(payer, sink, amountIn), "pull");
        require(MockReentrantToken420(tokenOut).transfer(recipient, amountIn), "push");
        return amountIn;
    }
}

contract ExchangeReentrancyHardening420Test {
    bytes32 private constant A_ID = keccak256("420/exchange/reentry/A");
    bytes32 private constant B_ID = keccak256("420/exchange/reentry/B");
    bytes32 private constant MARKET = keccak256("420/exchange/reentry/AB");
    bytes32 private constant ROUTE = keccak256("420/exchange/reentry/route");

    MockReentrantCapabilityRegistry420 private caps;
    ExchangeAuthorization420 private authorization;
    ExchangeEmergencyControl420 private emergency;
    ExchangeOracleGuard420 private guard;
    ExchangeAssetRegistry420 private assets;
    ExchangeMarketRegistry420 private markets;
    ExchangeRouteRegistry420 private routes;
    ExchangeFeePolicy420 private feePolicy;
    ExchangeFeeRouter420 private feeRouter;
    ExchangeAtomicRouter420 private router;
    MockReentrantOracle420 private oracle;
    MockReentrantAdapter420 private adapter;
    MockReentrantToken420 private tokenA;
    MockReentrantToken420 private tokenB;

    constructor() {
        caps = new MockReentrantCapabilityRegistry420();
        authorization = new ExchangeAuthorization420(address(caps));
        emergency = new ExchangeEmergencyControl420(address(this));
        guard = new ExchangeOracleGuard420(address(this));
        assets = new ExchangeAssetRegistry420(address(this));
        markets = new ExchangeMarketRegistry420(address(this), address(assets), B_ID);
        routes = new ExchangeRouteRegistry420(address(this));
        feePolicy = new ExchangeFeePolicy420(address(this));
        feeRouter = new ExchangeFeeRouter420(address(this), address(feePolicy));
        oracle = new MockReentrantOracle420();
        adapter = new MockReentrantAdapter420();
        tokenA = new MockReentrantToken420();
        tokenB = new MockReentrantToken420();

        _configureAsset(A_ID, address(tokenA), bytes16("A"));
        _configureAsset(B_ID, address(tokenB), bytes16("B"));
        markets.configureMarket(MARKET, A_ID, B_ID, keccak256("canonical"), address(adapter), ExchangeTypes420.MarketStatus.ACTIVE, keccak256("meta"));
        routes.configureRoute(ROUTE, keccak256("420SWAP"), address(adapter), address(adapter), keccak256("route-meta"), true);
        guard.configureGuard(MARKET, address(oracle), 1 days, 500, true);

        router = new ExchangeAtomicRouter420(
            address(markets), address(assets), address(routes), address(authorization), address(emergency),
            address(guard), address(tokenA), address(feeRouter)
        );
        caps.setPrincipal(address(this));

        tokenA.mint(address(this), 1_000 ether);
        tokenB.mint(address(adapter), 1_000 ether);
        tokenA.approve(address(adapter), type(uint256).max);
    }

    function testVenueCannotReenterRouter() public {
        ExchangeAtomicRouter420.Hop[] memory hops = _path();
        bytes32 pathHash = router.hashPath(address(tokenA), 10 ether, address(this), hops);
        bytes memory reentry = abi.encodeWithSelector(
            router.swapExactInputPath.selector,
            address(tokenA), 1 ether, 1 ether, address(this), bytes32(uint256(1)), hops
        );
        adapter.configureReentry(address(router), reentry, true);

        uint256 beforeA = tokenA.balanceOf(address(this));
        uint256 beforeB = tokenB.balanceOf(address(this));
        uint256 amountOut = router.swapExactInputPath(address(tokenA), 10 ether, 10 ether, address(this), pathHash, hops);

        require(amountOut == 10 ether, "outer swap failed");
        require(adapter.reentryAttempted(), "reentry not attempted");
        require(!adapter.reentrySucceeded(), "venue reentry succeeded");
        require(beforeA - tokenA.balanceOf(address(this)) == 10 ether, "input mismatch");
        require(tokenB.balanceOf(address(this)) - beforeB == 10 ether, "output mismatch");
        require(tokenB.balanceOf(address(router)) == 0, "router residue");
    }

    function testInputTokenCallbackCannotReenterRouter() public {
        ExchangeAtomicRouter420.Hop[] memory hops = _path();
        bytes32 pathHash = router.hashPath(address(tokenA), 10 ether, address(this), hops);
        bytes memory reentry = abi.encodeWithSelector(
            router.swapExactInputPath.selector,
            address(tokenA), 1 ether, 1 ether, address(this), bytes32(uint256(2)), hops
        );
        tokenA.configureCallback(address(router), reentry, true, false);

        uint256 amountOut = router.swapExactInputPath(address(tokenA), 10 ether, 10 ether, address(this), pathHash, hops);
        require(amountOut == 10 ether, "outer swap failed");
        require(tokenA.callbackAttempted(), "callback not attempted");
        require(!tokenA.callbackSucceeded(), "input-token reentry succeeded");
        require(tokenB.balanceOf(address(router)) == 0, "router residue");
    }

    function testOutputTokenCallbackCannotReenterRouter() public {
        ExchangeAtomicRouter420.Hop[] memory hops = _path();
        bytes32 pathHash = router.hashPath(address(tokenA), 10 ether, address(this), hops);
        bytes memory reentry = abi.encodeWithSelector(
            router.swapExactInputPath.selector,
            address(tokenA), 1 ether, 1 ether, address(this), bytes32(uint256(3)), hops
        );
        tokenB.configureCallback(address(router), reentry, false, true);

        uint256 amountOut = router.swapExactInputPath(address(tokenA), 10 ether, 10 ether, address(this), pathHash, hops);
        require(amountOut == 10 ether, "outer swap failed");
        require(tokenB.callbackAttempted(), "callback not attempted");
        require(!tokenB.callbackSucceeded(), "output-token reentry succeeded");
        require(tokenB.balanceOf(address(router)) == 0, "router residue");
        require(tokenB.allowance(address(router), address(feeRouter)) == 0, "fee allowance residue");
    }

    function _path() private view returns (ExchangeAtomicRouter420.Hop[] memory hops) {
        hops = new ExchangeAtomicRouter420.Hop[](1);
        hops[0] = ExchangeAtomicRouter420.Hop(MARKET, ROUTE, address(tokenB), 10 ether, "");
    }

    function _configureAsset(bytes32 id, address token, bytes16 symbol) private {
        assets.configureAsset(
            id, symbol, keccak256(abi.encodePacked("chain", id)), keccak256(abi.encodePacked("asset", id)), token,
            ExchangeTypes420.AssetCategory.OTHER, ExchangeTypes420.AssetStatus.VERIFIED,
            keccak256(abi.encodePacked("verify", id)), keccak256(abi.encodePacked("meta", id))
        );
    }
}
