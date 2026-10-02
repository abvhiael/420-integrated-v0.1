// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/BridgeChainRegistry420.sol";
import "../src/bridge/BridgeRouteRegistry.sol";
import "./helpers/GenesisMocks420.sol";

contract BridgeRouteChainIdentity420Test {
    bytes32 private constant EXTERNAL = keccak256("420/BRIDGE/CHAIN/TEST-EXTERNAL");
    bytes32 private constant LOCAL = keccak256("420/BRIDGE/CHAIN/420");
    bytes32 private constant OTHER = keccak256("420/BRIDGE/CHAIN/OTHER");
    bytes32 private constant ASSET = keccak256("420/BRIDGE/ASSET/TEST");
    bytes32 private constant ADAPTER = keccak256("420/BRIDGE/ADAPTER/TEST");
    uint64 private constant EXTERNAL_ID = 1001;

    struct Fixture {
        GenesisMockEnvironment420 env;
        BridgeChainRegistry420 chains;
        BridgeRouteRegistry routes;
    }

    function _setup() private returns (Fixture memory f) {
        f.env = new GenesisMockEnvironment420();
        f.chains = new BridgeChainRegistry420(address(this), address(f.env.registry()), keccak256("chains"));
        f.routes = new BridgeRouteRegistry(address(this), address(f.env.registry()), keccak256("routes"));
        f.env.registerResident(address(f.chains), f.chains.componentId());
        f.env.registerResident(address(f.routes), f.routes.componentId());
    }

    function _chain(uint64 routeChainId, bytes32 networkId, bool active)
        private
        pure
        returns (BridgeChainRegistry420.Chain memory)
    {
        return BridgeChainRegistry420.Chain({
            routeChainId: routeChainId,
            networkId: networkId,
            nativeAssetId: ASSET,
            verifierFamily: keccak256("TEST/VERIFIER"),
            family: BridgeChainRegistry420.ChainFamily.EVM,
            active: active
        });
    }

    function _route(
        uint64 sourceChainId,
        uint64 destinationChainId,
        BridgeRouteRegistry.Status status,
        bool inbound,
        bool outbound
    ) private pure returns (BridgeRouteRegistry.Route memory) {
        return BridgeRouteRegistry.Route({
            assetId: ASSET,
            sourceChainId: sourceChainId,
            destinationChainId: destinationChainId,
            sourceAsset: keccak256("source-asset"),
            destinationAsset: keccak256("destination-asset"),
            adapterId: ADAPTER,
            verifierConfigHash: keccak256("verifier-config"),
            version: 1,
            status: status,
            inboundEnabled: inbound,
            outboundEnabled: outbound
        });
    }

    function _registerHealthy(Fixture memory f) private {
        f.chains.setChain(EXTERNAL, _chain(EXTERNAL_ID, keccak256("external/mainnet"), true));
        f.chains.setChain(LOCAL, _chain(uint64(block.chainid), keccak256("420/testnet/genesis"), true));
    }

    function testActiveRouteCapturesCanonicalChainBindings() public {
        Fixture memory f = _setup();
        _registerHealthy(f);
        bytes32 routeId = keccak256("route/inbound");
        f.routes.setRoute(
            routeId,
            _route(EXTERNAL_ID, uint64(block.chainid), BridgeRouteRegistry.Status.ACTIVE, true, false)
        );
        require(f.routes.routeChainsCurrent(routeId), "canonical binding not current");
        (bytes32 sourceKey,, bytes32 destinationKey,) = f.routes.chainBindings(routeId);
        require(sourceKey == EXTERNAL && destinationKey == LOCAL, "wrong chain keys");
    }

    function testActiveRouteFailsForUnknownSourceChain() public {
        Fixture memory f = _setup();
        f.chains.setChain(LOCAL, _chain(uint64(block.chainid), keccak256("420/testnet/genesis"), true));
        bytes32 routeId = keccak256("route/unknown-source");
        (bool ok,) = address(f.routes).call(
            abi.encodeWithSelector(
                f.routes.setRoute.selector,
                routeId,
                _route(EXTERNAL_ID, uint64(block.chainid), BridgeRouteRegistry.Status.ACTIVE, true, false)
            )
        );
        require(!ok, "unknown source chain activated");
    }

    function testActiveRouteFailsForInactiveDestinationChain() public {
        Fixture memory f = _setup();
        f.chains.setChain(EXTERNAL, _chain(EXTERNAL_ID, keccak256("external/mainnet"), true));
        f.chains.setChain(LOCAL, _chain(uint64(block.chainid), keccak256("420/testnet/genesis"), false));
        bytes32 routeId = keccak256("route/inactive-destination");
        (bool ok,) = address(f.routes).call(
            abi.encodeWithSelector(
                f.routes.setRoute.selector,
                routeId,
                _route(EXTERNAL_ID, uint64(block.chainid), BridgeRouteRegistry.Status.ACTIVE, true, false)
            )
        );
        require(!ok, "inactive destination chain activated");
    }

    function testNetworkFingerprintChangeInvalidatesActiveRoute() public {
        Fixture memory f = _setup();
        _registerHealthy(f);
        bytes32 routeId = keccak256("route/fingerprint");
        f.routes.setRoute(
            routeId,
            _route(EXTERNAL_ID, uint64(block.chainid), BridgeRouteRegistry.Status.ACTIVE, true, false)
        );
        f.chains.setChain(EXTERNAL, _chain(EXTERNAL_ID, keccak256("external/testnet-or-fork"), true));
        require(!f.routes.routeChainsCurrent(routeId), "network fingerprint drift accepted");
    }

    function testRouteChainRebindingInvalidatesActiveRoute() public {
        Fixture memory f = _setup();
        _registerHealthy(f);
        bytes32 routeId = keccak256("route/rebind");
        f.routes.setRoute(
            routeId,
            _route(EXTERNAL_ID, uint64(block.chainid), BridgeRouteRegistry.Status.ACTIVE, true, false)
        );
        f.chains.setChain(EXTERNAL, _chain(EXTERNAL_ID + 1, keccak256("external/mainnet"), true));
        require(!f.routes.routeChainsCurrent(routeId), "rebound chain retained stale route");
    }

    function testDirectionSpecificRoutesBindBothCanonicalIdentities() public {
        Fixture memory f = _setup();
        _registerHealthy(f);
        bytes32 inboundRoute = keccak256("route/inbound-only");
        bytes32 outboundRoute = keccak256("route/outbound-only");

        f.routes.setRoute(
            inboundRoute,
            _route(EXTERNAL_ID, uint64(block.chainid), BridgeRouteRegistry.Status.ACTIVE, true, false)
        );
        f.routes.setRoute(
            outboundRoute,
            _route(uint64(block.chainid), EXTERNAL_ID, BridgeRouteRegistry.Status.ACTIVE, false, true)
        );

        require(f.routes.routeChainsCurrent(inboundRoute), "inbound binding");
        require(f.routes.routeChainsCurrent(outboundRoute), "outbound binding");
    }

    function testDuplicateRouteChainIdCannotBeReassignedToFork() public {
        Fixture memory f = _setup();
        f.chains.setChain(EXTERNAL, _chain(EXTERNAL_ID, keccak256("external/mainnet"), true));
        (bool ok,) = address(f.chains).call(
            abi.encodeWithSelector(
                f.chains.setChain.selector,
                OTHER,
                _chain(EXTERNAL_ID, keccak256("external/fork"), true)
            )
        );
        require(!ok, "duplicate route chain id reassigned");
    }

    function testStaleActiveRouteCannotChangeDirection() public {
        Fixture memory f = _setup();
        _registerHealthy(f);
        bytes32 routeId = keccak256("route/stale-direction");
        f.routes.setRoute(
            routeId,
            _route(EXTERNAL_ID, uint64(block.chainid), BridgeRouteRegistry.Status.ACTIVE, true, false)
        );
        f.chains.setChain(EXTERNAL, _chain(EXTERNAL_ID, keccak256("external/fork"), true));
        (bool ok,) = address(f.routes).call(
            abi.encodeWithSelector(f.routes.setDirection.selector, routeId, false, true)
        );
        require(!ok, "stale route direction changed");
    }
}
