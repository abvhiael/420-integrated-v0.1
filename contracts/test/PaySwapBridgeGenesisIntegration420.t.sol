// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/PaymentRouter420.sol";
import "../src/pay/adapters/CanonicalSettlementAdapter420.sol";
import "../src/swap/CanonicalMarketRegistry.sol";
import "../src/swap/CanonicalSwapExecutor420.sol";
import "../src/bridge/GatewayRouter420.sol";
import "../src/bridge/BridgeRiskManager.sol";
import "../src/bridge/BridgeTransferRegistry.sol";
import "../src/bridge/BridgeRouteRegistry.sol";
import "../src/interfaces/ICanonicalSettlement420.sol";
import "./SwapGenesisIntegration420.t.sol";
import "./BridgeGenesisIntegration420.t.sol";
import "./helpers/GenesisMocks420.sol";

/// @notice Cross-suite integration over one frozen-v1 dependency registry.
/// @dev Proof verification and pool economics are deterministic mocks; all Pay/Swap/Bridge
/// control-plane contracts in this test are the adapted production contracts.
contract PaySwapBridgeGenesisIntegration420Test {
    bytes32 constant MARKET_ID = keccak256("CADC/420");
    bytes32 constant ROUTE_ID = keccak256("CADC/LZ/ETH-420");
    bytes32 constant ASSET_ID = keccak256("CADC");
    bytes32 constant ADAPTER_ID = keccak256("TEST/BRIDGE/ADAPTER");
    address constant INPUT = address(0x420);
    address constant CADC = address(0xCA420);

    function testOneRegistryCoordinatesBridgeThenPaySwap() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();

        CanonicalMarketRegistry markets = new CanonicalMarketRegistry(address(this), address(env.registry()), keccak256("markets"));
        CanonicalSwapExecutor420 swapExecutor = new CanonicalSwapExecutor420(address(this), address(env.registry()), keccak256("swap"));
        MockCanonicalPoolExecution420 pool = new MockCanonicalPoolExecution420();
        CanonicalSettlementAdapter420 payAdapter = new CanonicalSettlementAdapter420(address(this), address(env.registry()), keccak256("pay-adapter"), address(swapExecutor));
        PaymentRouter420 pay = new PaymentRouter420(address(this), address(env.registry()), keccak256("pay"));

        GatewayRouter420 bridge = new GatewayRouter420(address(this), address(env.registry()), keccak256("bridge"));
        BridgeRiskManager risk = new BridgeRiskManager(address(this), address(env.registry()), keccak256("risk"));
        BridgeTransferRegistry transfers = new BridgeTransferRegistry(address(this), address(env.registry()), keccak256("transfers"));
        BridgeRouteRegistry routes = new BridgeRouteRegistry(address(this), address(env.registry()), keccak256("routes"));
        MockBridgeAdapter420 bridgeAdapter = new MockBridgeAdapter420();

        env.registerResident(address(markets), markets.componentId());
        env.registerResident(address(swapExecutor), swapExecutor.componentId());
        env.registerResident(address(payAdapter), payAdapter.componentId());
        env.registerResident(address(pay), pay.componentId());
        env.registerResident(address(bridge), bridge.componentId());
        env.registerResident(address(risk), risk.componentId());
        env.registerResident(address(transfers), transfers.componentId());
        env.registerResident(address(routes), routes.componentId());

        env.setSettlementAsset(CADC, ASSET_ID, true);
        env.health().setMarket(MARKET_ID, true);
        env.health().setRoute(ROUTE_ID, true);
        env.fees().set(0, 0, false);
        env.risk().set(1_000_000 ether, 0);

        markets.setMarket(MARKET_ID, address(pool), INPUT, CADC, CanonicalMarketRegistry.Role.CANONICAL_CAD, bytes32(0), true);
        swapExecutor.setTrustedCaller(address(payAdapter), true);
        pay.setSettlementAdapter(address(payAdapter));
        pool.setResult(90 ether, 84 ether, false);

        BridgeRouteRegistry.Route memory route = BridgeRouteRegistry.Route({
            assetId: ASSET_ID,
            sourceChainId: 1,
            destinationChainId: uint64(block.chainid),
            sourceAsset: bytes32(uint256(uint160(CADC))),
            destinationAsset: bytes32(uint256(uint160(CADC))),
            adapterId: ADAPTER_ID,
            verifierConfigHash: keccak256("verified-config"),
            version: 1,
            status: BridgeRouteRegistry.Status.ACTIVE,
            inboundEnabled: true,
            outboundEnabled: true
        });
        routes.setRoute(ROUTE_ID, route);
        BridgeRiskManager.Limits memory limits = BridgeRiskManager.Limits(
            1_000_000 ether, 1_000_000 ether, 1_000_000 ether,
            1_000_000 ether, 1_000_000 ether, 1_000_000 ether
        );
        risk.setRouteLimits(ROUTE_ID, limits);
        risk.setAssetLimits(ASSET_ID, limits);
        risk.setRouter(address(bridge), true);
        transfers.setRouter(address(bridge), true);
        bridge.setAdapter(ADAPTER_ID, address(bridgeAdapter));
        bridgeAdapter.setInbound(IBridgeAdapter420.VerifiedTransfer({
            routeId: ROUTE_ID, assetId: ASSET_ID, sender: address(0xA11CE), recipient: address(0xB0B),
            amount: 100 ether, sourceTxId: keccak256("source"), sourceMessageId: keccak256("message")
        }));

        bytes32 bridgeTransferId = bridge.acceptInbound(ADAPTER_ID, hex"4201");
        require(bridgeTransferId != bytes32(0), "bridge transfer");

        ICanonicalSettlement420.Quote memory q = ICanonicalSettlement420.Quote(
            keccak256("cross-quote"), MARKET_ID, INPUT, CADC,
            100 ether, 84 ether, 85 ether, 0, 42, uint64(block.timestamp)
        );
        PaymentRouter420.PayerLimits memory payerLimits = PaymentRouter420.PayerLimits(
            100 ether, 1 ether, 42, 0, 0, 0, uint64(block.timestamp)
        );
        (uint256 spent, uint256 delivered) = pay.executeSwapSettlement(
            keccak256("cross-payment"), q, address(0xA11CE), address(0xB0B), 84 ether, payerLimits, 0, 0
        );
        require(spent == 90 ether && delivered == 84 ether, "pay/swap result");
    }
}
