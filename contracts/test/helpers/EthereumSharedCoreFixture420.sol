// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../src/bridge/GatewayRouter420.sol";
import "../../src/bridge/BridgeRiskManager.sol";
import "../../src/bridge/BridgeTransferRegistry.sol";
import "../../src/bridge/BridgeRouteRegistry.sol";
import "../../src/bridge/BridgeChainRegistry420.sol";
import "../../src/bridge/BridgeAccountingRegistry.sol";
import "../../src/bridge/VerifiedGateway420.sol";
import "../../src/interfaces/IBridgeAdapter420.sol";
import "../../src/interfaces/genesis/ISystemSafety420.sol";
import "./GenesisMocks420.sol";

contract EthereumCoreMockAdapter420 is IBridgeAdapter420 {
    VerifiedTransfer public nextTransfer;
    bytes32 public nextOutboundId = keccak256("outbound-message");
    bool public failInbound;
    bool public failOutbound;

    function adapterId() external pure returns (bytes32) { return keccak256("TEST/BRIDGE/ADAPTER"); }
    function setInbound(VerifiedTransfer calldata v) external { nextTransfer = v; }
    function setFail(bool inbound_, bool outbound_) external { failInbound = inbound_; failOutbound = outbound_; }
    function verifyInbound(bytes calldata) external view returns (VerifiedTransfer memory) {
        require(!failInbound, "proof failure"); return nextTransfer;
    }
    function initiateOutbound(bytes32,bytes32,address,bytes calldata,uint256,bytes calldata)
        external payable returns(bytes32 sourceMessageId)
    { require(!failOutbound, "outbound failure"); return nextOutboundId; }
}

contract EthereumCoreWrongAdapter420 is IBridgeAdapter420 {
    VerifiedTransfer public nextTransfer;
    bytes32 public nextOutboundId = keccak256("wrong-outbound-message");

    function adapterId() external pure returns (bytes32) { return keccak256("TEST/BRIDGE/WRONG_ADAPTER"); }
    function setInbound(VerifiedTransfer calldata v) external { nextTransfer = v; }
    function verifyInbound(bytes calldata) external view returns (VerifiedTransfer memory) { return nextTransfer; }
    function initiateOutbound(bytes32,bytes32,address,bytes calldata,uint256,bytes calldata)
        external payable returns(bytes32 sourceMessageId)
    { return nextOutboundId; }
}

contract EthereumCoreGatewayVerifier420 is IVerifiedGatewayVerifier420 {
    function verifyDeposit(bytes calldata) external pure returns (bytes32,address,address,uint256) {
        return (keccak256("deposit"), address(0xB0B), address(0xCA420), 1 ether);
    }
    function verifyWithdrawal(bytes calldata) external pure returns (bytes32,address,address,uint256) {
        return (keccak256("withdrawal"), address(0xB0B), address(0xCA420), 1 ether);
    }
}

interface EthereumCoreVm420 { function warp(uint256) external; }

abstract contract EthereumSharedCoreFixture420 {
    EthereumCoreVm420 constant coreVm =
        EthereumCoreVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant ROUTE_ID = keccak256("420/BRIDGE/ROUTE/ETH/MAINNET");
    bytes32 constant ASSET_ID = keccak256("420/BRIDGE/ASSET/ETH");
    bytes32 constant ADAPTER_ID = keccak256("TEST/BRIDGE/ADAPTER");
    bytes32 constant WRONG_ADAPTER_ID = keccak256("TEST/BRIDGE/WRONG_ADAPTER");
    bytes32 constant EXTERNAL_CHAIN = keccak256("420/BRIDGE/CHAIN/TEST-EXTERNAL");
    bytes32 constant LOCAL_CHAIN = keccak256("420/BRIDGE/CHAIN/420");
    bytes32 constant EXTERNAL_NETWORK = keccak256("TEST-EXTERNAL/MAINNET");
    bytes32 constant LOCAL_NETWORK = keccak256("420/TESTNET/GENESIS");
    address constant TOKEN = address(0xCA420);

    struct Fixture {
        GenesisMockEnvironment420 env;
        GatewayRouter420 router;
        BridgeRiskManager risk;
        BridgeTransferRegistry transfers;
        BridgeRouteRegistry routes;
        BridgeChainRegistry420 chains;
        BridgeAccountingRegistry accounting;
        EthereumCoreMockAdapter420 adapter;
    }

    function _limits(uint256 max) internal pure returns (BridgeRiskManager.Limits memory) {
        return BridgeRiskManager.Limits(max, max, max, max, max, max);
    }

    function _chain(uint64 routeChainId, bytes32 networkId, bool active)
        internal
        pure
        returns (BridgeChainRegistry420.Chain memory)
    {
        return BridgeChainRegistry420.Chain({
            routeChainId: routeChainId,
            networkId: networkId,
            nativeAssetId: ASSET_ID,
            verifierFamily: keccak256("TEST/BRIDGE/VERIFIER"),
            family: BridgeChainRegistry420.ChainFamily.EVM,
            active: active
        });
    }

    function _setup() internal returns (Fixture memory f) {
        f.env = new GenesisMockEnvironment420();
        f.router = new GatewayRouter420(address(this), address(f.env.registry()), keccak256("router"));
        f.risk = new BridgeRiskManager(address(this), address(f.env.registry()), keccak256("risk"));
        f.transfers = new BridgeTransferRegistry(address(this), address(f.env.registry()), keccak256("transfers"));
        f.routes = new BridgeRouteRegistry(address(this), address(f.env.registry()), keccak256("routes"));
        f.chains = new BridgeChainRegistry420(address(this), address(f.env.registry()), keccak256("chains"));
        f.accounting = new BridgeAccountingRegistry(address(this), address(f.env.registry()), keccak256("accounting"));
        f.adapter = new EthereumCoreMockAdapter420();

        f.env.registerResident(address(f.router), f.router.componentId());
        f.env.registerResident(address(f.risk), f.risk.componentId());
        f.env.registerResident(address(f.transfers), f.transfers.componentId());
        f.env.registerResident(address(f.routes), f.routes.componentId());
        f.env.registerResident(address(f.chains), f.chains.componentId());
        f.env.registerResident(address(f.accounting), f.accounting.componentId());
        f.env.setSettlementAsset(TOKEN, ASSET_ID, true);
        f.env.health().setRoute(ROUTE_ID, true);
        f.env.risk().set(1_000_000 ether, 0);

        f.chains.setChain(EXTERNAL_CHAIN, _chain(0x4554484d41494e01, EXTERNAL_NETWORK, true));
        f.chains.setChain(LOCAL_CHAIN, _chain(uint64(block.chainid), LOCAL_NETWORK, true));

        BridgeRouteRegistry.Route memory route = BridgeRouteRegistry.Route({
            assetId: ASSET_ID,
            sourceChainId: 0x4554484d41494e01,
            destinationChainId: uint64(block.chainid),
            sourceAsset: bytes32(uint256(uint160(TOKEN))),
            destinationAsset: bytes32(uint256(uint160(TOKEN))),
            adapterId: ADAPTER_ID,
            verifierConfigHash: keccak256("verified-config"),
            version: 1,
            status: BridgeRouteRegistry.Status.ACTIVE,
            inboundEnabled: true,
            outboundEnabled: true
        });
        f.routes.setRoute(ROUTE_ID, route);
        f.risk.setRouteLimits(ROUTE_ID, _limits(1_000_000 ether));
        f.risk.setAssetLimits(ASSET_ID, _limits(1_000_000 ether));
        f.risk.setRouter(address(f.router), true);
        f.transfers.setRouter(address(f.router), true);
        f.transfers.setOperator(address(this), true);
        f.router.setAdapter(ADAPTER_ID, address(f.adapter));
        f.accounting.applyReconciliation(
            ASSET_ID, 1_000_000 ether, 1_000_000 ether, uint64(block.timestamp), keccak256("accounting-bootstrap")
        );
    }

    function _inbound(uint256 amount) internal pure returns (IBridgeAdapter420.VerifiedTransfer memory) {
        return IBridgeAdapter420.VerifiedTransfer({
            routeId: ROUTE_ID,
            assetId: ASSET_ID,
            sender: address(0xA11CE),
            recipient: address(0xB0B),
            amount: amount,
            sourceTxId: keccak256("source-tx"),
            sourceMessageId: keccak256("source-message")
        });
    }

}
