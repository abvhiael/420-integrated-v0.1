// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/GatewayRouter420.sol";
import "../src/bridge/BridgeRiskManager.sol";
import "../src/bridge/BridgeTransferRegistry.sol";
import "../src/bridge/BridgeRouteRegistry.sol";
import "../src/bridge/BridgeChainRegistry420.sol";
import "../src/bridge/BridgeAccountingRegistry.sol";
import "../src/bridge/VerifiedGateway420.sol";
import "../src/interfaces/IBridgeAdapter420.sol";
import "../src/interfaces/genesis/ISystemSafety420.sol";
import "./helpers/GenesisMocks420.sol";
import "./LitecoinConsensusQualification420.t.sol";

contract LitecoinSharedMockAdapter420 is IBridgeAdapter420 {
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

contract LitecoinSharedWrongAdapter420 is IBridgeAdapter420 {
    VerifiedTransfer public nextTransfer;
    bytes32 public nextOutboundId = keccak256("wrong-outbound-message");

    function adapterId() external pure returns (bytes32) { return keccak256("TEST/BRIDGE/WRONG_ADAPTER"); }
    function setInbound(VerifiedTransfer calldata v) external { nextTransfer = v; }
    function verifyInbound(bytes calldata) external view returns (VerifiedTransfer memory) { return nextTransfer; }
    function initiateOutbound(bytes32,bytes32,address,bytes calldata,uint256,bytes calldata)
        external payable returns(bytes32 sourceMessageId)
    { return nextOutboundId; }
}

contract LitecoinSharedGatewayVerifier420 is IVerifiedGatewayVerifier420 {
    function verifyDeposit(bytes calldata) external pure returns (bytes32,address,address,uint256) {
        return (keccak256("deposit"), address(0xB0B), address(0xCA420), 1 ether);
    }
    function verifyWithdrawal(bytes calldata) external pure returns (bytes32,address,address,uint256) {
        return (keccak256("withdrawal"), address(0xB0B), address(0xCA420), 1 ether);
    }
}

interface LitecoinSharedVm420 { function warp(uint256) external; }

contract LitecoinGatewayIntegration420Test {
    LitecoinSharedVm420 constant vm =
        LitecoinSharedVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant ROUTE_ID = keccak256("420/BRIDGE/ROUTE/LTC/LITECOIN/MAINNET");
    bytes32 constant ASSET_ID = keccak256("420/BRIDGE/ASSET/LTC");
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
        LitecoinSharedMockAdapter420 adapter;
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
        f.adapter = new LitecoinSharedMockAdapter420();

        f.env.registerResident(address(f.router), f.router.componentId());
        f.env.registerResident(address(f.risk), f.risk.componentId());
        f.env.registerResident(address(f.transfers), f.transfers.componentId());
        f.env.registerResident(address(f.routes), f.routes.componentId());
        f.env.registerResident(address(f.chains), f.chains.componentId());
        f.env.registerResident(address(f.accounting), f.accounting.componentId());
        f.env.setSettlementAsset(TOKEN, ASSET_ID, true);
        f.env.health().setRoute(ROUTE_ID, true);
        f.env.risk().set(1_000_000 ether, 0);

        f.chains.setChain(EXTERNAL_CHAIN, _chain(1, EXTERNAL_NETWORK, true));
        f.chains.setChain(LOCAL_CHAIN, _chain(uint64(block.chainid), LOCAL_NETWORK, true));

        BridgeRouteRegistry.Route memory route = BridgeRouteRegistry.Route({
            assetId: ASSET_ID,
            sourceChainId: 1,
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

    LitecoinVm420 constant ltcvm=LitecoinVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    function put(LitecoinHeaderChain420 c,bytes32 h,bytes32 parent,bytes32 root,uint256 work,uint64 height) internal {
        bytes32 slot=keccak256(abi.encode(h,uint256(0)));
        ltcvm.store(address(c),slot,parent);ltcvm.store(address(c),bytes32(uint256(slot)+1),root);
        ltcvm.store(address(c),bytes32(uint256(slot)+2),bytes32(work));
        ltcvm.store(address(c),bytes32(uint256(slot)+3),bytes32(uint256(height)|(uint256(1231469665)<<64)|(uint256(0x1d00ffff)<<96)|(uint256(1231006505)<<128)));
    }
    function testLitecoinGatewayConcreteVerifierRiskReplayAndAtomicRollback() public {
        Fixture memory f=_setup();
        LitecoinHeaderChain420 c=new LitecoinHeaderChain420();
        bytes memory script=hex"00141111111111111111111111111111111111111111";
        LitecoinFinalityVerifier420 verifier=new LitecoinFinalityVerifier420(c,script,ROUTE_ID,1,address(f.router));
        LitecoinBridgeAdapter420 a=new LitecoinBridgeAdapter420(address(this),address(f.router),address(verifier));a.setLtcBinding(ASSET_ID,ROUTE_ID);
        f.chains.setChain(a.LTC_CHAIN_KEY(),BridgeChainRegistry420.Chain(a.LTC_ROUTE_CHAIN_ID(),a.LTC_MAINNET_GENESIS_HASH(),ASSET_ID,keccak256("LTC/SPV"),BridgeChainRegistry420.ChainFamily.UTXO,true));
        f.routes.setRoute(ROUTE_ID,BridgeRouteRegistry.Route(ASSET_ID,a.LTC_ROUTE_CHAIN_ID(),uint64(block.chainid),ASSET_ID,bytes32(uint256(uint160(TOKEN))),a.ADAPTER_ID(),keccak256(abi.encode(address(verifier))),2,BridgeRouteRegistry.Status.ACTIVE,true,false));
        f.router.setAdapter(a.ADAPTER_ID(),address(a));
        bytes memory tx_=abi.encodePacked(hex"0100000001",bytes32(uint256(1)),hex"0000000000ffffffff02e80300000000000016",script,hex"000000000000000022",verifier.commitmentScript(0,address(0xB0B),1000),hex"00000000");
        bytes32 deposit=keccak256("controlled deposit block");put(c,deposit,c.GENESIS(),BridgeCrypto420.sha256d(tx_),100,1);
        bytes32 parent=deposit;
        for(uint256 i;i<11;++i){bytes32 h=keccak256(abi.encode(i));put(c,h,parent,0,101+i,uint64(2+i));parent=h;}
        ltcvm.store(address(c),bytes32(uint256(1)),parent);
        bytes32[] memory path=new bytes32[](11);bytes32 cursor=parent;
        for(uint256 i;i<11;++i){cursor=c.getHeader(cursor).parent;path[i]=cursor;}
        LitecoinFinalityVerifier420.Proof memory proof=LitecoinFinalityVerifier420.Proof(deposit,tx_,0,1,address(0xB0B),0,new bytes32[](0),path);
        bytes memory encoded=abi.encode(proof);
        ILitecoinFinalityVerifier420.FinalizedTransfer memory t=verifier.verifyFinalizedTransfer(encoded);
        // Fail after adapter verification: route safety must roll back both replay maps.
        f.routes.setDirection(ROUTE_ID,false,false);
        (bool ok,)=address(f.router).call(abi.encodeCall(f.router.acceptInbound,(a.ADAPTER_ID(),encoded)));
        require(!ok && !a.consumedMessages(t.messageId) && !a.consumedSourceOutputs(t.sourceOutput));
        f.routes.setDirection(ROUTE_ID,true,false);
        // Fail after risk consumption: transfer registry rejects untrusted router.
        f.transfers.setRouter(address(f.router),false);
        (ok,)=address(f.router).call(abi.encodeCall(f.router.acceptInbound,(a.ADAPTER_ID(),encoded)));
        require(!ok && !a.consumedSourceOutputs(t.sourceOutput));
        (,,,,,,uint256 rolledBack)=f.risk.routeUsage(ROUTE_ID);require(rolledBack==0);
        f.transfers.setRouter(address(f.router),true);
        bytes32 id=f.router.acceptInbound(a.ADAPTER_ID(),encoded);
        (,,,,uint256 amount,,,BridgeTransferRegistry.Status status,,)=f.transfers.transfers(id);
        require(amount==1000 && status==BridgeTransferRegistry.Status.VERIFIED);
        (,,,,,,uint256 tvl)=f.risk.routeUsage(ROUTE_ID);require(tvl==1000);
        (bytes32 gateway,bytes32 sourceAsset)=a.verifiedSourceContext(t.messageId);
        require(gateway==keccak256(script) && sourceAsset==ASSET_ID);
        (ok,)=address(f.router).call(abi.encodeCall(f.router.acceptInbound,(a.ADAPTER_ID(),encoded)));require(!ok);
        (,,,,,,uint256 afterReplay)=f.risk.routeUsage(ROUTE_ID);require(afterReplay==tvl);
    }
}
