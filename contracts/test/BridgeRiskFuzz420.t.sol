// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/BridgeRiskManager.sol";
import "./helpers/GenesisMocks420.sol";

contract BridgeRiskFuzz420Test {
    bytes32 constant ROUTE_ID = keccak256("route");
    bytes32 constant ASSET_ID = keccak256("asset");

    function _limits(uint256 max) internal pure returns (BridgeRiskManager.Limits memory) {
        return BridgeRiskManager.Limits(max, max, max, max, max, max);
    }

    function testFuzz_InboundUsageNeverExceedsConfiguredCaps(uint96 rawAmount) public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        BridgeRiskManager risk = new BridgeRiskManager(address(this), address(env.registry()), keccak256("risk"));
        env.registerResident(address(risk), risk.componentId());
        risk.setRouter(address(this), true);
        risk.setRouteLimits(ROUTE_ID, _limits(1_000_000 ether));
        risk.setAssetLimits(ASSET_ID, _limits(1_000_000 ether));
        uint256 amount = (uint256(rawAmount) % 1_000_000 ether) + 1;
        risk.consume(ROUTE_ID, ASSET_ID, true, amount);
        (,,uint256 hourlyIn,,uint256 dailyIn,,uint256 tvl) = risk.routeUsage(ROUTE_ID);
        require(hourlyIn <= 1_000_000 ether && dailyIn <= 1_000_000 ether && tvl <= 1_000_000 ether, "cap");
    }

    function testFuzz_SingleCapRejectsExcess(uint96 extra) public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        BridgeRiskManager risk = new BridgeRiskManager(address(this), address(env.registry()), keccak256("risk"));
        env.registerResident(address(risk), risk.componentId());
        risk.setRouter(address(this), true);
        risk.setRouteLimits(ROUTE_ID, _limits(100 ether));
        risk.setAssetLimits(ASSET_ID, _limits(100 ether));
        uint256 amount = 100 ether + (uint256(extra) % 100 ether) + 1;
        (bool ok,) = address(risk).call(abi.encodeWithSelector(risk.consume.selector, ROUTE_ID, ASSET_ID, true, amount));
        require(!ok, "single cap exceeded");
    }
}
