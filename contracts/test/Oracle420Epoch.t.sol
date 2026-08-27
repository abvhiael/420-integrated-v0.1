// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/oracle/OracleProviderRegistry420.sol";
import "../src/oracle/OracleFeedRegistry420.sol";
import "../src/oracle/OracleRouter420.sol";
import "../src/oracle/OracleIds420.sol";

interface VmOracle420Epoch {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract Oracle420EpochTest {
    VmOracle420Epoch internal constant vm = VmOracle420Epoch(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant OP = address(0xA11CE);
    bytes32 internal constant PROVIDER = keccak256("provider");
    bytes32 internal constant FEED = keccak256("feed");

    function _deploy()
        private
        returns (OracleProviderRegistry420 providers, OracleFeedRegistry420 feeds, OracleRouter420 router)
    {
        providers = new OracleProviderRegistry420(address(this));
        providers.setProvider(PROVIDER, OP, bytes32(0), bytes32(0), true);
        feeds = new OracleFeedRegistry420(address(this), address(providers));
        feeds.setFeed(FEED, OracleIds420.FEED_PRICE, OracleIds420.AGGREGATION_MEDIAN_NUMERIC, 600, 8, 1, bytes32(0), true);
        feeds.setSource(FEED, PROVIDER, true);
        router = new OracleRouter420(address(this), address(providers), address(feeds));
    }

    function _submit(OracleRouter420 router, bytes32 id, uint64 observedAt) private {
        vm.prank(OP);
        router.submitObservation(FEED, PROVIDER, id, 100, bytes32(0), bytes32(0), observedAt, 10_000);
    }

    function testFeedRevisionInvalidatesPriorObservation() public {
        (, OracleFeedRegistry420 feeds, OracleRouter420 router) = _deploy();
        vm.warp(1_000);
        _submit(router, keccak256("before-revision"), 990);
        router.readNumeric(FEED);

        feeds.setFeed(FEED, OracleIds420.FEED_PRICE, OracleIds420.AGGREGATION_MEDIAN_NUMERIC, 600, 8, 1, keccak256("new-config"), true);
        vm.expectRevert(OracleRouter420.InsufficientFreshSources.selector);
        router.readNumeric(FEED);

        _submit(router, keccak256("after-revision"), 991);
        router.readNumeric(FEED);
    }

    function testSourceReactivationInvalidatesPriorObservation() public {
        (, OracleFeedRegistry420 feeds, OracleRouter420 router) = _deploy();
        vm.warp(1_000);
        _submit(router, keccak256("source-before"), 990);
        feeds.setSource(FEED, PROVIDER, false);
        feeds.setSource(FEED, PROVIDER, true);

        vm.expectRevert(OracleRouter420.InsufficientFreshSources.selector);
        router.readNumeric(FEED);

        _submit(router, keccak256("source-after"), 991);
        router.readNumeric(FEED);
    }

    function testProviderReactivationInvalidatesPriorObservation() public {
        (OracleProviderRegistry420 providers,, OracleRouter420 router) = _deploy();
        vm.warp(1_000);
        _submit(router, keccak256("provider-before"), 990);
        providers.setProvider(PROVIDER, OP, bytes32(0), bytes32(0), false);
        providers.setProvider(PROVIDER, OP, bytes32(0), bytes32(0), true);

        vm.expectRevert(OracleRouter420.InsufficientFreshSources.selector);
        router.readNumeric(FEED);

        _submit(router, keccak256("provider-after"), 991);
        router.readNumeric(FEED);
    }
}
