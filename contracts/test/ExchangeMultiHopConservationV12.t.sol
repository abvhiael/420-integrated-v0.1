// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/exchange/ExchangeAtomicRouter420.sol";
import "../src/exchange/ExchangeIds420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";

contract V12ConservationToken420 {
    uint8 public constant decimals = 18;
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
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        require(balanceOf[from] >= amount, "balance");
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract V12ConservationCaps420 is ICapabilityRegistry420 {
    address public principal;
    constructor(address principal_) { principal = principal_; }
    function grant(bytes32) external pure override returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address principal_, bytes32 componentId, bytes32 capabilityId, bytes32, uint256 amount)
        external view override returns (bool)
    {
        return principal_ == principal
            && componentId == ExchangeIds420.EXCHANGE_ROUTER
            && capabilityId == ExchangeIds420.ACTION_SWAP
            && amount <= 1_000 ether;
    }
}

contract V12ConservationOracle420 is IExchangeReferenceOracle420 {
    function referencePrice(bytes32) external view returns (uint256, uint256) {
        return (1e18, block.timestamp);
    }
}

contract V12ConservationAdapter420 is IExchangeQuoteAdapter420, IExchangeExecutionAdapter420 {
    address public immutable sink = address(0xBEEF);

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
        bytes calldata routeData
    ) external override returns (uint256 amountOut) {
        require(amountIn >= minAmountOut, "slippage");
        uint8 mode = routeData.length == 0 ? 0 : uint8(routeData[0]);
        uint256 pullAmount = mode == 1 ? amountIn - 1 : amountIn;
        require(V12ConservationToken420(tokenIn).transferFrom(payer, sink, pullAmount), "pull");
        require(V12ConservationToken420(tokenOut).transfer(recipient, amountIn), "push");
        return amountIn;
    }
}

contract ExchangeMultiHopConservationV12Test {
    bytes32 private constant A = keccak256("v12/conservation/A");
    bytes32 private constant B = keccak256("v12/conservation/B");
    bytes32 private constant C = keccak256("v12/conservation/C");
    bytes32 private constant D = keccak256("v12/conservation/D");
    bytes32 private constant E = keccak256("v12/conservation/E");
    bytes32 private constant AB = keccak256("v12/conservation/AB");
    bytes32 private constant BC = keccak256("v12/conservation/BC");
    bytes32 private constant CD = keccak256("v12/conservation/CD");
    bytes32 private constant DE = keccak256("v12/conservation/DE");
    bytes32 private constant ROUTE = keccak256("v12/conservation/route");

    V12ConservationToken420 private tokenA;
    V12ConservationToken420 private tokenB;
    V12ConservationToken420 private tokenC;
    V12ConservationToken420 private tokenD;
    V12ConservationToken420 private tokenE;
    V12ConservationAdapter420 private adapter;
    ExchangeAtomicRouter420 private router;

    constructor() {
        tokenA = new V12ConservationToken420();
        tokenB = new V12ConservationToken420();
        tokenC = new V12ConservationToken420();
        tokenD = new V12ConservationToken420();
        tokenE = new V12ConservationToken420();
        adapter = new V12ConservationAdapter420();

        V12ConservationCaps420 caps = new V12ConservationCaps420(address(this));
        ExchangeAuthorization420 auth = new ExchangeAuthorization420(address(caps));
        ExchangeEmergencyControl420 emergency = new ExchangeEmergencyControl420(address(this));
        ExchangeOracleGuard420 guard = new ExchangeOracleGuard420(address(this));
        ExchangeAssetRegistry420 assets = new ExchangeAssetRegistry420(address(this));
        ExchangeMarketRegistry420 markets = new ExchangeMarketRegistry420(address(this), address(assets), E);
        ExchangeRouteRegistry420 routes = new ExchangeRouteRegistry420(address(this));
        ExchangeFeePolicy420 feePolicy = new ExchangeFeePolicy420(address(this));
        ExchangeFeeRouter420 feeRouter = new ExchangeFeeRouter420(address(this), address(feePolicy));
        V12ConservationOracle420 oracle = new V12ConservationOracle420();

        _asset(assets, A, address(tokenA), bytes16("A"));
        _asset(assets, B, address(tokenB), bytes16("B"));
        _asset(assets, C, address(tokenC), bytes16("C"));
        _asset(assets, D, address(tokenD), bytes16("D"));
        _asset(assets, E, address(tokenE), bytes16("E"));
        _market(markets, AB, A, B);
        _market(markets, BC, B, C);
        _market(markets, CD, C, D);
        _market(markets, DE, D, E);
        routes.configureRoute(ROUTE, keccak256("420SWAP"), address(adapter), address(adapter), keccak256("v12"), true);

        guard.configureGuard(AB, address(oracle), 1 days, 500, true);
        guard.configureGuard(BC, address(oracle), 1 days, 500, true);
        guard.configureGuard(CD, address(oracle), 1 days, 500, true);
        guard.configureGuard(DE, address(oracle), 1 days, 500, true);

        router = new ExchangeAtomicRouter420(
            address(markets), address(assets), address(routes), address(auth), address(emergency), address(guard),
            address(tokenA), address(feeRouter)
        );

        tokenA.mint(address(this), 2_000 ether);
        tokenB.mint(address(adapter), 10_000 ether);
        tokenC.mint(address(adapter), 10_000 ether);
        tokenD.mint(address(adapter), 10_000 ether);
        tokenE.mint(address(adapter), 10_000 ether);
        tokenA.approve(address(adapter), type(uint256).max);
    }

    function testOneThroughFourHopPathsLeaveNoCustodyOrAllowanceResidue() public {
        for (uint256 hops = 1; hops <= 4; ++hops) {
            ExchangeAtomicRouter420.Hop[] memory path = _path(hops, false);
            bytes32 hash = router.hashPath(address(tokenA), 100 ether, address(this), path);
            address finalToken = _tokenAt(hops);
            uint256 beforeOut = V12ConservationToken420(finalToken).balanceOf(address(this));

            uint256 out = router.swapExactInputPath(address(tokenA), 100 ether, 95 ether, address(this), hash, path);
            require(out == 100 ether, "output mismatch");
            require(V12ConservationToken420(finalToken).balanceOf(address(this)) - beforeOut == 100 ether, "recipient mismatch");
            _assertRouterClean();
        }
    }

    function testBrokenMiddleHopRollsBackWholeFourHopPath() public {
        ExchangeAtomicRouter420.Hop[] memory path = _path(4, true);
        bytes32 hash = router.hashPath(address(tokenA), 100 ether, address(this), path);
        uint256 beforeA = tokenA.balanceOf(address(this));
        uint256 beforeE = tokenE.balanceOf(address(this));

        (bool ok,) = address(router).call(
            abi.encodeWithSelector(router.swapExactInputPath.selector, address(tokenA), 100 ether, 95 ether, address(this), hash, path)
        );
        require(!ok, "broken conservation accepted");
        require(tokenA.balanceOf(address(this)) == beforeA, "input did not roll back");
        require(tokenE.balanceOf(address(this)) == beforeE, "output did not roll back");
        _assertRouterClean();
    }

    function _path(uint256 count, bool breakThird) private view returns (ExchangeAtomicRouter420.Hop[] memory p) {
        p = new ExchangeAtomicRouter420.Hop[](count);
        p[0] = ExchangeAtomicRouter420.Hop(AB, ROUTE, address(tokenB), 95 ether, "");
        if (count > 1) p[1] = ExchangeAtomicRouter420.Hop(BC, ROUTE, address(tokenC), 95 ether, "");
        if (count > 2) p[2] = ExchangeAtomicRouter420.Hop(CD, ROUTE, address(tokenD), 95 ether, breakThird ? hex"01" : bytes(""));
        if (count > 3) p[3] = ExchangeAtomicRouter420.Hop(DE, ROUTE, address(tokenE), 95 ether, "");
    }

    function _tokenAt(uint256 hopCount) private view returns (address) {
        if (hopCount == 1) return address(tokenB);
        if (hopCount == 2) return address(tokenC);
        if (hopCount == 3) return address(tokenD);
        return address(tokenE);
    }

    function _assertRouterClean() private view {
        V12ConservationToken420[5] memory ts = [tokenA, tokenB, tokenC, tokenD, tokenE];
        for (uint256 i = 0; i < ts.length; ++i) {
            require(ts[i].balanceOf(address(router)) == 0, "router residue");
            require(ts[i].allowance(address(router), address(adapter)) == 0, "adapter allowance residue");
        }
    }

    function _asset(ExchangeAssetRegistry420 assets, bytes32 id, address token, bytes16 symbol) private {
        assets.configureAsset(
            id, symbol, keccak256(abi.encodePacked("chain", id)), keccak256(abi.encodePacked("asset", id)), token,
            ExchangeTypes420.AssetCategory.OTHER, ExchangeTypes420.AssetStatus.VERIFIED,
            keccak256(abi.encodePacked("verification", id)), keccak256(abi.encodePacked("metadata", id))
        );
    }

    function _market(ExchangeMarketRegistry420 markets, bytes32 id, bytes32 base, bytes32 quote) private {
        markets.configureMarket(
            id, base, quote, keccak256(abi.encodePacked("canonical", id)), address(adapter),
            ExchangeTypes420.MarketStatus.ACTIVE, keccak256(abi.encodePacked("metadata", id))
        );
    }
}
