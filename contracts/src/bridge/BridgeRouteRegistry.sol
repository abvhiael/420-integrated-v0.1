// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "./BridgeIds420.sol";
import "./BridgeChainRegistry420.sol";

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
    struct ChainBinding {
        bytes32 sourceChainKey;
        bytes32 sourceNetworkId;
        bytes32 destinationChainKey;
        bytes32 destinationNetworkId;
    }

    mapping(bytes32 => Route) public routes;
    mapping(bytes32 => ChainBinding) public chainBindings;

    event RouteSet(bytes32 indexed routeId, bytes32 indexed assetId, uint32 version, Status status);
    event DirectionSet(bytes32 indexed routeId, bool inboundEnabled, bool outboundEnabled);
    event RouteChainBindingSet(
        bytes32 indexed routeId,
        bytes32 indexed sourceChainKey,
        bytes32 indexed destinationChainKey,
        bytes32 sourceNetworkId,
        bytes32 destinationNetworkId
    );

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) { return BridgeIds420.ROUTE_REGISTRY; }

    function setRoute(bytes32 routeId, Route calldata r) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        require(routeId != 0 && r.assetId != 0 && r.adapterId != 0 && r.verifierConfigHash != 0, "invalid");
        require(r.sourceChainId != 0 && r.destinationChainId != 0, "chain id");
        require(r.sourceChainId != r.destinationChainId && r.version > 0, "route");

        if (r.status == Status.ACTIVE) {
            (bytes32 sourceChainKey, bytes32 sourceNetworkId) = _activeChainIdentity(r.sourceChainId);
            (bytes32 destinationChainKey, bytes32 destinationNetworkId) = _activeChainIdentity(r.destinationChainId);
            require(sourceChainKey != destinationChainKey, "same chain");

            chainBindings[routeId] = ChainBinding({
                sourceChainKey: sourceChainKey,
                sourceNetworkId: sourceNetworkId,
                destinationChainKey: destinationChainKey,
                destinationNetworkId: destinationNetworkId
            });
            emit RouteChainBindingSet(
                routeId,
                sourceChainKey,
                destinationChainKey,
                sourceNetworkId,
                destinationNetworkId
            );
        } else {
            delete chainBindings[routeId];
        }

        routes[routeId] = r;
        emit RouteSet(routeId, r.assetId, r.version, r.status);
    }

    function setDirection(bytes32 routeId, bool inbound, bool outbound) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        require(routes[routeId].status != Status.NONE, "unknown");
        if (routes[routeId].status == Status.ACTIVE) _requireCurrentChainBinding(routeId);
        routes[routeId].inboundEnabled = inbound;
        routes[routeId].outboundEnabled = outbound;
        emit DirectionSet(routeId, inbound, outbound);
    }

    /// @notice Returns true only while both route-chain identities still match the canonical registry
    ///         snapshot captured when the route was activated.
    function routeChainsCurrent(bytes32 routeId) public view returns (bool) {
        Route memory r = routes[routeId];
        ChainBinding memory b = chainBindings[routeId];
        if (
            r.status != Status.ACTIVE || b.sourceChainKey == bytes32(0) || b.destinationChainKey == bytes32(0)
                || b.sourceNetworkId == bytes32(0) || b.destinationNetworkId == bytes32(0)
        ) return false;

        BridgeChainRegistry420 chains = BridgeChainRegistry420(_resolveRequired(BridgeIds420.CHAIN_REGISTRY));
        return _bindingCurrent(chains, b.sourceChainKey, r.sourceChainId, b.sourceNetworkId)
            && _bindingCurrent(chains, b.destinationChainKey, r.destinationChainId, b.destinationNetworkId);
    }

    function requireRouteChainsCurrent(bytes32 routeId) external view {
        _requireCurrentChainBinding(routeId);
    }

    function _bindingCurrent(
        BridgeChainRegistry420 chains,
        bytes32 chainKey,
        uint64 routeChainId,
        bytes32 expectedNetworkId
    ) private view returns (bool) {
        if (chains.chainKeyByRouteId(routeChainId) != chainKey || !chains.isActiveRoute(chainKey, routeChainId)) {
            return false;
        }
        (
            uint64 currentRouteChainId,
            bytes32 currentNetworkId,
            bytes32 nativeAssetId,
            bytes32 verifierFamily,
            BridgeChainRegistry420.ChainFamily family,
            bool active
        ) = chains.chains(chainKey);
        return active && currentRouteChainId == routeChainId && currentNetworkId == expectedNetworkId
            && nativeAssetId != bytes32(0) && verifierFamily != bytes32(0)
            && family != BridgeChainRegistry420.ChainFamily.NONE;
    }

    function _activeChainIdentity(uint64 routeChainId) private view returns (bytes32 chainKey, bytes32 networkId) {
        BridgeChainRegistry420 chains = BridgeChainRegistry420(_resolveRequired(BridgeIds420.CHAIN_REGISTRY));
        chainKey = chains.chainKeyByRouteId(routeChainId);
        require(chainKey != bytes32(0), "unknown chain");

        (
            uint64 configuredRouteChainId,
            bytes32 configuredNetworkId,
            bytes32 nativeAssetId,
            bytes32 verifierFamily,
            BridgeChainRegistry420.ChainFamily family,
            bool active
        ) = chains.chains(chainKey);
        require(
            active && configuredRouteChainId == routeChainId && configuredNetworkId != bytes32(0)
                && nativeAssetId != bytes32(0) && verifierFamily != bytes32(0)
                && family != BridgeChainRegistry420.ChainFamily.NONE
                && chains.isActiveRoute(chainKey, routeChainId),
            "inactive chain"
        );
        networkId = configuredNetworkId;
    }

    function _requireCurrentChainBinding(bytes32 routeId) private view {
        require(routeChainsCurrent(routeId), "stale chain");
    }
}
