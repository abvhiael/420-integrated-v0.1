// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/oracle/OracleProviderRegistry420.sol";
import "../src/oracle/OracleFeedRegistry420.sol";
import "../src/oracle/OracleRiskPolicy420.sol";
import "../src/oracle/OracleRouter420.sol";
import "../src/oracle/OracleIds420.sol";
import "../src/interfaces/IOracle420.sol";

interface VmOracle420Risk {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract Oracle420RiskTest {
    VmOracle420Risk internal constant vm = VmOracle420Risk(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 internal constant FEED = keccak256("risk-feed");
    bytes32 internal constant A = keccak256("a");
    bytes32 internal constant B = keccak256("b");
    bytes32 internal constant C = keccak256("c");
    address internal constant OA = address(0xA1);
    address internal constant OB = address(0xB1);
    address internal constant OC = address(0xC1);

    function _deploy()
        private
        returns (OracleFeedRegistry420 feeds, OracleRiskPolicy420 risk, OracleRouter420 router)
    {
        OracleProviderRegistry420 providers = new OracleProviderRegistry420(address(this));
        providers.setProvider(A, OA, bytes32(0), bytes32(0), true);
        providers.setProvider(B, OB, bytes32(0), bytes32(0), true);
        providers.setProvider(C, OC, bytes32(0), bytes32(0), true);
        feeds = new OracleFeedRegistry420(address(this), address(providers));
        feeds.setFeed(FEED, OracleIds420.FEED_PRICE, OracleIds420.AGGREGATION_MEDIAN_NUMERIC, 60, 8, 2, bytes32(0), true);
        feeds.setSource(FEED, A, true);
        feeds.setSource(FEED, B, true);
        feeds.setSource(FEED, C, true);
        risk = new OracleRiskPolicy420(address(this));
        router = new OracleRouter420(address(this), address(providers), address(feeds), address(risk));
    }

    function _submit(OracleRouter420 router, address op, bytes32 provider, bytes32 id, int256 value, uint16 confidence) private {
        vm.prank(op);
        router.submitObservation(FEED, provider, id, value, bytes32(0), bytes32(0), 990, confidence);
    }

    function testLowConfidenceSourcesDoNotSatisfyQuorum() public {
        (, OracleRiskPolicy420 risk, OracleRouter420 router) = _deploy();
        risk.setPolicy(FEED, 9_000, 5_000, false);
        vm.warp(1_000);
        _submit(router, OA, A, keccak256("a1"), 100, 9_500);
        _submit(router, OB, B, keccak256("b1"), 101, 8_000);
        vm.expectRevert(OracleRouter420.InsufficientFreshSources.selector);
        router.readNumeric(FEED);
    }

    function testExcessiveDeviationFailsClosed() public {
        (, OracleRiskPolicy420 risk, OracleRouter420 router) = _deploy();
        risk.setPolicy(FEED, 8_000, 1_000, false);
        vm.warp(1_000);
        _submit(router, OA, A, keccak256("a2"), 100, 9_500);
        _submit(router, OB, B, keccak256("b2"), 105, 9_500);
        _submit(router, OC, C, keccak256("c2"), 160, 9_500);
        vm.expectRevert(OracleRouter420.ExcessiveDeviation.selector);
        router.readNumeric(FEED);
    }

    function testCircuitBreakerHaltsReadWithoutDeletingObservations() public {
        (, OracleRiskPolicy420 risk, OracleRouter420 router) = _deploy();
        risk.setPolicy(FEED, 8_000, 5_000, false);
        vm.warp(1_000);
        _submit(router, OA, A, keccak256("a3"), 100, 9_500);
        _submit(router, OB, B, keccak256("b3"), 101, 9_400);
        IOracle420.NumericRead memory beforeHalt = router.readNumeric(FEED);
        require(beforeHalt.value == 101, "pre-halt read");

        risk.setPolicy(FEED, 8_000, 5_000, true);
        vm.expectRevert(OracleRouter420.CircuitBreakerActive.selector);
        router.readNumeric(FEED);

        risk.setPolicy(FEED, 8_000, 5_000, false);
        IOracle420.NumericRead memory afterHalt = router.readNumeric(FEED);
        require(afterHalt.value == 101, "observations lost");
    }
}
