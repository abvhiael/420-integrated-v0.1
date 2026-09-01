// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/libraries/ServiceIds420.sol";

contract AnalyticsServiceProbe420 {
    function analyticsId() external pure returns (bytes32) { return ServiceIds420.ANALYTICS; }
    function isGenesis(bytes32 id) external pure returns (bool) { return ServiceIds420.isGenesisCanonical(id); }
}

contract AnalyticsGenesis420Test {
    function testAnalyticsServiceIdIsCanonical() public {
        AnalyticsServiceProbe420 probe = new AnalyticsServiceProbe420();
        bytes32 expected = keccak256("420/service/analytics/v1");
        require(probe.analyticsId() == expected, "analytics service id mismatch");
        require(probe.isGenesis(expected), "analytics service not canonical");
    }
}
