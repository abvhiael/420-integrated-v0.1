// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../libraries/AppDependencyIds420.sol";

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "../interfaces/genesis/IRiskLimits420.sol";
import "../libraries/GenesisInterfaceIds420.sol";
import "./BridgeIds420.sol";

contract BridgeRiskManager is GenesisResidentAccess420 {
    struct Limits {
        uint256 maxSingle;
        uint256 maxHourlyIn;
        uint256 maxHourlyOut;
        uint256 maxDailyIn;
        uint256 maxDailyOut;
        uint256 maxTVL;
    }
    struct Usage {
        uint64 hourIndex;
        uint64 dayIndex;
        uint256 hourlyIn;
        uint256 hourlyOut;
        uint256 dailyIn;
        uint256 dailyOut;
        uint256 currentTVL;
    }

    mapping(bytes32 => Limits) public routeLimits;
    mapping(bytes32 => Limits) public assetLimits;
    mapping(bytes32 => Usage) public routeUsage;
    mapping(bytes32 => Usage) public assetUsage;
    mapping(address => bool) public trustedRouter;

    event LimitsSet(bytes32 indexed id, bool assetLevel);
    event RouterSet(address indexed router, bool trusted);
    event Consumed(bytes32 indexed routeId, bytes32 indexed assetId, bool inbound, uint256 amount);

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) { return BridgeIds420.RISK_MANAGER; }

    function setRouter(address router, bool trusted) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        require(router != address(0) && router.code.length != 0, "router");
        trustedRouter[router] = trusted;
        emit RouterSet(router, trusted);
    }

    function setRouteLimits(bytes32 id, Limits calldata l) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        require(id != bytes32(0), "id");
        routeLimits[id] = l;
        emit LimitsSet(id, false);
    }

    function setAssetLimits(bytes32 id, Limits calldata l) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        require(id != bytes32(0), "id");
        assetLimits[id] = l;
        emit LimitsSet(id, true);
    }

    function _roll(Usage storage u) internal {
        uint64 h = uint64(block.timestamp / 1 hours);
        uint64 d = uint64(block.timestamp / 1 days);
        if (u.hourIndex != h) { u.hourIndex = h; u.hourlyIn = 0; u.hourlyOut = 0; }
        if (u.dayIndex != d) { u.dayIndex = d; u.dailyIn = 0; u.dailyOut = 0; }
    }

    function _consume(Usage storage u, Limits memory l, bool inbound, uint256 amount) internal {
        _roll(u);
        require(l.maxSingle > 0 && amount > 0 && amount <= l.maxSingle, "single cap");
        if (inbound) {
            require(u.hourlyIn + amount <= l.maxHourlyIn, "hourly in");
            require(u.dailyIn + amount <= l.maxDailyIn, "daily in");
            require(u.currentTVL + amount <= l.maxTVL, "tvl");
            u.hourlyIn += amount; u.dailyIn += amount; u.currentTVL += amount;
        } else {
            require(u.hourlyOut + amount <= l.maxHourlyOut, "hourly out");
            require(u.dailyOut + amount <= l.maxDailyOut, "daily out");
            require(amount <= u.currentTVL, "tvl underflow");
            u.hourlyOut += amount; u.dailyOut += amount; u.currentTVL -= amount;
        }
    }

    function consume(bytes32 routeId, bytes32 assetId, bool inbound, uint256 amount) external {
        require(trustedRouter[msg.sender], "router");
        bytes32 action = inbound ? BridgeIds420.ACTION_INBOUND : BridgeIds420.ACTION_OUTBOUND;
        _requireOperational(
            action,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            inbound ? Types420.Direction.INBOUND : Types420.Direction.OUTBOUND
        );

        IRiskLimits420 sharedRisk = IRiskLimits420(_resolveRequired(AppDependencyIds420.RISK_LIMITS));
        IRiskLimits420.LimitView memory sharedLimit = sharedRisk.limit(
            routeId, inbound ? BridgeIds420.LIMIT_HOURLY_IN : BridgeIds420.LIMIT_HOURLY_OUT
        );
        require(sharedLimit.maximum > 0 && amount <= sharedLimit.remaining, "shared risk limit");

        _consume(routeUsage[routeId], routeLimits[routeId], inbound, amount);
        _consume(assetUsage[assetId], assetLimits[assetId], inbound, amount);
        emit Consumed(routeId, assetId, inbound, amount);
    }
}
