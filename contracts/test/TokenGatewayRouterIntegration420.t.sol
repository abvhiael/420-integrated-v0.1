// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./SupportedTokenRoutes420.t.sol";
import "./helpers/ProofEnvelopeFixture420.sol";
import "../src/bridge/GatewayRouter420.sol";
import "../src/bridge/BridgeRiskManager.sol";
import "../src/bridge/BridgeTransferRegistry.sol";
import "../src/bridge/BridgeAccountingRegistry.sol";

contract TokenGatewayRouterIntegration420Test is TokenRouteFixture420 {
    GatewayRouter420 gateway;
    BridgeRiskManager risk;
    BridgeTransferRegistry transfers;
    BridgeAccountingRegistry accounting;
    mapping(bytes32 => bool) reconciled;

    function _newRouter() internal override returns (TokenRouterBoundary420) {
        gateway = new GatewayRouter420(address(this), address(env.registry()), keccak256("token-router"));
        env.registerResident(address(gateway), gateway.componentId());
        return TokenRouterBoundary420(address(gateway));
    }

    function setUp() public override {
        super.setUp();
        risk = new BridgeRiskManager(address(this), address(env.registry()), keccak256("token-risk"));
        transfers = new BridgeTransferRegistry(address(this), address(env.registry()), keccak256("token-transfers"));
        accounting = new BridgeAccountingRegistry(address(this), address(env.registry()), keccak256("token-accounting"));
        env.registerResident(address(risk), risk.componentId());
        env.registerResident(address(transfers), transfers.componentId());
        env.registerResident(address(accounting), accounting.componentId());
        risk.setRouter(address(gateway), true);
        transfers.setRouter(address(gateway), true);
        transfers.setOperator(address(this), true);
        env.risk().set(1000000 ether, 0);
        gateway.setAdapter(eth.ADAPTER_ID(), address(eth));
        gateway.setAdapter(sol.ADAPTER_ID(), address(sol));
    }

    function limits(uint256 max) internal pure returns (BridgeRiskManager.Limits memory) {
        return BridgeRiskManager.Limits(max, max, max, max, max, max);
    }

    function setupRoute(uint256 i) internal returns (SupportedTokenRoutes420.Profile memory p) {
        p = configure(i);
        env.health().setRoute(p.routeId, true);
        risk.setRouteLimits(p.routeId, limits(1000 ether));
        risk.setAssetLimits(p.assetId, limits(1000 ether));
        if (!reconciled[p.assetId]) {
            accounting.applyReconciliation(
                p.assetId,
                1000000 ether,
                1000000 ether,
                uint64(block.timestamp),
                keccak256(abi.encode("CONTROLLED/RECONCILIATION", i, p.routeId))
            );
            reconciled[p.assetId] = true;
        }
    }

    function transport(uint256 i,uint256 amount) internal returns(bytes memory){
        bytes memory raw=proof(i,amount);SupportedTokenRoutes420.Profile memory p=profile(i);
        IBridgeAdapter420.VerifiedTransfer memory v;
        if(i<7){IEthereumFinalityVerifier420.FinalizedTransfer memory t=verifier.verifyFinalizedTransfer(raw);v=IBridgeAdapter420.VerifiedTransfer(p.routeId,p.assetId,t.sourceSender,t.recipient,42 ether,t.transactionHash,t.messageId);}
        else{ISolanaFinalityVerifier420.FinalizedTransfer memory t=solVerifier.verifyFinalizedTransfer(raw);v=IBridgeAdapter420.VerifiedTransfer(p.routeId,p.assetId,address(1),t.recipient,42 ether,t.transactionSignature,t.messageId);}
        return ProofEnvelopeFixture420.wrap(gateway,i<7?eth.ADAPTER_ID():sol.ADAPTER_ID(),v,GATEWAY,raw);
    }
    function testRouterIndependentTokenAdmissionsAndNormalizedRisk() public {
        for (uint256 i; i < 9; i++) {
            SupportedTokenRoutes420.Profile memory p = setupRoute(i);
            uint256 raw = 42 * 10 ** uint256(p.decimals);
            bytes32 id = gateway.acceptInbound(i < 7 ? eth.ADAPTER_ID() : sol.ADAPTER_ID(), transport(i, raw));
            (,,,, uint256 amount,,, BridgeTransferRegistry.Status state,,) = transfers.transfers(id);
            require(amount == 42 ether && state == BridgeTransferRegistry.Status.VERIFIED, "normalized lifecycle");
            (,,,,,, uint256 tvl) = risk.routeUsage(p.routeId);
            require(tvl == 42 ether, "local precision risk");
        }
    }

    function testRouterPrecisionRiskFailureRestoresReplay() public {
        SupportedTokenRoutes420.Profile memory p = setupRoute(4);
        risk.setRouteLimits(p.routeId, limits(1 ether));
        bytes memory encoded = transport(4, 42e6);
        (bool ok,) = address(gateway).call(abi.encodeCall(gateway.acceptInbound, (eth.ADAPTER_ID(), encoded)));
        require(!ok, "raw six-decimal amount bypassed local cap");
        risk.setRouteLimits(p.routeId, limits(1000 ether));
        bytes32 id = gateway.acceptInbound(eth.ADAPTER_ID(), encoded);
        require(id != 0, "replay state rollback");
    }

    function testRouterSuspendedAssetCannotBeAdmitted() public {
        SupportedTokenRoutes420.Profile memory p = setupRoute(1);
        assets.setAsset(p.assetId, address(0), 0, 0, 0, BridgeAssetRegistry.Status.SUSPENDED, false);
        (bool ok,) =
            address(gateway).call(abi.encodeCall(gateway.acceptInbound, (eth.ADAPTER_ID(), transport(1, 42 ether))));
        require(!ok, "bridge suspension bypass");
    }

    function testRouterOutboundKeepsSourcePending() public {
        SupportedTokenRoutes420.Profile memory p = setupRoute(4);
        gateway.acceptInbound(eth.ADAPTER_ID(), transport(4, 42e6));
        bytes32 messageId =
            gateway.initiateOutbound(eth.ADAPTER_ID(), p.routeId, p.assetId, new bytes(20), 42 ether, bytes(""));
        bytes32 id = transfers.deriveOutboundTransferId(
            p.routeId, p.assetId, address(this), keccak256(new bytes(20)), 42 ether, messageId
        );
        (,,,,,,, BridgeTransferRegistry.Status state,,) = transfers.transfers(id);
        require(state == BridgeTransferRegistry.Status.SOURCE_PENDING, "intent is not settlement");
    }
}
