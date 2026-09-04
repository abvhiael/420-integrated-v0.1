// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/exchange/ExchangeAtomicRouter420.sol";
import "../src/exchange/ExchangeIds420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";

contract MockAtomicToken420 {
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

contract MockAtomicCapabilityRegistry420 is ICapabilityRegistry420 {
    address public principal;
    bool public enabled = true;

    function setPrincipal(address principal_) external { principal = principal_; }
    function setEnabled(bool enabled_) external { enabled = enabled_; }
    function grant(bytes32) external pure override returns (CapabilityGrant memory g) { return g; }

    function isAuthorized(
        address principal_,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32,
        uint256 amount
    ) external view override returns (bool) {
        return enabled && principal_ == principal && componentId == ExchangeIds420.EXCHANGE_ROUTER
            && capabilityId == ExchangeIds420.ACTION_SWAP && amount <= 1_000 ether;
    }
}

contract MockAtomicReferenceOracle420 is IExchangeReferenceOracle420 {
    struct Observation { uint256 priceE18; uint256 updatedAt; }
    mapping(bytes32 => Observation) public observations;

    function set(bytes32 marketId, uint256 priceE18, uint256 updatedAt) external {
        observations[marketId] = Observation(priceE18, updatedAt);
    }

    function referencePrice(bytes32 marketId) external view returns (uint256 priceE18, uint256 updatedAt) {
        Observation memory observation = observations[marketId];
        return (observation.priceE18, observation.updatedAt);
    }
}

contract MockAtomicExecutionAdapter420 is IExchangeQuoteAdapter420, IExchangeExecutionAdapter420 {
    address public immutable sink = address(0xdead);

    function allowanceTarget() external view returns (address) { return address(this); }

    function quote(address, address, uint256 amountIn, bytes calldata)
        external
        pure
        override
        returns (uint256 amountOut, uint256 priceImpactBps)
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
        require(amountIn >= minAmountOut, "slippage");
        require(MockAtomicToken420(tokenIn).transferFrom(payer, sink, amountIn), "pull");
        require(MockAtomicToken420(tokenOut).transfer(recipient, amountIn), "push");
        return amountIn;
    }
}

contract ExchangeAtomicRouter420Test {
    bytes32 private constant A_ID = keccak256("420/exchange/atomic/A");
    bytes32 private constant B_ID = keccak256("420/exchange/atomic/B");
    bytes32 private constant C_ID = keccak256("420/exchange/atomic/C");
    bytes32 private constant AB_MARKET = keccak256("420/exchange/atomic/AB");
    bytes32 private constant BC_MARKET = keccak256("420/exchange/atomic/BC");
    bytes32 private constant ROUTE_ID = keccak256("420/exchange/atomic/route");

    MockAtomicCapabilityRegistry420 private caps;
    MockAtomicReferenceOracle420 private referenceOracle;
    ExchangeAuthorization420 private authorization;
    ExchangeEmergencyControl420 private emergency;
    ExchangeOracleGuard420 private oracleGuard;
    ExchangeAssetRegistry420 private assets;
    ExchangeMarketRegistry420 private markets;
    ExchangeRouteRegistry420 private routes;
    ExchangeAtomicRouter420 private router;
    MockAtomicExecutionAdapter420 private adapter;
    MockAtomicToken420 private tokenA;
    MockAtomicToken420 private tokenB;
    MockAtomicToken420 private tokenC;

    constructor() {
        caps = new MockAtomicCapabilityRegistry420();
        referenceOracle = new MockAtomicReferenceOracle420();
        authorization = new ExchangeAuthorization420(address(caps));
        emergency = new ExchangeEmergencyControl420(address(this));
        oracleGuard = new ExchangeOracleGuard420(address(this));
        assets = new ExchangeAssetRegistry420(address(this));
        markets = new ExchangeMarketRegistry420(address(this), address(assets), C_ID);
        routes = new ExchangeRouteRegistry420(address(this));
        adapter = new MockAtomicExecutionAdapter420();
        tokenA = new MockAtomicToken420("A", "A");
        tokenB = new MockAtomicToken420("B", "B");
        tokenC = new MockAtomicToken420("C", "C");

        _configureAsset(A_ID, address(tokenA), bytes16("A"));
        _configureAsset(B_ID, address(tokenB), bytes16("B"));
        _configureAsset(C_ID, address(tokenC), bytes16("C"));

        markets.configureMarket(
            AB_MARKET,
            A_ID,
            B_ID,
            keccak256("AB-canonical"),
            address(adapter),
            ExchangeTypes420.MarketStatus.ACTIVE,
            keccak256("AB-metadata")
        );
        markets.configureMarket(
            BC_MARKET,
            B_ID,
            C_ID,
            keccak256("BC-canonical"),
            address(adapter),
            ExchangeTypes420.MarketStatus.ACTIVE,
            keccak256("BC-metadata")
        );
        routes.configureRoute(
            ROUTE_ID,
            keccak256("420SWAP"),
            address(adapter),
            address(adapter),
            keccak256("atomic-route"),
            true
        );

        uint256 nowTs = block.timestamp;
        referenceOracle.set(AB_MARKET, 1e18, nowTs);
        referenceOracle.set(BC_MARKET, 1e18, nowTs);
        oracleGuard.configureGuard(AB_MARKET, address(referenceOracle), 1 days, 500, true);
        oracleGuard.configureGuard(BC_MARKET, address(referenceOracle), 1 days, 500, true);

        router = new ExchangeAtomicRouter420(
            address(markets),
            address(assets),
            address(routes),
            address(authorization),
            address(emergency),
            address(oracleGuard),
            address(tokenA)
        );
        caps.setPrincipal(address(this));

        tokenA.mint(address(this), 1_000 ether);
        tokenB.mint(address(adapter), 10_000 ether);
        tokenC.mint(address(adapter), 10_000 ether);
        tokenA.approve(address(adapter), type(uint256).max);
    }

    function testExecutesTwoHopPathAtomically() public {
        ExchangeAtomicRouter420.Hop[] memory hops = _twoHopPath();
        bytes32 pathHash = router.hashPath(address(tokenA), 100 ether, address(this), hops);

        uint256 beforeC = tokenC.balanceOf(address(this));
        uint256 amountOut = router.swapExactInputPath(
            address(tokenA),
            100 ether,
            95 ether,
            address(this),
            pathHash,
            hops
        );

        require(amountOut == 100 ether, "output");
        require(tokenC.balanceOf(address(this)) - beforeC == 100 ether, "recipient output");
        require(tokenB.balanceOf(address(router)) == 0, "intermediate residue");
        require(tokenB.allowance(address(router), address(adapter)) == 0, "allowance residue");
    }

    function testRejectsPathHashMismatch() public {
        ExchangeAtomicRouter420.Hop[] memory hops = _twoHopPath();
        (bool ok,) = address(router).call(
            abi.encodeWithSelector(
                router.swapExactInputPath.selector,
                address(tokenA),
                100 ether,
                95 ether,
                address(this),
                bytes32(uint256(123)),
                hops
            )
        );
        require(!ok, "bad hash accepted");
    }

    function testRejectsUnauthorizedHop() public {
        ExchangeAtomicRouter420.Hop[] memory hops = _twoHopPath();
        bytes32 pathHash = router.hashPath(address(tokenA), 100 ether, address(this), hops);
        caps.setEnabled(false);
        (bool ok,) = address(router).call(
            abi.encodeWithSelector(
                router.swapExactInputPath.selector,
                address(tokenA),
                100 ether,
                95 ether,
                address(this),
                pathHash,
                hops
            )
        );
        require(!ok, "unauthorized path accepted");
        caps.setEnabled(true);
    }

    function testEmergencyHaltFailsClosed() public {
        ExchangeAtomicRouter420.Hop[] memory hops = _twoHopPath();
        bytes32 pathHash = router.hashPath(address(tokenA), 100 ether, address(this), hops);
        emergency.setHalt(ExchangeEmergencyControl420.Domain.SWAPS, true, keccak256("atomic-incident"));
        (bool ok,) = address(router).call(
            abi.encodeWithSelector(
                router.swapExactInputPath.selector,
                address(tokenA),
                100 ether,
                95 ether,
                address(this),
                pathHash,
                hops
            )
        );
        require(!ok, "halted path accepted");
        emergency.setHalt(ExchangeEmergencyControl420.Domain.SWAPS, false, bytes32(0));
    }

    function testRejectsRepeatedTokenCycle() public {
        ExchangeAtomicRouter420.Hop[] memory hops = new ExchangeAtomicRouter420.Hop[](2);
        hops[0] = ExchangeAtomicRouter420.Hop(AB_MARKET, ROUTE_ID, address(tokenB), 90 ether, "");
        hops[1] = ExchangeAtomicRouter420.Hop(AB_MARKET, ROUTE_ID, address(tokenA), 80 ether, "");
        bytes32 pathHash = router.hashPath(address(tokenA), 100 ether, address(this), hops);
        (bool ok,) = address(router).call(
            abi.encodeWithSelector(
                router.swapExactInputPath.selector,
                address(tokenA),
                100 ether,
                80 ether,
                address(this),
                pathHash,
                hops
            )
        );
        require(!ok, "cycle accepted");
    }

    function testOracleDeviationFailsClosedAndRollsBack() public {
        ExchangeAtomicRouter420.Hop[] memory hops = _twoHopPath();
        bytes32 pathHash = router.hashPath(address(tokenA), 100 ether, address(this), hops);
        uint256 beforeA = tokenA.balanceOf(address(this));
        uint256 beforeC = tokenC.balanceOf(address(this));

        referenceOracle.set(AB_MARKET, 2e18, block.timestamp);
        (bool ok,) = address(router).call(
            abi.encodeWithSelector(
                router.swapExactInputPath.selector,
                address(tokenA),
                100 ether,
                95 ether,
                address(this),
                pathHash,
                hops
            )
        );
        require(!ok, "deviating execution accepted");
        require(tokenA.balanceOf(address(this)) == beforeA, "input not rolled back");
        require(tokenC.balanceOf(address(this)) == beforeC, "output not rolled back");
        referenceOracle.set(AB_MARKET, 1e18, block.timestamp);
    }

    function _twoHopPath() private view returns (ExchangeAtomicRouter420.Hop[] memory hops) {
        hops = new ExchangeAtomicRouter420.Hop[](2);
        hops[0] = ExchangeAtomicRouter420.Hop(AB_MARKET, ROUTE_ID, address(tokenB), 95 ether, "");
        hops[1] = ExchangeAtomicRouter420.Hop(BC_MARKET, ROUTE_ID, address(tokenC), 95 ether, "");
    }

    function _configureAsset(bytes32 id, address token, bytes16 symbol) private {
        assets.configureAsset(
            id,
            symbol,
            keccak256(abi.encodePacked("chain", id)),
            keccak256(abi.encodePacked("asset", id)),
            token,
            ExchangeTypes420.AssetCategory.OTHER,
            ExchangeTypes420.AssetStatus.VERIFIED,
            keccak256(abi.encodePacked("verification", id)),
            keccak256(abi.encodePacked("metadata", id))
        );
    }
}
