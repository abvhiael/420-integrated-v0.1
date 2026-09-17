// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/EthereumBridgeAdapter420.sol";
import "../src/bridge/adapters/SolanaBridgeAdapter420.sol";
import "../src/interfaces/IEthereumFinalityVerifier420.sol";
import "../src/interfaces/ISolanaFinalityVerifier420.sol";

contract EmergencyEthereumVerifierMock420 is IEthereumFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata transfer_) external { nextTransfer = transfer_; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract EmergencySolanaVerifierMock420 is ISolanaFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata transfer_) external { nextTransfer = transfer_; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract EmergencyRouterCaller420 {
    function ethInbound(EthereumBridgeAdapter420 adapter) external returns (IBridgeAdapter420.VerifiedTransfer memory) {
        return adapter.verifyInbound(hex"01");
    }

    function solInbound(SolanaBridgeAdapter420 adapter) external returns (IBridgeAdapter420.VerifiedTransfer memory) {
        return adapter.verifyInbound(hex"02");
    }

    function ethOutbound(EthereumBridgeAdapter420 adapter, bytes32 routeId, bytes32 assetId)
        external returns (bytes32)
    {
        return adapter.initiateOutbound(routeId, assetId, address(this), abi.encodePacked(address(0xB0B)), 420, hex"11");
    }

    function solOutbound(SolanaBridgeAdapter420 adapter, bytes32 routeId, bytes32 assetId)
        external returns (bytes32)
    {
        return adapter.initiateOutbound(routeId, assetId, address(this), abi.encode(bytes32(uint256(0xB0B))), 420, hex"22");
    }
}

contract UnauthorizedEmergencyCaller420 {
    function setEth(EthereumBridgeAdapter420 adapter, bool inbound, bool halted, bytes32 incident) external {
        adapter.setEmergencyHalt(inbound, halted, incident);
    }

    function setSol(SolanaBridgeAdapter420 adapter, bool inbound, bool halted, bytes32 incident) external {
        adapter.setEmergencyHalt(inbound, halted, incident);
    }
}

/// @notice V12.6.4 directional pause and emergency-control hardening.
contract EmergencyControlsHardening420Test {
    address private constant ETH_GATEWAY = address(0x420420);
    address private constant ETH_TOKEN = address(0xE420);
    bytes32 private constant ETH_ASSET = keccak256("420/BRIDGE/ASSET/EMERGENCY/ETH");
    bytes32 private constant ETH_ROUTE = keccak256("420/BRIDGE/ROUTE/EMERGENCY/ETH");

    bytes32 private constant SOL_PROGRAM = keccak256("420/BRIDGE/GATEWAY/EMERGENCY/SOL");
    bytes32 private constant SOL_MINT = keccak256("420/BRIDGE/SOLANA/EMERGENCY/MINT");
    bytes32 private constant SOL_ASSET = keccak256("420/BRIDGE/ASSET/EMERGENCY/SOL");
    bytes32 private constant SOL_ROUTE = keccak256("420/BRIDGE/ROUTE/EMERGENCY/SOL");
    bytes32 private constant SOL_OWNER = bytes32(uint256(0xA11CE));
    bytes32 private constant INCIDENT = keccak256("420/INCIDENT/V12.6.4");

    EmergencyEthereumVerifierMock420 private ethVerifier;
    EmergencySolanaVerifierMock420 private solVerifier;
    EmergencyRouterCaller420 private router;
    UnauthorizedEmergencyCaller420 private attacker;
    EthereumBridgeAdapter420 private ethAdapter;
    SolanaBridgeAdapter420 private solAdapter;

    constructor() {
        ethVerifier = new EmergencyEthereumVerifierMock420();
        solVerifier = new EmergencySolanaVerifierMock420();
        router = new EmergencyRouterCaller420();
        attacker = new UnauthorizedEmergencyCaller420();

        ethAdapter = new EthereumBridgeAdapter420(address(this), address(router), address(ethVerifier));
        solAdapter = new SolanaBridgeAdapter420(address(this), address(router), address(solVerifier));

        ethAdapter.setGateway(ETH_GATEWAY, true);
        ethAdapter.setAssetMapping(ethAdapter.sourceAssetKey(ETH_TOKEN), ETH_ASSET, true);
        ethAdapter.setRouteBinding(ETH_ASSET, ETH_ROUTE);

        solAdapter.setGatewayProgram(SOL_PROGRAM, true);
        solAdapter.setAssetMapping(SOL_MINT, SOL_ASSET, true);
        solAdapter.setRouteBinding(SOL_ASSET, SOL_ROUTE);
    }

    function testUnauthorizedEmergencyChangesRejected() public {
        (bool ethOk,) = address(attacker).call(
            abi.encodeCall(attacker.setEth, (ethAdapter, true, true, INCIDENT))
        );
        (bool solOk,) = address(attacker).call(
            abi.encodeCall(attacker.setSol, (solAdapter, true, true, INCIDENT))
        );
        require(!ethOk && !solOk, "unauthorized halt accepted");
        require(!ethAdapter.inboundHalted() && !solAdapter.inboundHalted(), "halt state changed");
    }

    function testZeroIncidentRejectedWhenHalting() public {
        (bool ethOk,) = address(ethAdapter).call(
            abi.encodeCall(ethAdapter.setEmergencyHalt, (true, true, bytes32(0)))
        );
        (bool solOk,) = address(solAdapter).call(
            abi.encodeCall(solAdapter.setEmergencyHalt, (false, true, bytes32(0)))
        );
        require(!ethOk && !solOk, "zero incident accepted");
    }

    function testEthereumInboundHaltPreservesReplayState() public {
        bytes32 messageId = keccak256("emergency-eth-inbound");
        ethVerifier.set(_ethTransfer(messageId));
        ethAdapter.setEmergencyHalt(true, true, INCIDENT);

        (bool ok,) = address(router).call(abi.encodeCall(router.ethInbound, (ethAdapter)));
        require(!ok, "halted eth inbound accepted");
        require(!ethAdapter.consumedMessages(messageId), "halt consumed replay state");

        ethAdapter.setEmergencyHalt(true, false, bytes32(0));
        require(!ethAdapter.inboundHalted(), "eth inbound did not reopen");
        require(ethAdapter.inboundIncidentHash() == bytes32(0), "eth incident not cleared");
        router.ethInbound(ethAdapter);
        require(ethAdapter.consumedMessages(messageId), "eth message not consumed after reopen");
    }

    function testSolanaInboundHaltPreservesReplayState() public {
        bytes32 messageId = keccak256("emergency-sol-inbound");
        solVerifier.set(_solTransfer(messageId));
        solAdapter.setEmergencyHalt(true, true, INCIDENT);

        (bool ok,) = address(router).call(abi.encodeCall(router.solInbound, (solAdapter)));
        require(!ok, "halted sol inbound accepted");
        require(!solAdapter.consumedMessages(messageId), "halt consumed replay state");

        solAdapter.setEmergencyHalt(true, false, bytes32(0));
        require(!solAdapter.inboundHalted(), "sol inbound did not reopen");
        require(solAdapter.inboundIncidentHash() == bytes32(0), "sol incident not cleared");
        router.solInbound(solAdapter);
        require(solAdapter.consumedMessages(messageId), "sol message not consumed after reopen");
    }

    function testEthereumOutboundHaltPreservesNonceAndDirectionIndependence() public {
        bytes32 messageId = keccak256("emergency-eth-directional");
        ethVerifier.set(_ethTransfer(messageId));
        ethAdapter.setEmergencyHalt(false, true, INCIDENT);

        (bool ok,) = address(router).call(abi.encodeCall(router.ethOutbound, (ethAdapter, ETH_ROUTE, ETH_ASSET)));
        require(!ok, "halted eth outbound accepted");
        require(ethAdapter.outboundNonce() == 0, "halt advanced eth nonce");
        require(ethAdapter.outboundIncidentHash() == INCIDENT, "eth incident missing");

        router.ethInbound(ethAdapter);
        require(ethAdapter.consumedMessages(messageId), "eth inbound incorrectly halted");

        ethAdapter.setEmergencyHalt(false, false, bytes32(0));
        require(ethAdapter.outboundIncidentHash() == bytes32(0), "eth outbound incident not cleared");
        bytes32 outboundId = router.ethOutbound(ethAdapter, ETH_ROUTE, ETH_ASSET);
        require(outboundId != bytes32(0) && ethAdapter.outboundNonce() == 1, "eth outbound not restored");
    }

    function testSolanaOutboundHaltPreservesNonceAndDirectionIndependence() public {
        bytes32 messageId = keccak256("emergency-sol-directional");
        solVerifier.set(_solTransfer(messageId));
        solAdapter.setEmergencyHalt(false, true, INCIDENT);

        (bool ok,) = address(router).call(abi.encodeCall(router.solOutbound, (solAdapter, SOL_ROUTE, SOL_ASSET)));
        require(!ok, "halted sol outbound accepted");
        require(solAdapter.outboundNonce() == 0, "halt advanced sol nonce");
        require(solAdapter.outboundIncidentHash() == INCIDENT, "sol incident missing");

        router.solInbound(solAdapter);
        require(solAdapter.consumedMessages(messageId), "sol inbound incorrectly halted");

        solAdapter.setEmergencyHalt(false, false, bytes32(0));
        require(solAdapter.outboundIncidentHash() == bytes32(0), "sol outbound incident not cleared");
        bytes32 outboundId = router.solOutbound(solAdapter, SOL_ROUTE, SOL_ASSET);
        require(outboundId != bytes32(0) && solAdapter.outboundNonce() == 1, "sol outbound not restored");
    }

    function _ethTransfer(bytes32 messageId)
        private view returns (IEthereumFinalityVerifier420.FinalizedTransfer memory p)
    {
        p = IEthereumFinalityVerifier420.FinalizedTransfer({
            sourceChainId: ethAdapter.ETHEREUM_MAINNET_CHAIN_ID(),
            blockNumber: 22_000_004,
            blockHash: keccak256("emergency-eth-block"),
            receiptsRoot: keccak256("emergency-eth-receipts"),
            transactionHash: keccak256(abi.encode("emergency-eth-tx", messageId)),
            messageId: messageId,
            gateway: ETH_GATEWAY,
            sourceToken: ETH_TOKEN,
            sourceSender: address(0xA11CE),
            recipient: address(0xB0B),
            amount: 420_000_000,
            finalized: true
        });
    }

    function _solTransfer(bytes32 messageId)
        private view returns (ISolanaFinalityVerifier420.FinalizedTransfer memory p)
    {
        p = ISolanaFinalityVerifier420.FinalizedTransfer({
            genesisHash: solAdapter.SOLANA_MAINNET_GENESIS_HASH(),
            slot: 250_000_004,
            transactionSignature: keccak256(abi.encode("emergency-sol-tx", messageId)),
            messageId: messageId,
            gatewayProgram: SOL_PROGRAM,
            sourceAsset: SOL_MINT,
            sourceOwner: SOL_OWNER,
            recipient: address(0xB0B),
            amount: 420_000_000,
            finalized: true
        });
    }
}
