// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

/// @notice Governance-versioned registry of approved randomness provider routes.
/// @dev A route can represent a threshold committee or multi-provider adapter; applications never select operators directly.
contract RandomnessRouteRegistry420 is SystemAccess, I420System {
    struct Route {
        address operator;
        address verifier;
        bytes32 methodId;
        bytes32 stakeReference;
        bytes32 metadataHash;
        uint32 revision;
        bool active;
    }

    mapping(bytes32 => Route) private _routes;

    error InvalidRoute();
    error InvalidOperator();
    error InvalidVerifier();

    event RouteSet(
        bytes32 indexed routeId,
        uint32 indexed revision,
        address indexed operator,
        address verifier,
        bytes32 methodId,
        bytes32 stakeReference,
        bytes32 metadataHash,
        bool active
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "RandomnessRouteRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setRoute(
        bytes32 routeId,
        address operator,
        address verifier,
        bytes32 methodId,
        bytes32 stakeReference,
        bytes32 metadataHash,
        bool active
    ) external onlyGovernance {
        if (routeId == bytes32(0) || methodId == bytes32(0)) revert InvalidRoute();
        if (operator == address(0)) revert InvalidOperator();
        if (verifier == address(0)) revert InvalidVerifier();

        Route storage route = _routes[routeId];
        uint32 nextRevision = route.revision + 1;
        route.operator = operator;
        route.verifier = verifier;
        route.methodId = methodId;
        route.stakeReference = stakeReference;
        route.metadataHash = metadataHash;
        route.revision = nextRevision;
        route.active = active;

        emit RouteSet(routeId, nextRevision, operator, verifier, methodId, stakeReference, metadataHash, active);
    }

    function route(bytes32 routeId) external view returns (Route memory) {
        return _routes[routeId];
    }

    function isAuthorizedOperator(bytes32 routeId, address operator) external view returns (bool) {
        Route storage route_ = _routes[routeId];
        return route_.active && route_.operator == operator;
    }
}