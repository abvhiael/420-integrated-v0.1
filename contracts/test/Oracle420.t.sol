// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/oracle/OracleProviderRegistry420.sol";
import "../src/oracle/OracleFeedRegistry420.sol";
import "../src/oracle/OracleRiskPolicy420.sol";
import "../src/oracle/OracleRouter420.sol";
import "../src/oracle/OracleIds420.sol";
import "../src/interfaces/IOracle420.sol";

interface VmOracle420 {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract Oracle420Test {
    VmOracle420 internal constant vm = VmOracle420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant OP_A = address(0xA11CE);
    address internal constant OP_B = address(0xB0B);
    address internal constant OP_C = address(0xCA11);
    address internal constant OP_D = address(0xD00D);

    bytes32 internal constant PROVIDER_A = keccak256("provider-a");
    bytes32 internal constant PROVIDER_B = keccak256("provider-b");
    bytes32 internal constant PROVIDER_C = keccak256("provider-c");
    bytes32 internal constant PROVIDER_D = keccak256("provider-d");
    bytes32 internal constant PRICE_FEED = keccak256("420-usdc-price");
    bytes32 internal constant OUTCOME_FEED = keccak256("event-outcome");

    function _deploy()
        private
        returns (OracleProviderRegistry420 providers, OracleFeedRegistry420 feeds, OracleRouter420 router)
    {
        providers = new OracleProviderRegistry420(address(this));
        providers.setProvider(PROVIDER_A, OP_A, keccak256("a-meta"), bytes32(0), true);
        providers.setProvider(PROVIDER_B, OP_B, keccak256("b-meta"), bytes32(0), true);
        providers.setProvider(PROVIDER_C, OP_C, keccak256("c-meta"), bytes32(0), true);
        providers.setProvider(PROVIDER_D, OP_D, keccak256("d-meta"), bytes32(0), true);

        feeds = new OracleFeedRegistry420(address(this), address(providers));
        OracleRiskPolicy420 risk = new OracleRiskPolicy420(address(this));
        router = new OracleRouter420(address(this), address(providers), address(feeds), address(risk));
    }

    function _configurePrice(OracleFeedRegistry420 feeds, uint8 minSources) private {
        feeds.setFeed(PRICE_FEED, OracleIds420.FEED_PRICE, OracleIds420.AGGREGATION_MEDIAN_NUMERIC, 60, 8, minSources, keccak256("price-meta"), true);
        feeds.setSource(PRICE_FEED, PROVIDER_A, true);
        feeds.setSource(PRICE_FEED, PROVIDER_B, true);
        feeds.setSource(PRICE_FEED, PROVIDER_C, true);
    }

    function _submitNumeric(OracleRouter420 router, address operator, bytes32 providerId, bytes32 observationId, int256 value, uint64 observedAt) private {
        vm.prank(operator);
        router.submitObservation(PRICE_FEED, providerId, observationId, value, bytes32(0), keccak256(abi.encode(providerId, value, observedAt)), observedAt, 9_900);
    }

    function testMedianNumericRequiresFreshQuorum() public {
        (, OracleFeedRegistry420 feeds, OracleRouter420 router) = _deploy();
        _configurePrice(feeds, 3);
        vm.warp(1_000);
        _submitNumeric(router, OP_A, PROVIDER_A, keccak256("obs-a"), 100, 990);
        _submitNumeric(router, OP_B, PROVIDER_B, keccak256("obs-b"), 300, 991);
        _submitNumeric(router, OP_C, PROVIDER_C, keccak256("obs-c"), 200, 992);

        IOracle420.NumericRead memory read = router.readNumeric(PRICE_FEED);
        require(read.value == 200, "median");
        require(read.updatedAt == 990, "conservative timestamp");
        require(read.decimals == 8, "decimals");
        require(read.sourceCount == 3, "source count");
        require(read.confidenceBps == 9_900, "confidence");

        vm.warp(1_100);
        vm.expectRevert(OracleRouter420.InsufficientFreshSources.selector);
        router.readNumeric(PRICE_FEED);
    }

    function testUnauthorizedProviderCannotSubmit() public {
        (, OracleFeedRegistry420 feeds, OracleRouter420 router) = _deploy();
        _configurePrice(feeds, 1);
        vm.warp(1_000);
        vm.prank(address(0xBAD));
        vm.expectRevert(OracleRouter420.UnauthorizedProvider.selector);
        router.submitObservation(PRICE_FEED, PROVIDER_A, keccak256("bad"), 100, bytes32(0), bytes32(0), 999, 10_000);
    }

    function testObservationIdCannotReplay() public {
        (, OracleFeedRegistry420 feeds, OracleRouter420 router) = _deploy();
        _configurePrice(feeds, 1);
        vm.warp(1_000);
        bytes32 observationId = keccak256("same-observation");
        _submitNumeric(router, OP_A, PROVIDER_A, observationId, 100, 990);
        vm.prank(OP_B);
        vm.expectRevert(OracleRouter420.ObservationReplay.selector);
        router.submitObservation(PRICE_FEED, PROVIDER_B, observationId, 101, bytes32(0), bytes32(0), 991, 10_000);
    }

    function testProviderTimestampMustAdvance() public {
        (, OracleFeedRegistry420 feeds, OracleRouter420 router) = _deploy();
        _configurePrice(feeds, 1);
        vm.warp(1_000);
        _submitNumeric(router, OP_A, PROVIDER_A, keccak256("obs-1"), 100, 990);
        vm.prank(OP_A);
        vm.expectRevert(OracleRouter420.ObservationNotNewer.selector);
        router.submitObservation(PRICE_FEED, PROVIDER_A, keccak256("obs-2"), 101, bytes32(0), bytes32(0), 990, 10_000);
    }

    function testInactiveProviderDropsOutOfQuorum() public {
        (OracleProviderRegistry420 providers, OracleFeedRegistry420 feeds, OracleRouter420 router) = _deploy();
        _configurePrice(feeds, 3);
        vm.warp(1_000);
        _submitNumeric(router, OP_A, PROVIDER_A, keccak256("obs-a2"), 100, 990);
        _submitNumeric(router, OP_B, PROVIDER_B, keccak256("obs-b2"), 200, 991);
        _submitNumeric(router, OP_C, PROVIDER_C, keccak256("obs-c2"), 300, 992);
        providers.setProvider(PROVIDER_C, OP_C, keccak256("c-meta"), bytes32(0), false);
        vm.expectRevert(OracleRouter420.InsufficientFreshSources.selector);
        router.readNumeric(PRICE_FEED);
    }

    function testExactResultQuorum() public {
        (, OracleFeedRegistry420 feeds, OracleRouter420 router) = _deploy();
        feeds.setFeed(OUTCOME_FEED, OracleIds420.FEED_OUTCOME, OracleIds420.AGGREGATION_QUORUM_EQUAL, 60, 0, 2, keccak256("outcome-meta"), true);
        feeds.setSource(OUTCOME_FEED, PROVIDER_A, true);
        feeds.setSource(OUTCOME_FEED, PROVIDER_B, true);
        feeds.setSource(OUTCOME_FEED, PROVIDER_C, true);
        vm.warp(1_000);
        bytes32 winner = keccak256("HOME_WIN");
        bytes32 other = keccak256("AWAY_WIN");

        vm.prank(OP_A); router.submitObservation(OUTCOME_FEED, PROVIDER_A, keccak256("oa"), 0, winner, bytes32(0), 990, 9_000);
        vm.prank(OP_B); router.submitObservation(OUTCOME_FEED, PROVIDER_B, keccak256("ob"), 0, winner, bytes32(0), 991, 9_100);
        vm.prank(OP_C); router.submitObservation(OUTCOME_FEED, PROVIDER_C, keccak256("oc"), 0, other, bytes32(0), 992, 9_200);

        IOracle420.ResultRead memory read = router.readResult(OUTCOME_FEED);
        require(read.resultHash == winner, "wrong result");
        require(read.updatedAt == 990, "wrong timestamp");
        require(read.agreeingSources == 2, "wrong quorum");
        require(read.confidenceBps == 9_000, "wrong confidence");
    }

    function testConflictingExactQuorumsFailClosed() public {
        (, OracleFeedRegistry420 feeds, OracleRouter420 router) = _deploy();
        feeds.setFeed(OUTCOME_FEED, OracleIds420.FEED_OUTCOME, OracleIds420.AGGREGATION_QUORUM_EQUAL, 60, 0, 2, bytes32(0), true);
        feeds.setSource(OUTCOME_FEED, PROVIDER_A, true);
        feeds.setSource(OUTCOME_FEED, PROVIDER_B, true);
        feeds.setSource(OUTCOME_FEED, PROVIDER_C, true);
        feeds.setSource(OUTCOME_FEED, PROVIDER_D, true);
        vm.warp(1_000);
        bytes32 x = keccak256("X");
        bytes32 y = keccak256("Y");

        vm.prank(OP_A); router.submitObservation(OUTCOME_FEED, PROVIDER_A, keccak256("xa"), 0, x, bytes32(0), 990, 10_000);
        vm.prank(OP_B); router.submitObservation(OUTCOME_FEED, PROVIDER_B, keccak256("xb"), 0, x, bytes32(0), 991, 10_000);
        vm.prank(OP_C); router.submitObservation(OUTCOME_FEED, PROVIDER_C, keccak256("yc"), 0, y, bytes32(0), 992, 10_000);
        vm.prank(OP_D); router.submitObservation(OUTCOME_FEED, PROVIDER_D, keccak256("yd"), 0, y, bytes32(0), 993, 10_000);

        vm.expectRevert(OracleRouter420.AmbiguousQuorum.selector);
        router.readResult(OUTCOME_FEED);
    }
}
