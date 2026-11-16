// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./helpers/CCTPNativeHarness420.sol";
import "./helpers/BridgeQualificationFixture420.sol";
import "./helpers/GenesisMocks420.sol";
import "../src/bridge/GatewayRouter420.sol";
import "../src/bridge/BridgeRiskManager.sol";
import "../src/bridge/BridgeTransferRegistry.sol";
import "../src/bridge/BridgeRouteRegistry.sol";
import "../src/bridge/BridgeChainRegistry420.sol";
import "../src/bridge/BridgeAccountingRegistry.sol";

/// Actual router, lifecycle/risk/accounting registries and Circle native code;
/// Genesis dependencies and USDC remain explicitly controlled test doubles.
abstract contract BridgeFullLocalFixture420 is CCTPNativeHarness420 {
    GenesisMockEnvironment420 internal env;
    GatewayRouter420 internal gateway;
    BridgeRiskManager internal risk;
    BridgeTransferRegistry internal transfers;
    BridgeRouteRegistry internal routes;
    BridgeChainRegistry420 internal chains;
    BridgeAccountingRegistry internal accounting;
    function limits(uint256 max) internal pure returns(BridgeRiskManager.Limits memory){return BridgeRiskManager.Limits(max,max,max,max,max,max);}
    function setUp() public {
        vm.chainId(1);env=new GenesisMockEnvironment420();
        gateway=new GatewayRouter420(address(this),address(env.registry()),keccak256("cctp-router"));
        risk=new BridgeRiskManager(address(this),address(env.registry()),keccak256("cctp-risk"));
        transfers=new BridgeTransferRegistry(address(this),address(env.registry()),keccak256("cctp-transfer"));
        routes=new BridgeRouteRegistry(address(this),address(env.registry()),keccak256("cctp-route"));
        chains=new BridgeChainRegistry420(address(this),address(env.registry()),keccak256("cctp-chain"));
        accounting=new BridgeAccountingRegistry(address(this),address(env.registry()),keccak256("cctp-accounting"));
        env.registerResident(address(gateway),gateway.componentId());env.registerResident(address(risk),risk.componentId());
        env.registerResident(address(transfers),transfers.componentId());env.registerResident(address(routes),routes.componentId());
        env.registerResident(address(chains),chains.componentId());env.registerResident(address(accounting),accounting.componentId());
        setupNative(0,address(gateway));env.setSettlementAsset(address(token),ASSET,true);env.health().setRoute(route(6),true);env.risk().set(1_000_000_000 ether,0);
        bytes32 eth=keccak256("420/BRIDGE/ASSET/ETH");bytes32 family=keccak256("CIRCLE/CCTP/V2");
        chains.setChain(keccak256("420/BRIDGE/CHAIN/BASE"),BridgeChainRegistry420.Chain(8453,keccak256("BASE/MAINNET"),eth,family,BridgeChainRegistry420.ChainFamily.EVM,true));
        chains.setChain(keccak256("420/BRIDGE/CHAIN/ETH"),BridgeChainRegistry420.Chain(1,keccak256("ETHEREUM/MAINNET"),eth,family,BridgeChainRegistry420.ChainFamily.EVM,true));
        routes.setRoute(route(6),BridgeRouteRegistry.Route(ASSET,8453,1,message("base-standard").burnToken,bytes32(uint256(uint160(address(token)))),adapter.ADAPTER_ID(),keccak256("CONTROLLED/CCTP/CONFIG"),1,BridgeRouteRegistry.Status.APPROVED_INACTIVE,true,true));
        risk.setRouteLimits(route(6),limits(1_000_000_000 ether));risk.setAssetLimits(ASSET,limits(1_000_000_000 ether));risk.setRouter(address(gateway),true);transfers.setRouter(address(gateway),true);transfers.setOperator(address(this),true);gateway.setAdapter(adapter.ADAPTER_ID(),address(adapter));
        accounting.applyReconciliation(ASSET,0,0,uint64(block.timestamp),keccak256("CONTROLLED/CCTP/RECONCILIATION"));
        qualifyLocal();
    }
    BridgeVerifierRegistry420 internal qualification;
    function addProbe(BridgeVerifierRegistry420.Probe[] memory ps,uint256 n,uint16 who,bool root,bytes memory callData) internal view returns(uint256){
        address target=who<2?address(adapter):who==2?MT:who==3?TM:who==4?address(minter):address(token);
        ps[n]=BridgeVerifierRegistry420.Probe(who,root,callData,BridgeQualificationFixture420.resultHash(target,callData));return n+1;
    }
    function qualifyLocal() internal {
        qualification=BridgeQualificationFixture420.registry(env);
        qualification.qualifyProxyRuntime(MT.codehash,keccak256("pinned Circle native implementation getter audit / local replay"),true);
        BridgeVerifierRegistry420.Registration memory r;r.consumer=qualification.identity(address(adapter),BridgeVerifierRegistry420.ProxyKind.DIRECT);r.verifier=r.consumer;
        r.sourceChainKey=keccak256("420/BRIDGE/CHAIN/BASE");r.destinationChainKey=keccak256("420/BRIDGE/CHAIN/ETH");r.proofSystem=keccak256("CIRCLE/CCTP/V2");r.configurationHash=keccak256("CONTROLLED/CCTP/CONFIG");r.evidenceHash=keccak256("PR1168 authentic Circle evidence + local V21 integration; NOT 420 issuer authorization");r.directions=3;
        r.dependencies=new BridgeVerifierRegistry420.Identity[](4);r.dependencies[0]=qualification.identity(MT,BridgeVerifierRegistry420.ProxyKind.AUDITED_PUBLIC);r.dependencies[1]=qualification.identity(TM,BridgeVerifierRegistry420.ProxyKind.AUDITED_PUBLIC);r.dependencies[2]=qualification.identity(address(minter),BridgeVerifierRegistry420.ProxyKind.DIRECT);r.dependencies[3]=qualification.identity(address(token),BridgeVerifierRegistry420.ProxyKind.DIRECT);
        BridgeVerifierRegistry420.Probe[] memory ps=new BridgeVerifierRegistry420.Probe[](64);uint256 n;
        string[9] memory mtCalls=[string("signatureThreshold()"),string("getNumEnabledAttesters()"),string("attesterManager()"),string("owner()"),string("pauser()"),string("paused()"),string("localDomain()"),string("version()"),string("maxMessageBodySize()")];
        for(uint256 i;i<mtCalls.length;++i)n=addProbe(ps,n,2,i<3,abi.encodeWithSignature(mtCalls[i]));
        n=addProbe(ps,n,2,true,abi.encodeWithSignature("getEnabledAttester(uint256)",0));n=addProbe(ps,n,2,true,abi.encodeWithSignature("getEnabledAttester(uint256)",1));
        string[10] memory aCalls=[string("issuerEnabled()"),string("messageTransmitter()"),string("tokenMessenger()"),string("tokenMinter()"),string("usdc()"),string("localDomain()"),string("issuerSupportEvidence()"),string("gatewayRouter()"),string("usdcAssetId()"),string("deploymentChainId()")];
        for(uint256 i;i<aCalls.length;++i)n=addProbe(ps,n,0,false,abi.encodeWithSignature(aCalls[i]));
        n=addProbe(ps,n,0,false,abi.encodeWithSignature("peers(uint32)",6));n=addProbe(ps,n,0,false,abi.encodeWithSignature("configuredRoutes(bytes32)",route(6)));n=addProbe(ps,n,0,false,abi.encodeWithSignature("routeDomains(bytes32)",route(6)));
        n=addProbe(ps,n,3,true,abi.encodeWithSignature("remoteTokenMessengers(uint32)",6));
        n=addProbe(ps,n,3,false,abi.encodeWithSignature("localMinter()"));n=addProbe(ps,n,3,false,abi.encodeWithSignature("localMessageTransmitter()"));n=addProbe(ps,n,3,false,abi.encodeWithSignature("feeRecipient()"));n=addProbe(ps,n,3,false,abi.encodeWithSignature("messageBodyVersion()"));
        n=addProbe(ps,n,3,false,abi.encodeWithSignature("owner()"));
        n=addProbe(ps,n,4,true,abi.encodeWithSignature("getLocalToken(uint32,bytes32)",6,message("base-standard").burnToken));n=addProbe(ps,n,4,false,abi.encodeWithSignature("localTokenMessenger()"));n=addProbe(ps,n,4,false,abi.encodeWithSignature("owner()"));
        n=addProbe(ps,n,5,false,abi.encodeWithSignature("controller()"));n=addProbe(ps,n,5,false,abi.encodeWithSignature("minter()"));n=addProbe(ps,n,5,false,abi.encodeWithSignature("decimals()"));
        n=addProbe(ps,n,4,false,abi.encodeWithSignature("tokenController()"));n=addProbe(ps,n,4,false,abi.encodeWithSignature("burnLimitsPerMessage(address)",address(token)));
        n=addProbe(ps,n,3,false,abi.encodeWithSignature("minFee()"));
        assembly{mstore(ps,n)}r.probes=ps;bytes32 id=qualification.record(r,qualification.currentApproval(address(adapter)),true);
        BridgeRouteRegistry.Route memory next; (next.assetId,next.sourceChainId,next.destinationChainId,next.sourceAsset,next.destinationAsset,next.adapterId,next.verifierConfigHash,next.version,next.status,next.inboundEnabled,next.outboundEnabled)=routes.routes(route(6));next.status=BridgeRouteRegistry.Status.ACTIVE;routes.setRoute(route(6),next);require(qualification.currentApproval(address(adapter))==id);
    }
    function sourceMessage() internal view returns(bytes32){return keccak256(abi.encode("420/CCTP/V2/NONCE",message("base-standard").nonce));}
    function assertClean() internal view {CCTPV2Message420.Message memory m=message("base-standard");require(!adapter.consumedNonces(m.nonce)&&CCTPNativeMT420(MT).usedNonces(m.nonce)==0&&token.balanceOf(m.mintRecipient)==0,"partial native settlement");require(!gateway.consumedSourceMessages(gateway.sourceReplayKey(keccak256("BASE/MAINNET"),sourceMessage())),"partial router replay");(,,,,,,uint256 tvl)=risk.routeUsage(route(6));require(tvl==0,"partial risk");(,,,,,,uint256 assetTvl)=risk.assetUsage(ASSET);require(assetTvl==0,"partial asset risk");
        bytes32 id=transfers.deriveTransferId(route(6),ASSET,address(uint160(uint256(m.messageSender))),m.mintRecipient,m.amount-m.fee,keccak256(file("base-standard.message.hex")),sourceMessage());
        (,,,,,,,BridgeTransferRegistry.Status status,,)=transfers.transfers(id);require(status==BridgeTransferRegistry.Status.NONE&&!transfers.consumedTransferId(id),"partial lifecycle");}
}
