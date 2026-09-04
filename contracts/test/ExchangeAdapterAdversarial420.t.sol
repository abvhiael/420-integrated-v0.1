// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/exchange/ExchangeAtomicRouter420.sol";
import "../src/exchange/ExchangeIds420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";

contract AdversarialToken420 {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory n, string memory s) { name = n; symbol = s; }
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount && balanceOf[from] >= amount, "pull");
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract AdversarialCaps420 is ICapabilityRegistry420 {
    address public principal;
    function setPrincipal(address p) external { principal = p; }
    function grant(bytes32) external pure override returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address p, bytes32 componentId, bytes32 capabilityId, bytes32, uint256)
        external view override returns (bool)
    {
        return p == principal && componentId == ExchangeIds420.EXCHANGE_ROUTER
            && capabilityId == ExchangeIds420.ACTION_SWAP;
    }
}

contract AdversarialOracle420 is IExchangeReferenceOracle420 {
    function referencePrice(bytes32) external view returns (uint256, uint256) { return (1e18, block.timestamp); }
}

contract MaliciousExecutionAdapter420 is IExchangeQuoteAdapter420, IExchangeExecutionAdapter420 {
    enum Mode { HONEST, UNDER_PULL, OVER_PULL, MISREPORT_OUTPUT, WRONG_RECIPIENT }
    Mode public mode;
    address public immutable sink = address(0xA11CE);
    address public immutable wrongRecipient = address(0xBAD);

    function setMode(Mode m) external { mode = m; }
    function allowanceTarget() external view returns (address) { return address(this); }
    function quote(address, address, uint256 amountIn, bytes calldata)
        external pure override returns (uint256, uint256)
    { return (amountIn, 0); }

    function executeSwap(
        address payer,
        address recipient,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata
    ) external override returns (uint256 amountOut) {
        uint256 pullAmount = amountIn;
        uint256 pushAmount = amountIn;
        address actualRecipient = recipient;
        if (mode == Mode.UNDER_PULL) pullAmount = amountIn - 1;
        if (mode == Mode.OVER_PULL) pullAmount = amountIn + 1;
        if (mode == Mode.MISREPORT_OUTPUT) pushAmount = amountIn - 1;
        if (mode == Mode.WRONG_RECIPIENT) actualRecipient = wrongRecipient;
        require(AdversarialToken420(tokenIn).transferFrom(payer, sink, pullAmount), "pull");
        require(AdversarialToken420(tokenOut).transfer(actualRecipient, pushAmount), "push");
        amountOut = amountIn;
        require(amountOut >= minAmountOut, "slippage");
    }
}

contract ExchangeAdapterAdversarial420Test {
    bytes32 private constant A_ID = keccak256("v12/adversarial/A");
    bytes32 private constant B_ID = keccak256("v12/adversarial/B");
    bytes32 private constant MARKET = keccak256("v12/adversarial/AB");
    bytes32 private constant ROUTE = keccak256("v12/adversarial/route");

    AdversarialToken420 private a;
    AdversarialToken420 private b;
    AdversarialCaps420 private caps;
    AdversarialOracle420 private refOracle;
    MaliciousExecutionAdapter420 private adapter;
    ExchangeAuthorization420 private authorization;
    ExchangeEmergencyControl420 private emergency;
    ExchangeOracleGuard420 private guard;
    ExchangeAssetRegistry420 private assets;
    ExchangeMarketRegistry420 private markets;
    ExchangeRouteRegistry420 private routes;
    ExchangeFeePolicy420 private feePolicy;
    ExchangeFeeRouter420 private feeRouter;
    ExchangeAtomicRouter420 private router;

    constructor() {
        a = new AdversarialToken420("A", "A");
        b = new AdversarialToken420("B", "B");
        caps = new AdversarialCaps420();
        refOracle = new AdversarialOracle420();
        adapter = new MaliciousExecutionAdapter420();
        authorization = new ExchangeAuthorization420(address(caps));
        emergency = new ExchangeEmergencyControl420(address(this));
        guard = new ExchangeOracleGuard420(address(this));
        assets = new ExchangeAssetRegistry420(address(this));
        markets = new ExchangeMarketRegistry420(address(this), address(assets), B_ID);
        routes = new ExchangeRouteRegistry420(address(this));
        feePolicy = new ExchangeFeePolicy420(address(this));
        feeRouter = new ExchangeFeeRouter420(address(this), address(feePolicy));
        _asset(A_ID, address(a), bytes16("A"));
        _asset(B_ID, address(b), bytes16("B"));
        markets.configureMarket(MARKET, A_ID, B_ID, keccak256("AB"), address(adapter), ExchangeTypes420.MarketStatus.ACTIVE, keccak256("meta"));
        routes.configureRoute(ROUTE, keccak256("420SWAP"), address(adapter), address(adapter), keccak256("route"), true);
        guard.configureGuard(MARKET, address(refOracle), 1 days, 500, true);
        router = new ExchangeAtomicRouter420(address(markets), address(assets), address(routes), address(authorization), address(emergency), address(guard), address(a), address(feeRouter));
        caps.setPrincipal(address(this));
        a.mint(address(this), 1_000 ether);
        b.mint(address(adapter), 1_000 ether);
        a.approve(address(adapter), type(uint256).max);
    }

    function testUnderPullFirstHopFailsClosedAndRollsBack() public {
        adapter.setMode(MaliciousExecutionAdapter420.Mode.UNDER_PULL);
        _mustRevertAndPreserve();
    }

    function testOverPullFirstHopFailsClosedAndRollsBack() public {
        adapter.setMode(MaliciousExecutionAdapter420.Mode.OVER_PULL);
        _mustRevertAndPreserve();
    }

    function testMisreportedOutputFailsClosedAndRollsBack() public {
        adapter.setMode(MaliciousExecutionAdapter420.Mode.MISREPORT_OUTPUT);
        _mustRevertAndPreserve();
    }

    function testWrongRecipientOutputFailsClosedAndRollsBack() public {
        adapter.setMode(MaliciousExecutionAdapter420.Mode.WRONG_RECIPIENT);
        _mustRevertAndPreserve();
        require(b.balanceOf(adapter.wrongRecipient()) == 0, "wrong recipient retained output");
    }

    function testHonestAdapterStillExecutes() public {
        ExchangeAtomicRouter420.Hop[] memory hops = _path();
        bytes32 pathHash = router.hashPath(address(a), 100 ether, address(this), hops);
        uint256 beforeA = a.balanceOf(address(this));
        uint256 beforeB = b.balanceOf(address(this));
        uint256 out = router.swapExactInputPath(address(a), 100 ether, 95 ether, address(this), pathHash, hops);
        require(out == 100 ether, "out");
        require(beforeA - a.balanceOf(address(this)) == 100 ether, "input debit");
        require(b.balanceOf(address(this)) - beforeB == 100 ether, "output credit");
        require(b.balanceOf(address(router)) == 0, "router residue");
    }

    function _mustRevertAndPreserve() private {
        ExchangeAtomicRouter420.Hop[] memory hops = _path();
        bytes32 pathHash = router.hashPath(address(a), 100 ether, address(this), hops);
        uint256 beforeA = a.balanceOf(address(this));
        uint256 beforeB = b.balanceOf(address(this));
        uint256 beforeSink = a.balanceOf(adapter.sink());
        (bool ok,) = address(router).call(abi.encodeWithSelector(
            router.swapExactInputPath.selector,
            address(a), 100 ether, 95 ether, address(this), pathHash, hops
        ));
        require(!ok, "malicious adapter accepted");
        require(a.balanceOf(address(this)) == beforeA, "input not rolled back");
        require(b.balanceOf(address(this)) == beforeB, "output not rolled back");
        require(a.balanceOf(adapter.sink()) == beforeSink, "sink retained input");
        require(b.balanceOf(address(router)) == 0, "router residue");
    }

    function _path() private view returns (ExchangeAtomicRouter420.Hop[] memory hops) {
        hops = new ExchangeAtomicRouter420.Hop[](1);
        hops[0] = ExchangeAtomicRouter420.Hop(MARKET, ROUTE, address(b), 95 ether, "");
    }

    function _asset(bytes32 id, address token, bytes16 symbol) private {
        assets.configureAsset(id, symbol, keccak256(abi.encodePacked("chain", id)), keccak256(abi.encodePacked("asset", id)), token,
            ExchangeTypes420.AssetCategory.OTHER, ExchangeTypes420.AssetStatus.VERIFIED,
            keccak256(abi.encodePacked("verification", id)), keccak256(abi.encodePacked("metadata", id)));
    }
}
