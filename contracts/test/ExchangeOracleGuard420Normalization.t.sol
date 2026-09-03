// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/exchange/ExchangeOracleGuard420.sol";

contract MockNormalizedToken420 {
    uint8 public immutable decimals;
    constructor(uint8 decimals_) { decimals = decimals_; }
}

contract MockNormalizedOracle420 is IExchangeReferenceOracle420 {
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

contract ExchangeOracleGuard420NormalizationTest {
    bytes32 private constant MARKET = keccak256("420/exchange/v7/normalized-market");

    ExchangeOracleGuard420 private guard;
    MockNormalizedOracle420 private oracle;
    MockNormalizedToken420 private base18;
    MockNormalizedToken420 private quote6;
    MockNormalizedToken420 private invalidDecimals;

    constructor() {
        guard = new ExchangeOracleGuard420(address(this));
        oracle = new MockNormalizedOracle420();
        base18 = new MockNormalizedToken420(18);
        quote6 = new MockNormalizedToken420(6);
        invalidDecimals = new MockNormalizedToken420(37);

        oracle.set(2e18, block.timestamp);
        guard.configureGuard(MARKET, address(oracle), 1 days, 100, true);
    }

    function testNormalizesCrossDecimalExecutionPrice() public view {
        uint256 price = guard.normalizedExecutionPriceE18(
            address(base18),
            address(quote6),
            1 ether,
            2_000_000
        );
        require(price == 2e18, "cross-decimal price");
    }

    function testHealthyCrossDecimalAmountsPass() public view {
        uint256 price = guard.requireHealthyAmounts(
            MARKET,
            address(base18),
            address(quote6),
            5 ether,
            10_000_000
        );
        require(price == 2e18, "healthy normalized price");
    }

    function testDeviationFailsClosedAfterNormalization() public {
        (bool ok,) = address(guard).call(
            abi.encodeWithSelector(
                guard.requireHealthyAmounts.selector,
                MARKET,
                address(base18),
                address(quote6),
                1 ether,
                3_000_000
            )
        );
        require(!ok, "deviation accepted");
    }

    function testInvalidDecimalsFailClosed() public {
        (bool ok,) = address(guard).call(
            abi.encodeWithSelector(
                guard.normalizedExecutionPriceE18.selector,
                address(invalidDecimals),
                address(quote6),
                1 ether,
                2_000_000
            )
        );
        require(!ok, "invalid decimals accepted");
    }

    function testTinyHighPrecisionAmountFailsClosed() public {
        MockNormalizedToken420 base36 = new MockNormalizedToken420(36);
        (bool ok,) = address(guard).call(
            abi.encodeWithSelector(
                guard.normalizedExecutionPriceE18.selector,
                address(base36),
                address(quote6),
                1,
                2_000_000
            )
        );
        require(!ok, "zero-normalized base accepted");
    }
}
