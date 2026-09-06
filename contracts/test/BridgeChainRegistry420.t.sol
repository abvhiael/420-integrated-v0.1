// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/BridgeChainRegistry420.sol";
import "./helpers/GenesisMocks420.sol";

contract BridgeChainRegistry420Test {
    bytes32 private constant BTC = keccak256("420/BRIDGE/CHAIN/BTC");
    bytes32 private constant DOGE = keccak256("420/BRIDGE/CHAIN/DOGE");
    bytes32 private constant BTC_NATIVE = keccak256("420/BRIDGE/ASSET/BTC");
    bytes32 private constant DOGE_NATIVE = keccak256("420/BRIDGE/ASSET/DOGE");

    function _setup() private returns (GenesisMockEnvironment420 env, BridgeChainRegistry420 registry) {
        env = new GenesisMockEnvironment420();
        registry = new BridgeChainRegistry420(address(this), address(env.registry()), keccak256("chain-registry-v12.5.1"));
        env.registerResident(address(registry), registry.componentId());
    }

    function _chain(uint64 routeId, bytes32 nativeAsset, bool active)
        private
        pure
        returns (BridgeChainRegistry420.Chain memory c)
    {
        c = BridgeChainRegistry420.Chain({
            routeChainId: routeId,
            networkId: keccak256(abi.encodePacked("network", routeId)),
            nativeAssetId: nativeAsset,
            verifierFamily: keccak256("utxo-spv"),
            family: BridgeChainRegistry420.ChainFamily.UTXO,
            active: active
        });
    }

    function testActiveChainBindsRouteIdentity() public {
        (, BridgeChainRegistry420 registry) = _setup();
        registry.setChain(BTC, _chain(1001, BTC_NATIVE, true));
        require(registry.isActiveRoute(BTC, 1001), "route identity");
        require(registry.chainKeyByRouteId(1001) == BTC, "reverse identity");
    }

    function testInactiveChainFailsActiveRouteCheck() public {
        (, BridgeChainRegistry420 registry) = _setup();
        registry.setChain(BTC, _chain(1001, BTC_NATIVE, false));
        require(!registry.isActiveRoute(BTC, 1001), "inactive accepted");
    }

    function testDuplicateRouteIdCannotRepresentTwoChains() public {
        (, BridgeChainRegistry420 registry) = _setup();
        registry.setChain(BTC, _chain(1001, BTC_NATIVE, true));
        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(registry.setChain.selector, DOGE, _chain(1001, DOGE_NATIVE, true))
        );
        require(!ok, "duplicate route id accepted");
    }

    function testRebindingSameChainClearsOldReverseIdentity() public {
        (, BridgeChainRegistry420 registry) = _setup();
        registry.setChain(BTC, _chain(1001, BTC_NATIVE, true));
        registry.setChain(BTC, _chain(1002, BTC_NATIVE, true));
        require(registry.chainKeyByRouteId(1001) == bytes32(0), "old route retained");
        require(registry.chainKeyByRouteId(1002) == BTC, "new route missing");
        require(registry.isActiveRoute(BTC, 1002), "new route inactive");
    }

    function testMalformedIdentityFailsClosed() public {
        (, BridgeChainRegistry420 registry) = _setup();
        BridgeChainRegistry420.Chain memory c = _chain(1001, BTC_NATIVE, true);
        c.networkId = bytes32(0);
        (bool ok,) = address(registry).call(abi.encodeWithSelector(registry.setChain.selector, BTC, c));
        require(!ok, "zero network identity accepted");
    }
}
