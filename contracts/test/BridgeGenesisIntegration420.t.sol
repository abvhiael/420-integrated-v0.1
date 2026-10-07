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

contract MockBridgeAdapter420 is IBridgeAdapter420 {
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

contract MockWrongBridgeAdapter420 is IBridgeAdapter420 {
    VerifiedTransfer public nextTransfer;
    bytes32 public nextOutboundId = keccak256("wrong-outbound-message");

    function adapterId() external pure returns (bytes32) { return keccak256("TEST/BRIDGE/WRONG_ADAPTER"); }
    function setInbound(VerifiedTransfer calldata v) external { nextTransfer = v; }
    function verifyInbound(bytes calldata) external view returns (VerifiedTransfer memory) { return nextTransfer; }
    function initiateOutbound(bytes32,bytes32,address,bytes calldata,uint256,bytes calldata)
        external payable returns(bytes32 sourceMessageId)
    { return nextOutboundId; }
}

contract MockVerifiedGatewayVerifier420 is IVerifiedGatewayVerifier420 {
    function verifyDeposit(bytes calldata) external pure returns (bytes32,address,address,uint256) {
        return (keccak256("deposit"), address(0xB0B), address(0xCA420), 1 ether);
    }
    function verifyWithdrawal(bytes calldata) external pure returns (bytes32,address,address,uint256) {
        return (keccak256("withdrawal"), address(0xB0B), address(0xCA420), 1 ether);
    }
}

interface VmBridgeAccounting420 { function warp(uint256) external; }

contract BridgeGenesisIntegration420Test {
    VmBridgeAccounting420 constant vm =
        VmBridgeAccounting420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant ROUTE_ID = keccak256("CADC/LZ/ETH-420");
    bytes32 constant ASSET_ID = keccak256("CADC");
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
        MockBridgeAdapter420 adapter;
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
        f.adapter = new MockBridgeAdapter420();

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

    function testInboundCreatesTransferAndConsumesRiskAtomically() public {
        Fixture memory f = _setup();
        f.adapter.setInbound(_inbound(100 ether));
        bytes32 transferId = f.router.acceptInbound(ADAPTER_ID, hex"4201");
        (,,,,uint256 amount,,, BridgeTransferRegistry.Status status,,) = f.transfers.transfers(transferId);
        require(amount == 100 ether && status == BridgeTransferRegistry.Status.VERIFIED, "transfer");
        (,,,,,,uint256 routeTVL) = f.risk.routeUsage(ROUTE_ID);
        require(routeTVL == 100 ether, "route risk");
    }

    function testReplayFailureRollsBackRiskConsumption() public {
        Fixture memory f = _setup();
        f.adapter.setInbound(_inbound(100 ether));
        f.router.acceptInbound(ADAPTER_ID, hex"4201");
        (,,,,,,uint256 beforeTVL) = f.risk.routeUsage(ROUTE_ID);
        (bool ok,) = address(f.router).call(abi.encodeWithSelector(f.router.acceptInbound.selector, ADAPTER_ID, hex"4201"));
        require(!ok, "replay accepted");
        (,,,,,,uint256 afterTVL) = f.risk.routeUsage(ROUTE_ID);
        require(afterTVL == beforeTVL, "risk did not roll back");
    }

    function testOutboundAfterInboundReducesTVL() public {
        Fixture memory f = _setup();
        f.adapter.setInbound(_inbound(100 ether));
        f.router.acceptInbound(ADAPTER_ID, hex"4201");
        bytes memory recipient = hex"0102";
        bytes32 messageId = f.router.initiateOutbound(ADAPTER_ID, ROUTE_ID, ASSET_ID, recipient, 40 ether, hex"");
        require(messageId != bytes32(0), "message");
        bytes32 transferId = f.transfers.deriveOutboundTransferId(
            ROUTE_ID, ASSET_ID, address(this), keccak256(recipient), 40 ether, messageId
        );
        (,,,,,,, BridgeTransferRegistry.Status status,,) = f.transfers.transfers(transferId);
        require(status == BridgeTransferRegistry.Status.SOURCE_PENDING, "outbound not registered");
        require(
            f.transfers.transferDirection(transferId) == BridgeTransferRegistry.Direction.OUTBOUND,
            "outbound direction"
        );
        (,,,,,,uint256 routeTVL) = f.risk.routeUsage(ROUTE_ID);
        require(routeTVL == 60 ether, "tvl");
    }

    function testInboundWrongRegisteredAdapterFailsClosed() public {
        Fixture memory f = _setup();
        MockWrongBridgeAdapter420 wrong = new MockWrongBridgeAdapter420();
        wrong.setInbound(_inbound(10 ether));
        f.router.setAdapter(WRONG_ADAPTER_ID, address(wrong));
        (bool ok,) = address(f.router).call(
            abi.encodeWithSelector(f.router.acceptInbound.selector, WRONG_ADAPTER_ID, hex"4201")
        );
        require(!ok, "wrong route adapter accepted");
        (,,,,,,uint256 routeTVL) = f.risk.routeUsage(ROUTE_ID);
        require(routeTVL == 0, "risk consumed for wrong adapter");
    }

    function testOutboundWrongRegisteredAdapterFailsClosed() public {
        Fixture memory f = _setup();
        f.adapter.setInbound(_inbound(100 ether));
        f.router.acceptInbound(ADAPTER_ID, hex"4201");
        MockWrongBridgeAdapter420 wrong = new MockWrongBridgeAdapter420();
        f.router.setAdapter(WRONG_ADAPTER_ID, address(wrong));
        (bool ok,) = address(f.router).call(
            abi.encodeWithSelector(
                f.router.initiateOutbound.selector,
                WRONG_ADAPTER_ID,
                ROUTE_ID,
                ASSET_ID,
                hex"0102",
                10 ether,
                hex""
            )
        );
        require(!ok, "wrong outbound route adapter accepted");
        (,,,,,,uint256 routeTVL) = f.risk.routeUsage(ROUTE_ID);
        require(routeTVL == 100 ether, "risk changed for wrong adapter");
    }

    function testDirectionDisabledFailsClosed() public {
        Fixture memory f = _setup();
        f.routes.setDirection(ROUTE_ID, false, true);
        f.adapter.setInbound(_inbound(10 ether));
        (bool ok,) = address(f.router).call(abi.encodeWithSelector(f.router.acceptInbound.selector, ADAPTER_ID, hex"4201"));
        require(!ok, "disabled inbound accepted");
    }

    function testInboundFailsWhenSourceNetworkFingerprintDrifts() public {
        Fixture memory f = _setup();
        f.chains.setChain(EXTERNAL_CHAIN, _chain(1, keccak256("TEST-EXTERNAL/FORK"), true));
        f.adapter.setInbound(_inbound(10 ether));
        (bool ok,) = address(f.router).call(abi.encodeWithSelector(f.router.acceptInbound.selector, ADAPTER_ID, hex"4201"));
        require(!ok, "stale source network accepted");
        (,,,,,,uint256 routeTVL) = f.risk.routeUsage(ROUTE_ID);
        require(routeTVL == 0, "risk consumed for stale network");
    }

    function testOutboundFailsWhenDestinationChainInactive() public {
        Fixture memory f = _setup();
        f.chains.setChain(LOCAL_CHAIN, _chain(uint64(block.chainid), LOCAL_NETWORK, false));
        (bool ok,) = address(f.router).call(
            abi.encodeWithSelector(
                f.router.initiateOutbound.selector,
                ADAPTER_ID,
                ROUTE_ID,
                ASSET_ID,
                hex"0102",
                10 ether,
                hex""
            )
        );
        require(!ok, "inactive destination chain accepted");
    }


    function testUnknownAccountingHealthBlocksNewInboundBeforeRiskConsumption() public {
        Fixture memory f = _setup();
        BridgeAccountingRegistry unknown =
            new BridgeAccountingRegistry(address(this), address(f.env.registry()), keccak256("unknown-accounting"));
        f.env.registerResident(address(unknown), unknown.componentId());

        f.adapter.setInbound(_inbound(10 ether));
        (bool ok,) = address(f.router).call(
            abi.encodeWithSelector(f.router.acceptInbound.selector, ADAPTER_ID, hex"4201")
        );
        require(!ok, "unknown accounting accepted");
        (,,,,,,uint256 routeTVL) = f.risk.routeUsage(ROUTE_ID);
        require(routeTVL == 0, "risk consumed for unknown accounting");
    }

    function testAuthorizedExceedsObservedBlocksNewInbound() public {
        Fixture memory f = _setup();
        vm.warp(block.timestamp + 1);
        f.accounting.applyReconciliation(
            ASSET_ID, 1_000_000 ether, 999_999 ether, uint64(block.timestamp), keccak256("authorized-exceeds-observed")
        );
        require(
            f.accounting.healthState(ASSET_ID)
                == BridgeAccountingRegistry.HealthState.AUTHORIZED_EXCEEDS_OBSERVED,
            "wrong deficit health"
        );

        f.adapter.setInbound(_inbound(10 ether));
        (bool ok,) = address(f.router).call(
            abi.encodeWithSelector(f.router.acceptInbound.selector, ADAPTER_ID, hex"4201")
        );
        require(!ok, "deficit accounting accepted");
        (,,,,,,uint256 routeTVL) = f.risk.routeUsage(ROUTE_ID);
        require(routeTVL == 0, "risk consumed for deficit accounting");
    }

    function testObservedExceedsAuthorizedBlocksNewOutbound() public {
        Fixture memory f = _setup();
        f.adapter.setInbound(_inbound(100 ether));
        f.router.acceptInbound(ADAPTER_ID, hex"4201");
        (,,,,,,uint256 beforeTVL) = f.risk.routeUsage(ROUTE_ID);

        vm.warp(block.timestamp + 1);
        f.accounting.applyReconciliation(
            ASSET_ID, 1_000_000 ether, 1_000_001 ether, uint64(block.timestamp), keccak256("observed-exceeds-authorized")
        );
        require(
            f.accounting.healthState(ASSET_ID)
                == BridgeAccountingRegistry.HealthState.OBSERVED_EXCEEDS_AUTHORIZED,
            "wrong surplus health"
        );

        (bool ok,) = address(f.router).call(
            abi.encodeWithSelector(
                f.router.initiateOutbound.selector, ADAPTER_ID, ROUTE_ID, ASSET_ID, hex"0102", 10 ether, hex""
            )
        );
        require(!ok, "surplus accounting accepted");
        (,,,,,,uint256 afterTVL) = f.risk.routeUsage(ROUTE_ID);
        require(afterTVL == beforeTVL, "risk changed for unhealthy accounting");
    }

    function testRecoveryRequiresNewerDistinctEvidenceBeforeMovementResumes() public {
        Fixture memory f = _setup();
        vm.warp(block.timestamp + 1);
        bytes32 mismatchEvidence = keccak256("mismatch");
        f.accounting.applyReconciliation(
            ASSET_ID, 1_000_000 ether, 999_999 ether, uint64(block.timestamp), mismatchEvidence
        );
        require(!f.accounting.movementHealthy(ASSET_ID), "mismatch healthy");

        vm.warp(block.timestamp + 1);
        (bool replayOk,) = address(f.accounting).call(
            abi.encodeCall(
                f.accounting.applyReconciliation,
                (ASSET_ID, 1_000_000 ether, 1_000_000 ether, uint64(block.timestamp), mismatchEvidence)
            )
        );
        require(!replayOk, "replayed evidence restored health");
        require(!f.accounting.movementHealthy(ASSET_ID), "replay changed health");

        bytes32 recoveryEvidence = keccak256("newer-distinct-recovery");
        f.accounting.applyReconciliation(
            ASSET_ID, 1_000_000 ether, 1_000_000 ether, uint64(block.timestamp), recoveryEvidence
        );
        require(f.accounting.movementHealthy(ASSET_ID), "newer recovery not healthy");

        f.adapter.setInbound(_inbound(10 ether));
        bytes32 transferId = f.router.acceptInbound(ADAPTER_ID, hex"4201");
        require(transferId != bytes32(0), "movement did not resume");
    }

    function testAccountingRecoveryDoesNotRewriteCompletedTransferHistory() public {
        Fixture memory f = _setup();
        f.adapter.setInbound(_inbound(25 ether));
        bytes32 transferId = f.router.acceptInbound(ADAPTER_ID, hex"4201");
        f.transfers.markDestinationPending(transferId, keccak256("destination-pending"));
        f.transfers.markCompleted(transferId, keccak256("completed"));
        (,,,,,,, BridgeTransferRegistry.Status beforeStatus,,) = f.transfers.transfers(transferId);
        require(beforeStatus == BridgeTransferRegistry.Status.COMPLETED, "precondition");

        vm.warp(block.timestamp + 1);
        f.accounting.applyReconciliation(
            ASSET_ID, 1_000_000 ether, 999_999 ether, uint64(block.timestamp), keccak256("history-mismatch")
        );
        vm.warp(block.timestamp + 1);
        f.accounting.applyReconciliation(
            ASSET_ID, 1_000_000 ether, 1_000_000 ether, uint64(block.timestamp), keccak256("history-recovery")
        );

        (,,,,,,, BridgeTransferRegistry.Status afterStatus,,) = f.transfers.transfers(transferId);
        require(afterStatus == BridgeTransferRegistry.Status.COMPLETED, "settled history rewritten");
    }

    function testWithdrawalRecoveryRemainsSafetyBoundWhileAccountingUnhealthy() public {
        Fixture memory f = _setup();
        f.adapter.setInbound(_inbound(25 ether));
        bytes32 transferId = f.router.acceptInbound(ADAPTER_ID, hex"4201");
        f.transfers.markFailed(transferId, keccak256("destination-failure"));

        vm.warp(block.timestamp + 1);
        f.accounting.applyReconciliation(
            ASSET_ID, 1_000_000 ether, 999_999 ether, uint64(block.timestamp), keccak256("refund-mismatch")
        );
        f.env.safety().setState(ISystemSafety420.SafetyState.HALTED);
        f.env.safety().setAllowed(false);
        (bool denied,) = address(f.transfers).call(
            abi.encodeWithSelector(
                f.transfers.refundTransfer.selector, transferId, keccak256("denied-withdrawal-recovery")
            )
        );
        require(!denied, "safety denial bypassed");

        f.env.safety().setAllowed(true);
        f.transfers.refundTransfer(transferId, keccak256("approved-withdrawal-recovery"));
        (,,,,,,, BridgeTransferRegistry.Status status,,) = f.transfers.transfers(transferId);
        require(status == BridgeTransferRegistry.Status.REFUNDED, "safe refund blocked");
    }

    function testFrozenGatewayMayStartFailClosedWithoutVerifier() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        VerifiedGateway420 gateway =
            new VerifiedGateway420(address(this), address(env.registry()), keccak256("gateway-genesis"), address(0));
        env.registerResident(address(gateway), gateway.componentId());
        require(gateway.verifier() == address(0), "genesis verifier not disabled");

        (bool ok,) = address(gateway).call(abi.encodeWithSelector(gateway.verifyDeposit.selector, hex"4201"));
        require(!ok, "disabled verifier accepted proof");
    }

    function testFrozenGatewayVerifierActivationRequiresCode() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        VerifiedGateway420 gateway =
            new VerifiedGateway420(address(this), address(env.registry()), keccak256("gateway-genesis"), address(0));
        env.registerResident(address(gateway), gateway.componentId());

        (bool eoaOk,) = address(gateway).call(
            abi.encodeWithSelector(gateway.setVerifier.selector, address(0x1234))
        );
        require(!eoaOk, "non-code verifier accepted");

        MockVerifiedGatewayVerifier420 verifier = new MockVerifiedGatewayVerifier420();
        gateway.setVerifier(address(verifier));
        require(gateway.verifier() == address(verifier), "verifier not installed");
    }

    function testSharedPauseFailsClosed() public {
        Fixture memory f = _setup();
        f.env.pause().setPaused(true);
        f.adapter.setInbound(_inbound(10 ether));
        (bool ok,) = address(f.router).call(abi.encodeWithSelector(f.router.acceptInbound.selector, ADAPTER_ID, hex"4201"));
        require(!ok, "paused inbound accepted");
    }
}
