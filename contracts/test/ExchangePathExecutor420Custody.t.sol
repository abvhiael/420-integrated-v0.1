// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/exchange/ExchangePathExecutor420.sol";
import "../src/exchange/ExchangeIds420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";

contract CustodyToken420 {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory name_, string memory symbol_) {
        name = name_;
        symbol = symbol_;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) private {
        require(to != address(0), "to");
        uint256 balance = balanceOf[from];
        require(balance >= amount, "balance");
        balanceOf[from] = balance - amount;
        balanceOf[to] += amount;
    }
}

contract CustodyCapabilityRegistry420 is ICapabilityRegistry420 {
    address public principal;

    function setPrincipal(address principal_) external { principal = principal_; }
    function grant(bytes32) external pure override returns (CapabilityGrant memory g) { return g; }

    function isAuthorized(
        address principal_,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32,
        uint256
    ) external view override returns (bool) {
        return principal_ == principal
            && componentId == ExchangeIds420.EXCHANGE_ROUTER
            && capabilityId == ExchangeIds420.ACTION_SWAP;
    }
}

contract TransferPathAdapter420 is IExchangeQuoteAdapter420, IExchangeExecutionAdapter420 {
    uint256 public immutable numerator;
    uint256 public immutable denominator;

    constructor(uint256 numerator_, uint256 denominator_) {
        require(numerator_ != 0 && denominator_ != 0, "ratio");
        numerator = numerator_;
        denominator = denominator_;
    }

    function quote(address, address, uint256 amountIn, bytes calldata)
        external
        view
        override
        returns (uint256 amountOut, uint256 priceImpactBps)
    {
        amountOut = amountIn * numerator / denominator;
        priceImpactBps = 0;
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
        amountOut = amountIn * numerator / denominator;
        require(amountOut >= minAmountOut, "slippage");
        require(CustodyToken420(tokenIn).transferFrom(payer, address(this), amountIn), "pull");
        require(CustodyToken420(tokenOut).transfer(recipient, amountOut), "settle");
    }
}

contract ExchangePathExecutor420CustodyTest {
    bytes32 private constant ASSET_A = keccak256("420/exchange/v6/custody/a");
    bytes32 private constant ASSET_B = keccak256("420/exchange/v6/custody/b");
    bytes32 private constant ASSET_C = keccak256("420/exchange/v6/custody/c");
    bytes32 private constant MARKET_AB = keccak256("420/exchange/v6/custody/market-ab");
    bytes32 private constant MARKET_BC = keccak256("420/exchange/v6/custody/market-bc");
    bytes32 private constant ROUTE_AB = keccak256("420/exchange/v6/custody/route-ab");
    bytes32 private constant ROUTE_BC = keccak256("420/exchange/v6/custody/route-bc");

    CustodyToken420 private tokenA;
    CustodyToken420 private tokenB;
    CustodyToken420 private tokenC;
    TransferPathAdapter420 private adapterAB;
    TransferPathAdapter420 private adapterBC;
    ExchangeAuthorization420 private authorization;
    ExchangeEmergencyControl420 private emergencyControl;
    ExchangeAssetRegistry420 private assetRegistry;
    ExchangeMarketRegistry420 private marketRegistry;
    ExchangeRouteRegistry420 private routeRegistry;
    ExchangePathExecutor420 private executor;

    constructor() {
        CustodyCapabilityRegistry420 caps = new CustodyCapabilityRegistry420();
        caps.setPrincipal(address(this));
        authorization = new ExchangeAuthorization420(address(caps));
        emergencyControl = new ExchangeEmergencyControl420(address(this));
        assetRegistry = new ExchangeAssetRegistry420(address(this));
        marketRegistry = new ExchangeMarketRegistry420(address(this), address(assetRegistry), ASSET_B);
        routeRegistry = new ExchangeRouteRegistry420(address(this));

        tokenA = new CustodyToken420("Asset A", "A");
        tokenB = new CustodyToken420("Asset B", "B");
        tokenC = new CustodyToken420("Asset C", "C");
        adapterAB = new TransferPathAdapter420(8, 10);
        adapterBC = new TransferPathAdapter420(7, 8);

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

        tokenA.mint(address(this), 100 ether);
        tokenB.mint(address(adapterAB), 80 ether);
        tokenC.mint(address(adapterBC), 70 ether);
        tokenA.approve(address(adapterAB), type(uint256).max);
        tokenB.approve(address(adapterBC), type(uint256).max);
    }

    function testTwoHopBalancesProveExecutorNeverCustodiesPathAssets() public {
        address recipient = address(0xBEEF);
        ExchangePathExecutor420.Hop[] memory hops = new ExchangePathExecutor420.Hop[](2);
        hops[0] = ExchangePathExecutor420.Hop({
            marketId: MARKET_AB,
            routeId: ROUTE_AB,
            tokenOut: address(tokenB),
            minAmountOut: 80 ether,
            routeData: abi.encode(bytes32("ab"))
        });
        hops[1] = ExchangePathExecutor420.Hop({
            marketId: MARKET_BC,
            routeId: ROUTE_BC,
            tokenOut: address(tokenC),
            minAmountOut: 70 ether,
            routeData: abi.encode(bytes32("bc"))
        });

        bytes32 pathHash = executor.hashPath(
            address(this), address(tokenA), 100 ether, 70 ether, recipient, hops
        );
        uint256 amountOut = executor.executeExactInputPath(
            address(tokenA), 100 ether, 70 ether, recipient, pathHash, hops
        );

        require(amountOut == 70 ether, "amount out");
        require(tokenA.balanceOf(address(this)) == 0, "input not consumed");
        require(tokenB.balanceOf(address(this)) == 0, "intermediate not consumed");
        require(tokenC.balanceOf(recipient) == 70 ether, "recipient not settled");

        require(tokenA.balanceOf(address(executor)) == 0, "executor held input");
        require(tokenB.balanceOf(address(executor)) == 0, "executor held intermediate");
        require(tokenC.balanceOf(address(executor)) == 0, "executor held output");
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
