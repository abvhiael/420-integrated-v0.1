// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/exchange/ExchangeOracleGuard420.sol";

contract MockOracleBoundaryToken420 {
    uint8 public immutable decimals;
    constructor(uint8 decimals_) { decimals = decimals_; }
}

contract MockOracleBoundaryOracle420 is IExchangeReferenceOracle420 {
    uint256 public priceE18;
    uint256 public updatedAt;

    function set(uint256 priceE18_, uint256 updatedAt_) external {
        priceE18 = priceE18_;
        updatedAt = updatedAt_;
    }

    function referencePrice(bytes32) external view returns (uint256, uint256) {
        return (priceE18, updatedAt);
    }
}

contract ExchangeOracleGuard420BoundaryHardeningTest is Test {
    bytes32 private constant MARKET = keccak256("420/exchange/v12/oracle-boundary-market");
    uint32 private constant MAX_STALENESS = 1 days;
    uint16 private constant MAX_DEVIATION_BPS = 500;

    ExchangeOracleGuard420 private guard;
    MockOracleBoundaryOracle420 private oracle;
    MockOracleBoundaryToken420 private token0;
    MockOracleBoundaryToken420 private token18;
    MockOracleBoundaryToken420 private token36;

    function setUp() public {
        guard = new ExchangeOracleGuard420(address(this));
        oracle = new MockOracleBoundaryOracle420();
        token0 = new MockOracleBoundaryToken420(0);
        token18 = new MockOracleBoundaryToken420(18);
        token36 = new MockOracleBoundaryToken420(36);

        oracle.set(1e18, block.timestamp);
        guard.configureGuard(MARKET, address(oracle), MAX_STALENESS, MAX_DEVIATION_BPS, true);
    }

    function testExactUpperDeviationBoundaryPasses() public view {
        guard.requireHealthy(MARKET, 1_050_000_000_000_000_000);
    }

    function testExactLowerDeviationBoundaryPasses() public view {
        guard.requireHealthy(MARKET, 950_000_000_000_000_000);
    }

    function testAboveUpperDeviationBoundaryFailsClosed() public {
        (bool ok,) = address(guard).call(
            abi.encodeWithSelector(guard.requireHealthy.selector, MARKET, 1_050_100_000_000_000_000)
        );
        require(!ok, "above upper deviation accepted");
    }

    function testBelowLowerDeviationBoundaryFailsClosed() public {
        (bool ok,) = address(guard).call(
            abi.encodeWithSelector(guard.requireHealthy.selector, MARKET, 949_900_000_000_000_000)
        );
        require(!ok, "below lower deviation accepted");
    }

    function testExactStalenessBoundaryPasses() public {
        uint256 observedAt = block.timestamp;
        oracle.set(1e18, observedAt);
        vm.warp(observedAt + MAX_STALENESS);
        guard.requireHealthy(MARKET, 1e18);
    }

    function testOneSecondPastStalenessFailsClosed() public {
        uint256 observedAt = block.timestamp;
        oracle.set(1e18, observedAt);
        vm.warp(observedAt + MAX_STALENESS + 1);
        (bool ok,) = address(guard).call(
            abi.encodeWithSelector(guard.requireHealthy.selector, MARKET, 1e18)
        );
        require(!ok, "stale oracle accepted");
    }

    function testFutureObservationFailsClosed() public {
        oracle.set(1e18, block.timestamp + 1);
        (bool ok,) = address(guard).call(
            abi.encodeWithSelector(guard.requireHealthy.selector, MARKET, 1e18)
        );
        require(!ok, "future oracle accepted");
    }

    function testZeroDecimalNormalization() public view {
        uint256 price = guard.normalizedExecutionPriceE18(
            address(token0), address(token18), 2, 6 ether
        );
        require(price == 3e18, "zero-decimal normalization");
    }

    function testThirtySixDecimalNormalization() public view {
        uint256 price = guard.normalizedExecutionPriceE18(
            address(token36), address(token18), 2e36, 6 ether
        );
        require(price == 3e18, "36-decimal normalization");
    }

    function testLowDecimalScaleOverflowFailsClosed() public {
        (bool ok,) = address(guard).call(
            abi.encodeWithSelector(
                guard.normalizedExecutionPriceE18.selector,
                address(token0),
                address(token18),
                type(uint256).max,
                1 ether
            )
        );
        require(!ok, "scale overflow accepted");
    }

    function testPriceScaleOverflowFailsClosed() public {
        uint256 quoteAmount = type(uint256).max / 1e18 + 1;
        (bool ok,) = address(guard).call(
            abi.encodeWithSelector(
                guard.normalizedExecutionPriceE18.selector,
                address(token18),
                address(token18),
                1 ether,
                quoteAmount
            )
        );
        require(!ok, "price-scale overflow accepted");
    }

    function testFuzzWithinUpperDeviationBandPasses(uint16 deviationBps) public view {
        uint256 bounded = uint256(deviationBps) % (MAX_DEVIATION_BPS + 1);
        uint256 executionPrice = 1e18 + (1e18 * bounded / 10_000);
        guard.requireHealthy(MARKET, executionPrice);
    }

    function testFuzzWithinLowerDeviationBandPasses(uint16 deviationBps) public view {
        uint256 bounded = uint256(deviationBps) % (MAX_DEVIATION_BPS + 1);
        uint256 executionPrice = 1e18 - (1e18 * bounded / 10_000);
        guard.requireHealthy(MARKET, executionPrice);
    }
}
