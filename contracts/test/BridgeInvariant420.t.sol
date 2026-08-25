// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/BridgeRiskManager.sol";
import "./helpers/GenesisMocks420.sol";
import "./helpers/InvariantTarget420.sol";

contract BridgeRiskInvariantHandler420 {
    BridgeRiskManager public immutable risk;
    bytes32 public immutable routeId;
    bytes32 public immutable assetId;
    uint256 public immutable cap;
    uint256 public modelTVL;
    uint256 public modelInbound;
    uint256 public modelOutbound;

    constructor(BridgeRiskManager risk_, bytes32 routeId_, bytes32 assetId_, uint256 cap_) {
        risk = risk_; routeId = routeId_; assetId = assetId_; cap = cap_;
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function step(bool inbound, uint96 rawAmount) external {
        if (inbound) {
            uint256 tvlRoom = cap - modelTVL;
            uint256 directionalRoom = cap - modelInbound;
            uint256 room = _min(tvlRoom, directionalRoom);
            if (room == 0) return;
            uint256 amount = (uint256(rawAmount) % room) + 1;
            risk.consume(routeId, assetId, true, amount);
            modelTVL += amount;
            modelInbound += amount;
        } else {
            uint256 directionalRoom = cap - modelOutbound;
            uint256 room = _min(modelTVL, directionalRoom);
            if (room == 0) return;
            uint256 amount = (uint256(rawAmount) % room) + 1;
            risk.consume(routeId, assetId, false, amount);
            modelTVL -= amount;
            modelOutbound += amount;
        }
    }
}

contract BridgeInvariant420Test is InvariantTarget420 {
    bytes32 constant ROUTE_ID = keccak256("route");
    bytes32 constant ASSET_ID = keccak256("asset");
    uint256 constant CAP = 1_000_000 ether;
    BridgeRiskManager internal risk;
    BridgeRiskInvariantHandler420 internal handler;

    function setUp() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        risk = new BridgeRiskManager(address(this), address(env.registry()), keccak256("risk"));
        env.registerResident(address(risk), risk.componentId());
        BridgeRiskManager.Limits memory limits = BridgeRiskManager.Limits(CAP,CAP,CAP,CAP,CAP,CAP);
        risk.setRouteLimits(ROUTE_ID, limits);
        risk.setAssetLimits(ASSET_ID, limits);
        handler = new BridgeRiskInvariantHandler420(risk, ROUTE_ID, ASSET_ID, CAP);
        risk.setRouter(address(handler), true);
        targetContract(address(handler));
    }

    function invariant_RouteAndAssetTVLAgreeWithModel() public view {
        (,,uint256 routeHourlyIn,uint256 routeHourlyOut,uint256 routeDailyIn,uint256 routeDailyOut,uint256 routeTVL) =
            risk.routeUsage(ROUTE_ID);
        (,,uint256 assetHourlyIn,uint256 assetHourlyOut,uint256 assetDailyIn,uint256 assetDailyOut,uint256 assetTVL) =
            risk.assetUsage(ASSET_ID);
        require(routeTVL == handler.modelTVL(), "route model");
        require(assetTVL == handler.modelTVL(), "asset model");
        require(routeHourlyIn == handler.modelInbound(), "route hourly in model");
        require(assetHourlyIn == handler.modelInbound(), "asset hourly in model");
        require(routeDailyIn == handler.modelInbound(), "route daily in model");
        require(assetDailyIn == handler.modelInbound(), "asset daily in model");
        require(routeHourlyOut == handler.modelOutbound(), "route hourly out model");
        require(assetHourlyOut == handler.modelOutbound(), "asset hourly out model");
        require(routeDailyOut == handler.modelOutbound(), "route daily out model");
        require(assetDailyOut == handler.modelOutbound(), "asset daily out model");
        require(routeTVL <= CAP, "cap");
    }
}
