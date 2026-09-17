// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/EthereumBridgeAdapter420.sol";
import "../src/bridge/adapters/SolanaBridgeAdapter420.sol";
import "../src/interfaces/IEthereumFinalityVerifier420.sol";
import "../src/interfaces/ISolanaFinalityVerifier420.sol";

contract DomainEthereumVerifierMock420 is IEthereumFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata transfer_) external { nextTransfer = transfer_; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract DomainSolanaVerifierMock420 is ISolanaFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata transfer_) external { nextTransfer = transfer_; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract DomainRouterCaller420 {
    function ethInbound(EthereumBridgeAdapter420 adapter) external returns (IBridgeAdapter420.VerifiedTransfer memory) {
        return adapter.verifyInbound(hex"01");
    }

    function solInbound(SolanaBridgeAdapter420 adapter) external returns (IBridgeAdapter420.VerifiedTransfer memory) {
        return adapter.verifyInbound(hex"02");
    }

    function ethOutbound(
        EthereumBridgeAdapter420 adapter,
        bytes32 routeId,
        bytes32 assetId,
        address sender,
        bytes calldata recipient,
        uint256 amount,
        bytes calldata extra
    ) external returns (bytes32) {
        return adapter.initiateOutbound(routeId, assetId, sender, recipient, amount, extra);
    }

    function solOutbound(
        SolanaBridgeAdapter420 adapter,
        bytes32 routeId,
        bytes32 assetId,
        address sender,
        bytes calldata recipient,
        uint256 amount,
        bytes calldata extra
    ) external returns (bytes32) {
        return adapter.initiateOutbound(routeId, assetId, sender, recipient, amount, extra);
    }
}

contract RouterBypassCaller420 {
    function ethInbound(EthereumBridgeAdapter420 adapter) external returns (IBridgeAdapter420.VerifiedTransfer memory) {
        return adapter.verifyInbound(hex"01");
    }

    function solInbound(SolanaBridgeAdapter420 adapter) external returns (IBridgeAdapter420.VerifiedTransfer memory) {
        return adapter.verifyInbound(hex"02");
    }

    function ethOutbound(EthereumBridgeAdapter420 adapter, bytes32 routeId, bytes32 assetId) external returns (bytes32) {
        return adapter.initiateOutbound(routeId, assetId, address(this), abi.encodePacked(address(0xB0B)), 420, hex"aa");
    }

    function solOutbound(SolanaBridgeAdapter420 adapter, bytes32 routeId, bytes32 assetId) external returns (bytes32) {
        return adapter.initiateOutbound(routeId, assetId, address(this), abi.encode(bytes32(uint256(0xB0B))), 420, hex"aa");
    }
}

/// @notice V12.6.6 domain, nonce and router-bypass hardening.
contract DomainNonceRouterBypassHardening420Test {
    address private constant ETH_GATEWAY = address(0x420420);
    address private constant ETH_TOKEN = address(0xE420);
    bytes32 private constant ETH_ASSET = keccak256("420/BRIDGE/ASSET/DOMAIN/ETH");
    bytes32 private constant ETH_ROUTE = keccak256("420/BRIDGE/ROUTE/DOMAIN/ETH");

    bytes32 private constant SOL_PROGRAM = keccak256("420/BRIDGE/GATEWAY/DOMAIN/SOL");
    bytes32 private constant SOL_MINT = keccak256("420/BRIDGE/SOLANA/DOMAIN/MINT");
    bytes32 private constant SOL_ASSET = keccak256("420/BRIDGE/ASSET/DOMAIN/SOL");
    bytes32 private constant SOL_ROUTE = keccak256("420/BRIDGE/ROUTE/DOMAIN/SOL");
    bytes32 private constant SOL_OWNER = bytes32(uint256(0xA11CE));

    DomainEthereumVerifierMock420 private ethVerifier;
    DomainSolanaVerifierMock420 private solVerifier;
    DomainRouterCaller420 private router;
    RouterBypassCaller420 private attacker;
    EthereumBridgeAdapter420 private ethAdapter;
    SolanaBridgeAdapter420 private solAdapter;

    constructor() {
        ethVerifier = new DomainEthereumVerifierMock420();
        solVerifier = new DomainSolanaVerifierMock420();
        router = new DomainRouterCaller420();
        attacker = new RouterBypassCaller420();

        ethAdapter = new EthereumBridgeAdapter420(address(this), address(router), address(ethVerifier));
        solAdapter = new SolanaBridgeAdapter420(address(this), address(router), address(solVerifier));

        ethAdapter.setGateway(ETH_GATEWAY, true);
        ethAdapter.setAssetMapping(ethAdapter.sourceAssetKey(ETH_TOKEN), ETH_ASSET, true);
        ethAdapter.setRouteBinding(ETH_ASSET, ETH_ROUTE);

        solAdapter.setGatewayProgram(SOL_PROGRAM, true);
        solAdapter.setAssetMapping(SOL_MINT, SOL_ASSET, true);
        solAdapter.setRouteBinding(SOL_ASSET, SOL_ROUTE);
    }

    function testCanonicalAdapterDomainsAreDistinct() public view {
        require(ethAdapter.ADAPTER_ID() != bytes32(0), "zero eth domain");
        require(solAdapter.ADAPTER_ID() != bytes32(0), "zero sol domain");
        require(ethAdapter.ADAPTER_ID() != solAdapter.ADAPTER_ID(), "adapter domain collision");
    }

    function testIdenticalEconomicOutboundRequestsCannotShareCrossAdapterMessageId() public {
        address sender = address(0xA11CE);
        bytes memory ethRecipient = abi.encodePacked(address(0xB0B));
        bytes memory solRecipient = abi.encode(bytes32(uint256(uint160(address(0xB0B)))));
        bytes memory extra = abi.encode("same-economic-request");

        bytes32 ethId = router.ethOutbound(ethAdapter, ETH_ROUTE, ETH_ASSET, sender, ethRecipient, 420, extra);
        bytes32 solId = router.solOutbound(solAdapter, SOL_ROUTE, SOL_ASSET, sender, solRecipient, 420, extra);

        require(ethId != bytes32(0) && solId != bytes32(0), "zero source message id");
        require(ethId != solId, "cross-adapter message collision");
        require(ethAdapter.outboundNonce() == 1 && solAdapter.outboundNonce() == 1, "nonce mismatch");
    }

    function testSequentialEthereumOutboundUsesMonotonicNonceAndDistinctIdentity() public {
        bytes memory recipient = abi.encodePacked(address(0xB0B));
        bytes memory extra = hex"1234";
        bytes32 first = router.ethOutbound(ethAdapter, ETH_ROUTE, ETH_ASSET, address(0xA11CE), recipient, 420, extra);
        require(ethAdapter.outboundNonce() == 1, "eth nonce not one");
        bytes32 second = router.ethOutbound(ethAdapter, ETH_ROUTE, ETH_ASSET, address(0xA11CE), recipient, 420, extra);
        require(ethAdapter.outboundNonce() == 2, "eth nonce not two");
        require(first != second, "eth sequential collision");
    }

    function testSequentialSolanaOutboundUsesMonotonicNonceAndDistinctIdentity() public {
        bytes memory recipient = abi.encode(bytes32(uint256(0xB0B)));
        bytes memory extra = hex"1234";
        bytes32 first = router.solOutbound(solAdapter, SOL_ROUTE, SOL_ASSET, address(0xA11CE), recipient, 420, extra);
        require(solAdapter.outboundNonce() == 1, "sol nonce not one");
        bytes32 second = router.solOutbound(solAdapter, SOL_ROUTE, SOL_ASSET, address(0xA11CE), recipient, 420, extra);
        require(solAdapter.outboundNonce() == 2, "sol nonce not two");
        require(first != second, "sol sequential collision");
    }

    function testInvalidOutboundPreservesNonce() public {
        bytes memory badEthRecipient = new bytes(19);
        bytes memory badSolRecipient = new bytes(31);

        (bool ethOk,) = address(router).call(
            abi.encodeCall(
                router.ethOutbound,
                (ethAdapter, ETH_ROUTE, ETH_ASSET, address(0xA11CE), badEthRecipient, uint256(420), bytes(""))
            )
        );
        (bool solOk,) = address(router).call(
            abi.encodeCall(
                router.solOutbound,
                (solAdapter, SOL_ROUTE, SOL_ASSET, address(0xA11CE), badSolRecipient, uint256(420), bytes(""))
            )
        );

        require(!ethOk && !solOk, "invalid outbound accepted");
        require(ethAdapter.outboundNonce() == 0, "eth failed call burned nonce");
        require(solAdapter.outboundNonce() == 0, "sol failed call burned nonce");
    }

    function testDirectOutboundRouterBypassRejectedWithoutNonceMutation() public {
        (bool ethOk,) = address(attacker).call(abi.encodeCall(attacker.ethOutbound, (ethAdapter, ETH_ROUTE, ETH_ASSET)));
        (bool solOk,) = address(attacker).call(abi.encodeCall(attacker.solOutbound, (solAdapter, SOL_ROUTE, SOL_ASSET)));

        require(!ethOk && !solOk, "router bypass outbound accepted");
        require(ethAdapter.outboundNonce() == 0, "eth bypass burned nonce");
        require(solAdapter.outboundNonce() == 0, "sol bypass burned nonce");
    }

    function testDirectInboundRouterBypassRejectedWithoutReplayMutation() public {
        bytes32 ethMessage = keccak256("router-bypass-eth-inbound");
        bytes32 solMessage = keccak256("router-bypass-sol-inbound");
        ethVerifier.set(_ethTransfer(ethMessage));
        solVerifier.set(_solTransfer(solMessage));

        (bool ethOk,) = address(attacker).call(abi.encodeCall(attacker.ethInbound, (ethAdapter)));
        (bool solOk,) = address(attacker).call(abi.encodeCall(attacker.solInbound, (solAdapter)));

        require(!ethOk && !solOk, "router bypass inbound accepted");
        require(!ethAdapter.consumedMessages(ethMessage), "eth bypass consumed replay state");
        require(!solAdapter.consumedMessages(solMessage), "sol bypass consumed replay state");

        router.ethInbound(ethAdapter);
        router.solInbound(solAdapter);
        require(ethAdapter.consumedMessages(ethMessage), "authorized eth inbound missing");
        require(solAdapter.consumedMessages(solMessage), "authorized sol inbound missing");
    }

    function testConfiguredRouterIsImmutableBoundary() public view {
        require(ethAdapter.gatewayRouter() == address(router), "eth router drift");
        require(solAdapter.gatewayRouter() == address(router), "sol router drift");
    }

    function _ethTransfer(bytes32 messageId)
        private view returns (IEthereumFinalityVerifier420.FinalizedTransfer memory p)
    {
        p = IEthereumFinalityVerifier420.FinalizedTransfer({
            sourceChainId: ethAdapter.ETHEREUM_MAINNET_CHAIN_ID(),
            blockNumber: 22_000_006,
            blockHash: keccak256("domain-eth-block"),
            receiptsRoot: keccak256("domain-eth-receipts"),
            transactionHash: keccak256(abi.encode("domain-eth-tx", messageId)),
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
            slot: 250_000_006,
            transactionSignature: keccak256(abi.encode("domain-sol-tx", messageId)),
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
