// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "./BridgeIds420.sol";

contract BridgeRouteRegistry is GenesisResidentAccess420 {
    enum Status { NONE, APPROVED_INACTIVE, ACTIVE, SUSPENDED, DEPRECATED }
    struct Route {
        bytes32 assetId;
        uint64 sourceChainId;
        uint64 destinationChainId;
        bytes32 sourceAsset;
        bytes32 destinationAsset;
        bytes32 adapterId;
        bytes32 verifierConfigHash;
        uint32 version;
        Status status;
        bool inboundEnabled;
        bool outboundEnabled;
    }
    mapping(bytes32 => Route) public routes;
    event RouteSet(bytes32 indexed routeId, bytes32 indexed assetId, uint32 version, Status status);
    event DirectionSet(bytes32 indexed routeId, bool inboundEnabled, bool outboundEnabled);

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}
    function componentId() public pure override returns (bytes32) { return BridgeIds420.ROUTE_REGISTRY; }

    function setRoute(bytes32 routeId, Route calldata r) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        require(routeId != 0 && r.assetId != 0 && r.adapterId != 0 && r.verifierConfigHash != 0, "invalid");
        require(r.sourceChainId != r.destinationChainId && r.version > 0, "route");
        routes[routeId] = r;
        emit RouteSet(routeId, r.assetId, r.version, r.status);
    }

    function setDirection(bytes32 routeId, bool inbound, bool outbound) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        require(routes[routeId].status != Status.NONE, "unknown");
        routes[routeId].inboundEnabled = inbound;
        routes[routeId].outboundEnabled = outbound;
        emit DirectionSet(routeId, inbound, outbound);
    }
}
