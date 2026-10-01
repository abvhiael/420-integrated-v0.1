// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/swap/CanonicalConstantProductPool420.sol";
import "../src/swap/CanonicalMarketRegistry.sol";
import "../src/swap/TWAPOracle.sol";
import "../src/oracle/TWAPOracleSourceAdapter420.sol";
import "../src/exchange/ExchangeOracleGuard420.sol";
import "./helpers/GenesisMocks420.sol";

interface VmSwapTWAP420 {
    function warp(uint256) external;
}

contract TWAPToken420 {
    uint8 public immutable decimals;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(uint8 decimals_) { decimals = decimals_; }

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

contract TWAPPoolExecutor420 {
    function execute(
        CanonicalConstantProductPool420 pool,
        address payer,
        address recipient,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minOut
    ) external returns (uint256 spent, uint256 delivered) {
        return pool.executeCanonicalSwap(payer, recipient, tokenIn, tokenOut, amountIn, minOut);
    }
}

contract TWAPConfigCaller420 {
    function configure(TWAPOracle oracle, bytes32 marketId) external {
        oracle.configureMarket(marketId, 60, 600, 120, true);
    }
}

contract SwapTWAPOracle420Test {
    VmSwapTWAP420 internal constant vm =
        VmSwapTWAP420(address(uint160(uint256(keccak256("hevm cheat code")))));

    bytes32 internal constant MARKET_ID = keccak256("420/USDC/TWAP");
    uint256 internal constant E18 = 1e18;

    struct Suite {
        GenesisMockEnvironment420 env;
        CanonicalMarketRegistry markets;
        TWAPOracle oracle;
        TWAPToken420 base;
        TWAPToken420 quote;
        TWAPPoolExecutor420 executor;
        CanonicalConstantProductPool420 pool;
    }

    function _setup() internal returns (Suite memory s) {
        vm.warp(1_000);
        s.env = new GenesisMockEnvironment420();
        s.markets = new CanonicalMarketRegistry(
            address(this), address(s.env.registry()), keccak256("twap-market-registry")
        );
        s.oracle = new TWAPOracle(
            address(this), address(s.env.registry()), keccak256("twap-oracle")
        );
        s.env.registerResident(address(s.markets), s.markets.componentId());
        s.env.registerResident(address(s.oracle), s.oracle.componentId());

        s.base = new TWAPToken420(18);
        s.quote = new TWAPToken420(6);
        s.executor = new TWAPPoolExecutor420();
        s.pool = new CanonicalConstantProductPool420(
            address(s.base), address(s.quote), address(s.executor), 30
        );

        s.base.mint(address(this), 2_000_000 ether);
        s.quote.mint(address(this), 4_000_000 * 1e6);
        s.base.approve(address(s.pool), type(uint256).max);
        s.quote.approve(address(s.pool), type(uint256).max);
        s.pool.addLiquidity(1_000 ether, 2_000 * 1e6, 1, address(this));

        s.markets.setMarket(
            MARKET_ID,
            address(s.pool),
            address(s.base),
            address(s.quote),
            CanonicalMarketRegistry.Role.CANONICAL_USD,
            keccak256("420-usdc"),
            true
        );
        s.oracle.configureMarket(MARKET_ID, 60, 600, 120, true);
    }

    function _produceObservation(Suite memory s) internal returns (uint256 referencePriceE18) {
        require(!s.oracle.checkpoint(MARKET_ID), "seed created observation");

        vm.warp(1_030);
        (uint256 quoted,) = s.pool.quoteCanonicalSwap(address(s.base), address(s.quote), 100 ether);
        s.executor.execute(
            s.pool,
            address(this),
            address(this),
            address(s.base),
            address(s.quote),
            100 ether,
            quoted
        );

        vm.warp(1_060);
        require(s.oracle.checkpoint(MARKET_ID), "observation missing");
        (referencePriceE18,) = s.oracle.referencePrice(MARKET_ID);
    }

    function testCanonicalPoolCumulativeTWAPResistsInstantSpotReplacement() public {
        Suite memory s = _setup();
        uint256 referencePriceE18 = _produceObservation(s);

        uint256 normalizedQuoteReserve = s.pool.reserve1() * 1e12;
        uint256 spotPriceE18 = normalizedQuoteReserve * E18 / s.pool.reserve0();

        require(referencePriceE18 < 2 * E18, "twap ignored changed reserves");
        require(referencePriceE18 > spotPriceE18, "twap collapsed to terminal spot");

        (uint64 observedAt, uint192 priceX96) = s.oracle.latest(MARKET_ID);
        require(observedAt == 1_060 && priceX96 != 0, "latest");
        require(s.oracle.latestWindowSeconds(MARKET_ID) == 60, "window");
        require(s.oracle.latestSourceHash(MARKET_ID) != bytes32(0), "source");
    }

    function testCheckpointBeforeMinimumWindowFailsClosed() public {
        Suite memory s = _setup();
        require(!s.oracle.checkpoint(MARKET_ID), "seed");
        vm.warp(1_059);

        (bool ok,) = address(s.oracle).call(
            abi.encodeWithSelector(s.oracle.checkpoint.selector, MARKET_ID)
        );
        require(!ok, "short window accepted");
    }

    function testOverlongWindowReseedsAndInvalidatesOldObservation() public {
        Suite memory s = _setup();
        _produceObservation(s);

        vm.warp(1_661);
        require(!s.oracle.checkpoint(MARKET_ID), "overlong window produced observation");

        (uint64 observedAt, uint192 priceX96) = s.oracle.latest(MARKET_ID);
        require(observedAt == 0 && priceX96 == 0, "old observation survived reset");

        (bool ok,) = address(s.oracle).staticcall(
            abi.encodeWithSelector(s.oracle.referencePrice.selector, MARKET_ID)
        );
        require(!ok, "reference survived reset");
    }

    function testStaleObservationFailsClosedForDirectAndAdapterReads() public {
        Suite memory s = _setup();
        _produceObservation(s);
        TWAPOracleSourceAdapter420 adapter = new TWAPOracleSourceAdapter420(address(s.oracle));

        vm.warp(1_181);

        (bool directOk,) = address(s.oracle).staticcall(
            abi.encodeWithSelector(s.oracle.referencePrice.selector, MARKET_ID)
        );
        require(!directOk, "stale direct read accepted");

        (bool adapterOk,) = address(adapter).staticcall(
            abi.encodeWithSelector(adapter.readNumeric.selector, MARKET_ID)
        );
        require(!adapterOk, "stale adapter read accepted");
    }

    function testAdapterCarriesWindowedSourceProvenance() public {
        Suite memory s = _setup();
        uint256 referencePriceE18 = _produceObservation(s);
        TWAPOracleSourceAdapter420 adapter = new TWAPOracleSourceAdapter420(address(s.oracle));

        (int256 value, uint64 observedAt, uint8 decimals, uint16 confidenceBps, bytes32 dataHash) =
            adapter.readNumeric(MARKET_ID);

        require(uint256(value) == referencePriceE18, "adapter value");
        require(observedAt == 1_060, "adapter timestamp");
        require(decimals == 18 && confidenceBps == 0, "adapter metadata");
        require(dataHash != bytes32(0), "adapter provenance");
    }

    function testExchangeGuardConsumesRealSwapTWAPFailClosed() public {
        Suite memory s = _setup();
        uint256 referencePriceE18 = _produceObservation(s);
        ExchangeOracleGuard420 guard = new ExchangeOracleGuard420(address(this));
        guard.configureGuard(MARKET_ID, address(s.oracle), 120, 500, true);

        guard.requireHealthy(MARKET_ID, referencePriceE18);

        (bool deviationOk,) = address(guard).staticcall(
            abi.encodeWithSelector(
                guard.requireHealthy.selector,
                MARKET_ID,
                referencePriceE18 * 2
            )
        );
        require(!deviationOk, "large deviation accepted");

        vm.warp(1_181);
        (bool staleOk,) = address(guard).staticcall(
            abi.encodeWithSelector(
                guard.requireHealthy.selector,
                MARKET_ID,
                referencePriceE18
            )
        );
        require(!staleOk, "stale Exchange guard accepted");
    }

    function testCanonicalSourceChangeInvalidatesPriorTWAP() public {
        Suite memory s = _setup();
        _produceObservation(s);

        CanonicalConstantProductPool420 replacement = new CanonicalConstantProductPool420(
            address(s.base), address(s.quote), address(s.executor), 30
        );
        s.markets.setMarket(
            MARKET_ID,
            address(replacement),
            address(s.base),
            address(s.quote),
            CanonicalMarketRegistry.Role.CANONICAL_USD,
            keccak256("replacement"),
            true
        );

        vm.warp(1_120);
        require(!s.oracle.checkpoint(MARKET_ID), "source change produced observation");

        (uint64 observedAt, uint192 priceX96) = s.oracle.latest(MARKET_ID);
        require(observedAt == 0 && priceX96 == 0, "old source observation survived");
    }

    function testCheckpointFailsClosedWhenMarketInactiveOrSystemPaused() public {
        Suite memory s = _setup();

        s.env.pause().setPaused(true);
        (bool pausedOk,) = address(s.oracle).call(
            abi.encodeWithSelector(s.oracle.checkpoint.selector, MARKET_ID)
        );
        require(!pausedOk, "paused checkpoint accepted");

        s.env.pause().setPaused(false);
        s.markets.setMarket(
            MARKET_ID,
            address(s.pool),
            address(s.base),
            address(s.quote),
            CanonicalMarketRegistry.Role.CANONICAL_USD,
            keccak256("inactive"),
            false
        );
        (bool inactiveOk,) = address(s.oracle).call(
            abi.encodeWithSelector(s.oracle.checkpoint.selector, MARKET_ID)
        );
        require(!inactiveOk, "inactive market accepted");
    }

    function testOnlyGovernanceConfiguresPolicyButPricePublicationIsPermissionless() public {
        Suite memory s = _setup();
        TWAPConfigCaller420 caller = new TWAPConfigCaller420();

        (bool configOk,) = address(caller).call(
            abi.encodeWithSelector(caller.configure.selector, s.oracle, MARKET_ID)
        );
        require(!configOk, "non-governance configuration accepted");

        require(!s.oracle.checkpoint(MARKET_ID), "permissionless seed");
    }
}
