// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./CADCLayerZero420.t.sol";
import "./helpers/BridgeQualificationFixture420.sol";
import "./helpers/ProofEnvelopeFixture420.sol";
import "./helpers/GenesisMocks420.sol";
import "../src/bridge/CADCBridgeIntegration.sol";
import "../src/bridge/GatewayRouter420.sol";
import "../src/bridge/BridgeRiskManager.sol";
import "../src/bridge/BridgeTransferRegistry.sol";
import "../src/bridge/BridgeRouteRegistry.sol";
import "../src/bridge/BridgeChainRegistry420.sol";
import "../src/bridge/BridgeAccountingRegistry.sol";

/// @dev Run only testRouter* here; inherited adapter tests belong to CADCLayerZero420.t.sol.
contract CADCGatewayIntegration420Test is CADCLayerZero420Test {
    GenesisMockEnvironment420 env;
    bool admissionReady;
    BridgeRouteRegistry qualifiedRoutes;
    GatewayRouter420 gateway;
    BridgeRiskManager risk;
    BridgeTransferRegistry transfers;

    function _newIntegration() internal override returns (CADCTestIntegration420) {
        CADCBridgeIntegration actual =
            new CADCBridgeIntegration(address(this), address(env.registry()), keccak256("cadc-issuer"));
        env.registerResident(address(actual), actual.componentId());
        return CADCTestIntegration420(address(actual));
    }

    function _router() internal view override returns (address) {
        return address(gateway);
    }

    function limits(uint256 max) private pure returns (BridgeRiskManager.Limits memory) {
        return BridgeRiskManager.Limits(max, max, max, max, max, max);
    }

    function setUp() public override {
        env = new GenesisMockEnvironment420();
        gateway = new GatewayRouter420(address(this), address(env.registry()), keccak256("cadc-router"));
        risk = new BridgeRiskManager(address(this), address(env.registry()), keccak256("cadc-risk"));
        transfers = new BridgeTransferRegistry(address(this), address(env.registry()), keccak256("cadc-transfer"));
        BridgeRouteRegistry routes =
            new BridgeRouteRegistry(address(this), address(env.registry()), keccak256("cadc-routes"));
        BridgeChainRegistry420 chains =
            new BridgeChainRegistry420(address(this), address(env.registry()), keccak256("cadc-chains"));
        BridgeAccountingRegistry accounting =
            new BridgeAccountingRegistry(address(this), address(env.registry()), keccak256("cadc-accounting"));
        env.registerResident(address(gateway), gateway.componentId());
        env.registerResident(address(risk), risk.componentId());
        env.registerResident(address(transfers), transfers.componentId());
        env.registerResident(address(routes), routes.componentId());
        env.registerResident(address(chains), chains.componentId());
        env.registerResident(address(accounting), accounting.componentId());
        super.setUp();
        env.setSettlementAsset(address(oft), ASSET, true);
        env.health().setRoute(ROUTE, true);
        env.risk().set(1_000_000_000 ether, 0);
        bytes32 nativeAsset = keccak256("ETH");
        bytes32 family = keccak256("ISSUER/CADC/LAYERZERO/V2");
        chains.setChain(
            keccak256("ETHEREUM"),
            BridgeChainRegistry420.Chain(
                1, keccak256("ETHEREUM/MAINNET"), nativeAsset, family, BridgeChainRegistry420.ChainFamily.EVM, true
            )
        );
        chains.setChain(
            keccak256("CONTROLLED/DESTINATION"),
            BridgeChainRegistry420.Chain(
                uint64(block.chainid),
                keccak256("CONTROLLED/DESTINATION"),
                nativeAsset,
                family,
                BridgeChainRegistry420.ChainFamily.EVM,
                true
            )
        );
        routes.setRoute(
            ROUTE,
            BridgeRouteRegistry.Route(
                ASSET,
                1,
                uint64(block.chainid),
                REMOTE,
                bytes32(uint256(uint160(address(oft)))),
                adapter.adapterId(),
                keccak256("CONTROLLED/CADC/CONFIG"),
                1,
                BridgeRouteRegistry.Status.APPROVED_INACTIVE,
                true,
                true
            )
        );
        risk.setRouteLimits(ROUTE, limits(1_000_000_000 ether));
        risk.setAssetLimits(ASSET, limits(1_000_000_000 ether));
        risk.setRouter(address(gateway), true);
        transfers.setRouter(address(gateway), true);
        transfers.setOperator(address(this), true);
        gateway.setAdapter(adapter.adapterId(), address(adapter));
        accounting.applyReconciliation(
            ASSET,
            1_000_000_000 ether,
            1_000_000_000 ether,
            uint64(block.timestamp),
            keccak256("CONTROLLED/CADC/RECONCILIATION")
        );
        qualifiedRoutes=routes;admissionReady=true;_activateIntegration();
    }

    function _activateIntegration() internal override {
        if(!admissionReady)return;
        BridgeVerifierRegistry420 q=BridgeQualificationFixture420.registry(env);
        bytes32 id=BridgeQualificationFixture420.approveRoute(env,qualifiedRoutes,ROUTE,address(integration),address(integration),0,abi.encodeWithSignature("securityConfigHash()"),abi.encodeWithSignature("configurationState()"),false);
        CADCBridgeIntegration(address(integration)).bindQualification(id);integration.setActive(true);
        BridgeQualificationFixture420.approveRoute(env,qualifiedRoutes,ROUTE,address(adapter),address(adapter),0,abi.encodeWithSignature("securityConfigHash()"),abi.encodeWithSignature("peerConfigHash()"),true);
        q;
    }

    function transport(uint64 nonce,bytes memory m) internal view returns(bytes memory){
        uint64 shared;assembly{shared:=shr(192,mload(add(m,64)))}
        IBridgeAdapter420.VerifiedTransfer memory v=IBridgeAdapter420.VerifiedTransfer(ROUTE,ASSET,address(1),RECIPIENT,uint256(shared)*1e12,keccak256(abi.encodePacked(guid(nonce),m)),guid(nonce));
        return ProofEnvelopeFixture420.wrap(gateway,adapter.adapterId(),v,REMOTE,abi.encode(uint32(30101),nonce,m));
    }
    function testRouterRevokedIssuerGuardRejectsNativeDelivery() public {
        bytes memory m=message(125);ready(1,m);BridgeVerifierRegistry420 q=BridgeQualificationFixture420.registry(env);
        q.revoke(q.currentApproval(address(integration)),keccak256("issuer guard revoked"));
        require(integration.active(),"must exercise stale stored active flag");
        (bool ok,)=address(gateway).call(abi.encodeCall(gateway.acceptInbound,(adapter.adapterId(),transport(1,m))));
        require(!ok && !adapter.consumed(guid(1)) && oft.balanceOf(RECIPIENT)==0,"revoked issuer guard delivered");
    }
    function testRouterNativeDeliveryLifecycle() public {
        bytes memory m = message(125);
        ready(1, m);
        bytes32 id = gateway.acceptInbound(adapter.adapterId(), transport(1,m));
        (,,,, uint256 amount,,, BridgeTransferRegistry.Status status,,) = transfers.transfers(id);
        require(
            amount == 125 * 1e12 && status == BridgeTransferRegistry.Status.VERIFIED
                && oft.balanceOf(RECIPIENT) == amount,
            "lifecycle"
        );
        (,,,,,, uint256 tvl) = risk.routeUsage(ROUTE);
        require(tvl == amount, "risk");
    }

    function testRouterRiskFailureRollsBackEndpointDvnTokenReplay() public {
        risk.setRouteLimits(ROUTE, limits(1));
        bytes memory m = message(125);
        ready(1, m);
        (bool ok,) = address(gateway)
            .call(abi.encodeCall(gateway.acceptInbound, (adapter.adapterId(), transport(1,m))));
        require(
            !ok && !adapter.consumed(guid(1)) && oft.balanceOf(RECIPIENT) == 0
                && ep.lazyInboundNonce(address(oft), 30101, REMOTE) == 0,
            "atomic rollback"
        );
        risk.setRouteLimits(ROUTE, limits(1_000_000_000 ether));
        gateway.acceptInbound(adapter.adapterId(), transport(1,m));
        require(oft.balanceOf(RECIPIENT) == 125 * 1e12, "Dvn proof restored");
    }

    function testRouterOutboundNativeBurnRemainsPending() public {
        bytes memory m = message(125);
        ready(1, m);
        gateway.acceptInbound(adapter.adapterId(), transport(1,m));
        setupOutbound();
        bytes32 id = gateway.initiateOutbound(
            adapter.adapterId(),
            ROUTE,
            ASSET,
            abi.encode(bytes32(uint256(uint160(RECIPIENT)))),
            125 * 1e12,
            abi.encode(uint32(30101), hex"0003")
        );
        bytes32 transferId = transfers.deriveOutboundTransferId(
            ROUTE, ASSET, address(this), keccak256(abi.encode(bytes32(uint256(uint160(RECIPIENT))))), 125 * 1e12, id
        );
        (,,,,,,, BridgeTransferRegistry.Status status,,) = transfers.transfers(transferId);
        require(
            status == BridgeTransferRegistry.Status.SOURCE_PENDING && a.jobs() == 1 && b.jobs() == 1,
            "outbound lifecycle"
        );
    }
}
