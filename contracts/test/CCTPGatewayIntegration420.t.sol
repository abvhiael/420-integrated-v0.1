// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./helpers/CCTPNativeHarness420.sol";
import "./helpers/GenesisMocks420.sol";
import "../src/bridge/GatewayRouter420.sol";
import "../src/bridge/BridgeRiskManager.sol";
import "../src/bridge/BridgeTransferRegistry.sol";
import "../src/bridge/BridgeRouteRegistry.sol";
import "../src/bridge/BridgeChainRegistry420.sol";
import "../src/bridge/BridgeAccountingRegistry.sol";

/// Actual router, lifecycle/risk/accounting registries and Circle native code;
/// Genesis dependencies and USDC remain explicitly controlled test doubles.
contract CCTPGatewayIntegration420Test is CCTPNativeHarness420 {
    GenesisMockEnvironment420 private env;
    GatewayRouter420 private gateway;
    BridgeRiskManager private risk;
    BridgeTransferRegistry private transfers;
    BridgeRouteRegistry private routes;
    BridgeChainRegistry420 private chains;
    BridgeAccountingRegistry private accounting;
    function limits(uint256 max) private pure returns(BridgeRiskManager.Limits memory){return BridgeRiskManager.Limits(max,max,max,max,max,max);}
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
        routes.setRoute(route(6),BridgeRouteRegistry.Route(ASSET,8453,1,message("base-standard").burnToken,bytes32(uint256(uint160(address(token)))),adapter.ADAPTER_ID(),keccak256("CONTROLLED/CCTP/CONFIG"),1,BridgeRouteRegistry.Status.ACTIVE,true,true));
        risk.setRouteLimits(route(6),limits(1_000_000_000 ether));risk.setAssetLimits(ASSET,limits(1_000_000_000 ether));risk.setRouter(address(gateway),true);transfers.setRouter(address(gateway),true);transfers.setOperator(address(this),true);gateway.setAdapter(adapter.ADAPTER_ID(),address(adapter));
        accounting.applyReconciliation(ASSET,1_000_000_000 ether,1_000_000_000 ether,uint64(block.timestamp),keccak256("CONTROLLED/CCTP/RECONCILIATION"));
    }
    function testActualRouterRecordsNativeCCTPDelivery() public {
        CCTPV2Message420.Message memory m=message("base-standard");bytes32 id=gateway.acceptInbound(adapter.ADAPTER_ID(),proof("base-standard"));
        (,,,,uint256 amount,,,BridgeTransferRegistry.Status status,,)=transfers.transfers(id);
        require(amount==m.amount-m.fee&&status==BridgeTransferRegistry.Status.VERIFIED&&token.balanceOf(m.mintRecipient)==amount,"native delivery/lifecycle");
        (,,,,,,uint256 tvl)=risk.routeUsage(route(6));require(tvl==amount,"risk accounting");
    }
    function testRouterRiskRejectionRollsBackNativeMintAndBothNonceStores() public {
        risk.setRouteLimits(route(6),limits(1));CCTPV2Message420.Message memory m=message("base-standard");
        (bool ok,)=address(gateway).call(abi.encodeCall(gateway.acceptInbound,(adapter.ADAPTER_ID(),proof("base-standard"))));
        require(!ok&&!adapter.consumedNonces(m.nonce)&&CCTPNativeMT420(MT).usedNonces(m.nonce)==0&&token.balanceOf(m.mintRecipient)==0,"atomic native/router rollback");
        (,,,,,,uint256 tvl)=risk.routeUsage(route(6));require(tvl==0,"risk rollback");
    }
    function testRouterOutboundBurnAndLifecycle() public {
        gateway.acceptInbound(adapter.ADAPTER_ID(),proof("base-standard"));token.fund(address(this),10e6);token.approve(address(adapter),10e6);
        bytes32 id=gateway.initiateOutbound(adapter.ADAPTER_ID(),route(6),ASSET,abi.encode(bytes32(uint256(uint160(address(0xB0B))))),10e6,abi.encode(bytes32(0),uint256(0),uint32(2000),bytes("")));
        require(id!=0&&token.balanceOf(address(this))==0&&token.allowance(address(adapter),TM)==0,"native outbound burn");
        bytes32 transferId=transfers.deriveOutboundTransferId(route(6),ASSET,address(this),keccak256(abi.encode(bytes32(uint256(uint160(address(0xB0B)))))),10e6,id);
        (,,,,,,,BridgeTransferRegistry.Status status,,)=transfers.transfers(transferId);require(status==BridgeTransferRegistry.Status.SOURCE_PENDING,"native request pending attestation");
    }
}
