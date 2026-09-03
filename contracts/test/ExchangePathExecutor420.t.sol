// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/exchange/ExchangePathExecutor420.sol";
import "../src/exchange/ExchangeIds420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";

contract MockExchangePathToken420 {}

contract MockCapabilityRegistryExchangePath420 is ICapabilityRegistry420 {
    address public allowedPrincipal;
    bytes32 public blockedScope;
    bool public enabled = true;

    function setPrincipal(address principal) external { allowedPrincipal = principal; }
    function setBlockedScope(bytes32 scope) external { blockedScope = scope; }
    function setEnabled(bool enabled_) external { enabled = enabled_; }
    function grant(bytes32) external pure override returns (CapabilityGrant memory g) { return g; }

    function isAuthorized(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scope,
        uint256 amount
    ) external view override returns (bool) {
        return enabled && principal == allowedPrincipal
            && componentId == ExchangeIds420.EXCHANGE_ROUTER
            && capabilityId == ExchangeIds420.ACTION_SWAP
            && scope != blockedScope
            && amount <= 1_000 ether;
    }
}

contract MockExchangePathAdapter420 is IExchangeQuoteAdapter420, IExchangeExecutionAdapter420 {
    uint256 public output;
    address public lastPayer;
    address public lastRecipient;
    address public lastTokenIn;
    address public lastTokenOut;
    uint256 public lastAmountIn;

    constructor(uint256 output_) { output = output_; }

    function setOutput(uint256 output_) external { output = output_; }

    function quote(address, address, uint256, bytes calldata)
        external
        view
        override
        returns (uint256 amountOut, uint256 priceImpactBps)
    {
        return (output, 25);
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
        require(payer != address(0) && recipient != address(0), "party");
        require(tokenIn != address(0) && tokenOut != address(0) && tokenIn != tokenOut, "pair");
        require(amountIn != 0 && output >= minAmountOut, "amount");
        lastPayer = payer;
        lastRecipient = recipient;
        lastTokenIn = tokenIn;
        lastTokenOut = tokenOut;
        lastAmountIn = amountIn;
        return output;
    }
}

contract ExchangePathExecutor420Test {
    bytes32 private constant ASSET_A = keccak256("420/exchange/v6/asset-a");
    bytes32 private constant ASSET_B = keccak256("420/exchange/v6/asset-b");
    bytes32 private constant ASSET_C = keccak256("420/exchange/v6/asset-c");
    bytes32 private constant MARKET_AB = keccak256("420/exchange/v6/market-ab");
    bytes32 private constant MARKET_BC = keccak256("420/exchange/v6/market-bc");
    bytes32 private constant ROUTE_AB = keccak256("420/exchange/v6/route-ab");
    bytes32 private constant ROUTE_BC = keccak256("420/exchange/v6/route-bc");

    MockCapabilityRegistryExchangePath420 private caps;
    ExchangeAuthorization420 private authorization;
    ExchangeEmergencyControl420 private emergencyControl;
    ExchangeAssetRegistry420 private assetRegistry;
    ExchangeMarketRegistry420 private marketRegistry;
    ExchangeRouteRegistry420 private routeRegistry;
    ExchangePathExecutor420 private executor;
    MockExchangePathAdapter420 private adapterAB;
    MockExchangePathAdapter420 private adapterBC;
    MockExchangePathToken420 private tokenA;
    MockExchangePathToken420 private tokenB;
    MockExchangePathToken420 private tokenC;

    constructor() {
        caps = new MockCapabilityRegistryExchangePath420();
        authorization = new ExchangeAuthorization420(address(caps));
        emergencyControl = new ExchangeEmergencyControl420(address(this));
        assetRegistry = new ExchangeAssetRegistry420(address(this));
        marketRegistry = new ExchangeMarketRegistry420(address(this), address(assetRegistry), ASSET_B);
        routeRegistry = new ExchangeRouteRegistry420(address(this));
        adapterAB = new MockExchangePathAdapter420(80 ether);
        adapterBC = new MockExchangePathAdapter420(70 ether);
        tokenA = new MockExchangePathToken420();
        tokenB = new MockExchangePathToken420();
        tokenC = new MockExchangePathToken420();

        _configureAsset(ASSET_A, bytes16("A"), address(tokenA));
        _configureAsset(ASSET_B, bytes16("B"), address(tokenB));
        _configureAsset(ASSET_C, bytes16("C"), address(tokenC));

        marketRegistry.configureMarket(
            MARKET_AB,
            ASSET_A,
            ASSET_B,
            keccak256("execution-ab"),
            address(adapterAB),
            ExchangeTypes420.MarketStatus.ACTIVE,
            keccak256("market-ab")
        );
        marketRegistry.configureMarket(
            MARKET_BC,
            ASSET_B,
            ASSET_C,
            keccak256("execution-bc"),
            address(adapterBC),
            ExchangeTypes420.MarketStatus.ACTIVE,
            keccak256("market-bc")
        );

        routeRegistry.configureRoute(
            ROUTE_AB,
            keccak256("VENUE_AB"),
            address(adapterAB),
            address(adapterAB),
            keccak256("route-ab"),
            true
        );
        routeRegistry.configureRoute(
            ROUTE_BC,
            keccak256("VENUE_BC"),
            address(adapterBC),
            address(adapterBC),
            keccak256("route-bc"),
            true
        );

        executor = new ExchangePathExecutor420(
            address(marketRegistry),
            address(assetRegistry),
            address(routeRegistry),
            address(authorization),
            address(emergencyControl)
        );
        caps.setPrincipal(address(this));
    }

    function testExecutesTwoHopPathWithoutExecutorCustody() public {
        ExchangePathExecutor420.Hop[] memory hops = _twoHopPath(75 ether, 65 ether);
        address finalRecipient = address(0xBEEF);
        bytes32 pathHash = executor.hashPath(
            address(this), address(tokenA), 100 ether, 65 ether, finalRecipient, hops
        );

        uint256 amountOut = executor.executeExactInputPath(
            address(tokenA), 100 ether, 65 ether, finalRecipient, pathHash, hops
        );

        require(amountOut == 70 ether, "final amount");
        require(adapterAB.lastPayer() == address(this), "hop1 payer");
        require(adapterAB.lastRecipient() == address(this), "hop1 intermediate recipient");
        require(adapterAB.lastAmountIn() == 100 ether, "hop1 amount");
        require(adapterBC.lastPayer() == address(this), "hop2 payer");
        require(adapterBC.lastRecipient() == finalRecipient, "hop2 recipient");
        require(adapterBC.lastAmountIn() == 80 ether, "hop2 chained amount");
    }

    function testRejectsTamperedPathHash() public {
        ExchangePathExecutor420.Hop[] memory hops = _twoHopPath(75 ether, 65 ether);
        (bool ok,) = address(executor).call(
            abi.encodeWithSelector(
                executor.executeExactInputPath.selector,
                address(tokenA),
                100 ether,
                65 ether,
                address(this),
                keccak256("wrong-path"),
                hops
            )
        );
        require(!ok, "tampered path accepted");
    }

    function testPerHopSlippageFailsClosed() public {
        ExchangePathExecutor420.Hop[] memory hops = _twoHopPath(81 ether, 65 ether);
        bytes32 pathHash = executor.hashPath(
            address(this), address(tokenA), 100 ether, 65 ether, address(this), hops
        );
        (bool ok,) = address(executor).call(
            abi.encodeWithSelector(
                executor.executeExactInputPath.selector,
                address(tokenA),
                100 ether,
                65 ether,
                address(this),
                pathHash,
                hops
            )
        );
        require(!ok, "hop slippage accepted");
    }

    function testFinalSlippageFailsClosed() public {
        ExchangePathExecutor420.Hop[] memory hops = _twoHopPath(75 ether, 60 ether);
        bytes32 pathHash = executor.hashPath(
            address(this), address(tokenA), 100 ether, 71 ether, address(this), hops
        );
        (bool ok,) = address(executor).call(
            abi.encodeWithSelector(
                executor.executeExactInputPath.selector,
                address(tokenA),
                100 ether,
                71 ether,
                address(this),
                pathHash,
                hops
            )
        );
        require(!ok, "final slippage accepted");
    }

    function testAuthorizationCheckedForEveryMarket() public {
        ExchangePathExecutor420.Hop[] memory hops = _twoHopPath(75 ether, 65 ether);
        caps.setBlockedScope(authorization.scopeMarket(MARKET_BC));
        bytes32 pathHash = executor.hashPath(
            address(this), address(tokenA), 100 ether, 65 ether, address(this), hops
        );
        (bool ok,) = address(executor).call(
            abi.encodeWithSelector(
                executor.executeExactInputPath.selector,
                address(tokenA),
                100 ether,
                65 ether,
                address(this),
                pathHash,
                hops
            )
        );
        require(!ok, "unauthorized second hop accepted");
        caps.setBlockedScope(bytes32(0));
    }

    function testInactiveMarketFailsClosed() public {
        marketRegistry.setStatus(MARKET_BC, ExchangeTypes420.MarketStatus.SUSPENDED);
        ExchangePathExecutor420.Hop[] memory hops = _twoHopPath(75 ether, 65 ether);
        bytes32 pathHash = executor.hashPath(
            address(this), address(tokenA), 100 ether, 65 ether, address(this), hops
        );
        (bool ok,) = address(executor).call(
            abi.encodeWithSelector(
                executor.executeExactInputPath.selector,
                address(tokenA),
                100 ether,
                65 ether,
                address(this),
                pathHash,
                hops
            )
        );
        require(!ok, "inactive market accepted");
        marketRegistry.setStatus(MARKET_BC, ExchangeTypes420.MarketStatus.ACTIVE);
    }

    function testInvalidMarketPairFailsClosed() public {
        ExchangePathExecutor420.Hop[] memory hops = _twoHopPath(75 ether, 65 ether);
        hops[1].tokenOut = address(tokenA);
        bytes32 pathHash = executor.hashPath(
            address(this), address(tokenA), 100 ether, 65 ether, address(this), hops
        );
        (bool ok,) = address(executor).call(
            abi.encodeWithSelector(
                executor.executeExactInputPath.selector,
                address(tokenA),
                100 ether,
                65 ether,
                address(this),
                pathHash,
                hops
            )
        );
        require(!ok, "invalid market pair accepted");
    }

    function testEmergencyHaltFailsClosed() public {
        emergencyControl.setHalt(
            ExchangeEmergencyControl420.Domain.SWAPS,
            true,
            keccak256("v6-incident")
        );
        ExchangePathExecutor420.Hop[] memory hops = _twoHopPath(75 ether, 65 ether);
        bytes32 pathHash = executor.hashPath(
            address(this), address(tokenA), 100 ether, 65 ether, address(this), hops
        );
        (bool ok,) = address(executor).call(
            abi.encodeWithSelector(
                executor.executeExactInputPath.selector,
                address(tokenA),
                100 ether,
                65 ether,
                address(this),
                pathHash,
                hops
            )
        );
        require(!ok, "halted path accepted");
        emergencyControl.setHalt(ExchangeEmergencyControl420.Domain.SWAPS, false, bytes32(0));
    }

    function testRejectsPathOverHopBound() public {
        ExchangePathExecutor420.Hop[] memory hops = new ExchangePathExecutor420.Hop[](5);
        for (uint256 i = 0; i < 5; ++i) {
            hops[i] = ExchangePathExecutor420.Hop({
                marketId: MARKET_AB,
                routeId: ROUTE_AB,
                tokenOut: address(tokenB),
                minAmountOut: 1,
                routeData: abi.encode(bytes32(i + 1))
            });
        }
        (bool ok,) = address(executor).call(
            abi.encodeWithSelector(
                executor.executeExactInputPath.selector,
                address(tokenA),
                100 ether,
                1,
                address(this),
                bytes32(uint256(1)),
                hops
            )
        );
        require(!ok, "oversized path accepted");
    }

    function _twoHopPath(uint256 minAB, uint256 minBC)
        private
        view
        returns (ExchangePathExecutor420.Hop[] memory hops)
    {
        hops = new ExchangePathExecutor420.Hop[](2);
        hops[0] = ExchangePathExecutor420.Hop({
            marketId: MARKET_AB,
            routeId: ROUTE_AB,
            tokenOut: address(tokenB),
            minAmountOut: minAB,
            routeData: abi.encode(bytes32("ab"))
        });
        hops[1] = ExchangePathExecutor420.Hop({
            marketId: MARKET_BC,
            routeId: ROUTE_BC,
            tokenOut: address(tokenC),
            minAmountOut: minBC,
            routeData: abi.encode(bytes32("bc"))
        });
    }

    function _configureAsset(bytes32 assetId, bytes16 symbol, address token) private {
        assetRegistry.configureAsset(
            assetId,
            symbol,
            keccak256("CHAIN"),
            assetId,
            token,
            ExchangeTypes420.AssetCategory.CANNABIS,
            ExchangeTypes420.AssetStatus.VERIFIED,
            keccak256(abi.encode("verification", assetId)),
            keccak256(abi.encode("metadata", assetId))
        );
    }
}
