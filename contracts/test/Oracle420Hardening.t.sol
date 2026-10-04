// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/oracle/OracleProviderRegistry420.sol";
import "../src/oracle/OracleFeedRegistry420.sol";
import "../src/oracle/OracleRiskPolicy420.sol";
import "../src/oracle/OracleRouter420.sol";
import "../src/oracle/OracleIds420.sol";

interface VmOracle420Hardening {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract Oracle420HardeningTest {
    VmOracle420Hardening internal constant vm =
        VmOracle420Hardening(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testRejectsInvalidObservationEnvelope() public {
        OracleProviderRegistry420 providers = new OracleProviderRegistry420(address(this));
        OracleFeedRegistry420 feeds = new OracleFeedRegistry420(address(this), address(providers));
        OracleRiskPolicy420 risk = new OracleRiskPolicy420(address(this));
        OracleRouter420 router = new OracleRouter420(address(this), address(providers), address(feeds), address(risk));

        bytes32 providerId = keccak256("provider");
        bytes32 feedId = keccak256("feed");
        address operator = address(0xA11CE);
        providers.setProvider(providerId, operator, bytes32(0), bytes32(0), true);
        feeds.setFeed(feedId, OracleIds420.FEED_PRICE, OracleIds420.AGGREGATION_MEDIAN_NUMERIC, 60, 8, 1, bytes32(0), true);
        feeds.setSource(feedId, providerId, true);
        vm.warp(1000);

        vm.prank(operator);
        vm.expectRevert(OracleRouter420.InvalidObservation.selector);
        router.submitObservation(feedId, providerId, bytes32(0), 1, bytes32(0), bytes32(0), 999, 10_000);

        vm.prank(operator);
        vm.expectRevert(OracleRouter420.InvalidObservation.selector);
        router.submitObservation(feedId, providerId, keccak256("future"), 1, bytes32(0), bytes32(0), 1001, 10_000);

        vm.prank(operator);
        vm.expectRevert(OracleRouter420.InvalidObservation.selector);
        router.submitObservation(feedId, providerId, keccak256("confidence"), 1, bytes32(0), bytes32(0), 999, 10_001);
    }

    function testConfiguredSourceSetIsBoundedToSixteen() public {
        OracleProviderRegistry420 providers = new OracleProviderRegistry420(address(this));
        OracleFeedRegistry420 feeds = new OracleFeedRegistry420(address(this), address(providers));
        bytes32 feedId = keccak256("bounded-feed");
        feeds.setFeed(feedId, OracleIds420.FEED_PRICE, OracleIds420.AGGREGATION_MEDIAN_NUMERIC, 60, 8, 1, bytes32(0), true);

        for (uint256 i = 1; i <= 16; ++i) {
            bytes32 providerId = bytes32(i);
            providers.setProvider(providerId, address(uint160(0x1000 + i)), bytes32(0), bytes32(0), true);
            feeds.setSource(feedId, providerId, true);
        }

        bytes32 seventeenth = bytes32(uint256(17));
        providers.setProvider(seventeenth, address(0x2011), bytes32(0), bytes32(0), true);
        vm.expectRevert(OracleFeedRegistry420.TooManySources.selector);
        feeds.setSource(feedId, seventeenth, true);
    }

    function testRiskPolicyRejectsOutOfRangeBasisPoints() public {
        OracleRiskPolicy420 risk = new OracleRiskPolicy420(address(this));
        bytes32 feedId = keccak256("risk");
        vm.expectRevert(OracleRiskPolicy420.InvalidConfidence.selector);
        risk.setPolicy(feedId, 10_001, 0, false);
        vm.expectRevert(OracleRiskPolicy420.InvalidDeviation.selector);
        risk.setPolicy(feedId, 0, 10_001, false);
    }

    function testInactiveFeedCannotAcceptOrReturnObservations() public {
        OracleProviderRegistry420 providers = new OracleProviderRegistry420(address(this));
        OracleFeedRegistry420 feeds = new OracleFeedRegistry420(address(this), address(providers));
        OracleRiskPolicy420 risk = new OracleRiskPolicy420(address(this));
        OracleRouter420 router = new OracleRouter420(address(this), address(providers), address(feeds), address(risk));
        bytes32 providerId = keccak256("provider");
        bytes32 feedId = keccak256("inactive-feed");
        address operator = address(0xB0B);
        providers.setProvider(providerId, operator, bytes32(0), bytes32(0), true);
        feeds.setFeed(feedId, OracleIds420.FEED_PRICE, OracleIds420.AGGREGATION_MEDIAN_NUMERIC, 60, 8, 1, bytes32(0), false);
        feeds.setSource(feedId, providerId, true);
        vm.warp(1000);

        vm.prank(operator);
        vm.expectRevert(OracleRouter420.InactiveFeed.selector);
        router.submitObservation(feedId, providerId, keccak256("obs"), 1, bytes32(0), bytes32(0), 999, 10_000);

        vm.expectRevert(OracleRouter420.InactiveFeed.selector);
        router.readNumeric(feedId);
    }
}
