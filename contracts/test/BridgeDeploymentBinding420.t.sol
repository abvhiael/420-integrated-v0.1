// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/interfaces/genesis/Types420.sol";
import "../src/bridge/VerifiedGateway420.sol";
import "../src/bridge/GatewayRouter420.sol";
import "../src/bridge/BridgeRiskManager.sol";
import "../src/bridge/BridgeTransferRegistry.sol";
import "../src/bridge/BridgeAssetRegistry.sol";
import "../src/bridge/BridgeChainRegistry420.sol";
import "../src/bridge/BridgeRouteRegistry.sol";
import "../src/bridge/BridgeAccountingRegistry.sol";
import "../src/bridge/CADCBridgeIntegration.sol";

contract BridgeDeploymentBinding420Test {
    function _v() private pure returns (Types420.Version memory) {
        return Types420.Version({major:1,minor:0,patch:0});
    }

    function _register(ProtocolRegistry registry, address implementation, bytes32 id) private {
        registry.registerComponent(id, implementation, _v(), Types420.Lifecycle.ACTIVE);
        require(registry.resolve(id) == implementation, "resolve");
        require(registry.runtimeCodeHash(id) == implementation.codehash, "codehash");
        require(registry.supportsVersion(id, _v()), "version");
    }

    function testCanonicalBridgeComponentPublicationGraph() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        bytes32 genesisHash = keccak256("bridge-audit-6");

        VerifiedGateway420 verified =
            new VerifiedGateway420(address(this), address(registry), genesisHash, address(0));
        GatewayRouter420 router = new GatewayRouter420(address(this), address(registry), genesisHash);
        BridgeRiskManager risk = new BridgeRiskManager(address(this), address(registry), genesisHash);
        BridgeTransferRegistry transfers = new BridgeTransferRegistry(address(this), address(registry), genesisHash);
        BridgeAssetRegistry assets = new BridgeAssetRegistry(address(this), address(registry), genesisHash);
        BridgeChainRegistry420 chains = new BridgeChainRegistry420(address(this), address(registry), genesisHash);
        BridgeRouteRegistry routes = new BridgeRouteRegistry(address(this), address(registry), genesisHash);
        BridgeAccountingRegistry accounting =
            new BridgeAccountingRegistry(address(this), address(registry), genesisHash);
        CADCBridgeIntegration cadc = new CADCBridgeIntegration(address(this), address(registry), genesisHash);

        _register(registry, address(verified), verified.componentId());
        _register(registry, address(router), router.componentId());
        _register(registry, address(risk), risk.componentId());
        _register(registry, address(transfers), transfers.componentId());
        _register(registry, address(assets), assets.componentId());
        _register(registry, address(chains), chains.componentId());
        _register(registry, address(routes), routes.componentId());
        _register(registry, address(accounting), accounting.componentId());
        _register(registry, address(cadc), cadc.componentId());

        require(verified.verifier() == address(0), "gateway must begin disabled");
        require(address(router) != address(0x443), "retired router address");
        require(address(assets) != address(0x43c), "retired asset address");
    }

    function testRegistryRejectsAddressWithoutCode() public {
        ProtocolRegistry registry = new ProtocolRegistry(address(this));
        (bool ok,) = address(registry).call(
            abi.encodeCall(
                registry.registerComponent,
                (
                    keccak256("420/APP/420BRIDGE/GATEWAY_ROUTER"),
                    address(0x4444),
                    _v(),
                    Types420.Lifecycle.ACTIVE
                )
            )
        );
        require(!ok, "no-code address published");
    }
}
