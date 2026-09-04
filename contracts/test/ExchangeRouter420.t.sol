// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/exchange/ExchangeRouter420.sol";
import "../src/exchange/ExchangeIds420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";

contract MockExchangeToken420 {}

contract MockCapabilityRegistryExchangeRouter420 is ICapabilityRegistry420 {
    address public allowedPrincipal;
    bool public enabled = true;

    function setPrincipal(address principal) external { allowedPrincipal = principal; }
    function setEnabled(bool enabled_) external { enabled = enabled_; }
    function grant(bytes32) external pure override returns (CapabilityGrant memory g) { return g; }

    function isAuthorized(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32,
        uint256 amount
    ) external view override returns (bool) {
        return enabled && principal == allowedPrincipal
            && componentId == ExchangeIds420.EXCHANGE_ROUTER
            && capabilityId == ExchangeIds420.ACTION_SWAP
            && amount <= 1_000 ether;
    }
}

contract MockExchangeRouteAdapter420 is IExchangeQuoteAdapter420, IExchangeExecutionAdapter420 {
    uint256 public output = 95 ether;

    function setOutput(uint256 output_) external { output = output_; }

    function quote(address, address, uint256, bytes calldata)
        external
        view
        override
        returns (uint256 amountOut, uint256 priceImpactBps)
    {
        return (output, 50);
    }

    function executeSwap(
        address payer,
        address recipient,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata
    ) external view override returns (uint256 amountOut) {
        require(payer != address(0) && recipient != address(0), "party");
        require(tokenIn != address(0) && tokenOut != address(0) && tokenIn != tokenOut, "pair");
        require(amountIn != 0 && output >= minAmountOut, "amount");
        return output;
    }
}

contract ExchangeRouter420Test {
    bytes32 private constant BASE_ID = keccak256("420/exchange/test/base");
    bytes32 private constant QUOTE_ID = keccak256("420/exchange/test/420");
    bytes32 private constant MARKET_ID = keccak256("420/exchange/test/market");
    bytes32 private constant ROUTE_ID = keccak256("420/exchange/test/route");

    MockCapabilityRegistryExchangeRouter420 private caps;
    ExchangeAuthorization420 private authorization;
    ExchangeEmergencyControl420 private emergencyControl;
    ExchangeAssetRegistry420 private assetRegistry;
    ExchangeMarketRegistry420 private marketRegistry;
    ExchangeRouteRegistry420 private routeRegistry;
    MockExchangeRouteAdapter420 private adapter;
    ExchangeRouter420 private router;
    MockExchangeToken420 private baseToken;
    MockExchangeToken420 private quoteToken;

    constructor() {
        caps = new MockCapabilityRegistryExchangeRouter420();
        authorization = new ExchangeAuthorization420(address(caps));
        emergencyControl = new ExchangeEmergencyControl420(address(this));
        assetRegistry = new ExchangeAssetRegistry420(address(this));
        marketRegistry = new ExchangeMarketRegistry420(address(this), address(assetRegistry), QUOTE_ID);
        routeRegistry = new ExchangeRouteRegistry420(address(this));
        adapter = new MockExchangeRouteAdapter420();
        baseToken = new MockExchangeToken420();
        quoteToken = new MockExchangeToken420();

        assetRegistry.configureAsset(
            BASE_ID,
            bytes16("ePOT"),
            keccak256("POTCOIN"),
            keccak256("POT"),
            address(baseToken),
            ExchangeTypes420.AssetCategory.CANNABIS,
            ExchangeTypes420.AssetStatus.VERIFIED,
            keccak256("verified-base"),
            keccak256("base-metadata")
        );
        assetRegistry.configureAsset(
            QUOTE_ID,
            bytes16("420"),
            keccak256("420CHAIN"),
            keccak256("420"),
            address(quoteToken),
            ExchangeTypes420.AssetCategory.NATIVE_420,
            ExchangeTypes420.AssetStatus.VERIFIED,
            keccak256("verified-420"),
            keccak256("420-metadata")
        );
        marketRegistry.configureMarket(
            MARKET_ID,
            BASE_ID,
            QUOTE_ID,
            keccak256("canonical-market"),
            address(adapter),
            ExchangeTypes420.MarketStatus.ACTIVE,
            keccak256("market-metadata")
        );
        routeRegistry.configureRoute(
            ROUTE_ID,
            keccak256("420SWAP"),
            address(adapter),
            address(adapter),
            keccak256("route-metadata"),
            true
        );

        router = new ExchangeRouter420(
            address(marketRegistry),
            address(assetRegistry),
            address(routeRegistry),
            address(authorization),
            address(emergencyControl)
        );
        caps.setPrincipal(address(this));
    }

    function testQuotesActiveVerifiedMarket() public view {
        (address tokenOut, uint256 amountOut, uint256 impactBps) = router.quoteExactInput(
            MARKET_ID,
            ROUTE_ID,
            address(baseToken),
            100 ether,
            abi.encode(bytes32("route"))
        );
        require(tokenOut == address(quoteToken), "token out");
        require(amountOut == 95 ether, "quote");
        require(impactBps == 50, "impact");
    }

    function testExecutesAuthorizedSelfPayerSwap() public {
        uint256 amountOut = router.swapExactInput(
            MARKET_ID,
            ROUTE_ID,
            address(baseToken),
            100 ether,
            90 ether,
            address(this),
            abi.encode(bytes32("route"))
        );
        require(amountOut == 95 ether, "amount out");
    }

    function testRejectsUnauthorizedSwap() public {
        caps.setEnabled(false);
        (bool ok,) = address(router).call(
            abi.encodeWithSelector(
                router.swapExactInput.selector,
                MARKET_ID,
                ROUTE_ID,
                address(baseToken),
                100 ether,
                90 ether,
                address(this),
                abi.encode(bytes32("route"))
            )
        );
        require(!ok, "unauthorized swap accepted");
        caps.setEnabled(true);
    }

    function testEmergencyHaltFailsClosed() public {
        emergencyControl.setHalt(
            ExchangeEmergencyControl420.Domain.SWAPS,
            true,
            keccak256("test-incident")
        );
        (bool ok,) = address(router).call(
            abi.encodeWithSelector(
                router.swapExactInput.selector,
                MARKET_ID,
                ROUTE_ID,
                address(baseToken),
                100 ether,
                90 ether,
                address(this),
                abi.encode(bytes32("route"))
            )
        );
        require(!ok, "halted swap accepted");
        emergencyControl.setHalt(ExchangeEmergencyControl420.Domain.SWAPS, false, bytes32(0));
    }

    function testRejectsTokenOutsideMarketPair() public {
        MockExchangeToken420 other = new MockExchangeToken420();
        (bool ok,) = address(router).call(
            abi.encodeWithSelector(
                router.quoteExactInput.selector,
                MARKET_ID,
                ROUTE_ID,
                address(other),
                100 ether,
                abi.encode(bytes32("route"))
            )
        );
        require(!ok, "invalid pair quoted");
    }
}
