// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/EthereumBridgeAdapter420.sol";
import "../src/bridge/adapters/SolanaBridgeAdapter420.sol";
import "../src/interfaces/IEthereumFinalityVerifier420.sol";
import "../src/interfaces/ISolanaFinalityVerifier420.sol";

contract CrossAdapterEthereumVerifierMock420 is IEthereumFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata transfer_) external { nextTransfer = transfer_; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract CrossAdapterSolanaVerifierMock420 is ISolanaFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata transfer_) external { nextTransfer = transfer_; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract CrossAdapterRouterCaller420 {
    function ethInbound(EthereumBridgeAdapter420 adapter, bytes calldata proof)
        external returns (IBridgeAdapter420.VerifiedTransfer memory)
    {
        return adapter.verifyInbound(proof);
    }

    function solInbound(SolanaBridgeAdapter420 adapter, bytes calldata proof)
        external returns (IBridgeAdapter420.VerifiedTransfer memory)
    {
        return adapter.verifyInbound(proof);
    }

    function ethOutbound(
        EthereumBridgeAdapter420 adapter,
        bytes32 routeId,
        bytes32 assetId,
        address sender,
        bytes calldata recipient,
        uint256 amount
    ) external returns (bytes32) {
        return adapter.initiateOutbound(routeId, assetId, sender, recipient, amount, bytes(""));
    }

    function solOutbound(
        SolanaBridgeAdapter420 adapter,
        bytes32 routeId,
        bytes32 assetId,
        address sender,
        bytes calldata recipient,
        uint256 amount
    ) external returns (bytes32) {
        return adapter.initiateOutbound(routeId, assetId, sender, recipient, amount, bytes(""));
    }
}

/// @notice V12.6.1 cross-adapter invariants for canonical Ethereum and Solana bridge adapters.
contract CrossAdapterHardeningBridgeAdapter420Test {
    address private constant ETH_GATEWAY = address(0x420420);
    address private constant ETH_TOKEN = address(0xE420);
    bytes32 private constant SOL_GATEWAY_PROGRAM = keccak256("420/BRIDGE/GATEWAY/HARDENING/SOLANA/V1");
    bytes32 private constant SOL_MINT = keccak256("420/BRIDGE/SOLANA/HARDENING/MINT");
    bytes32 private constant ASSET = keccak256("420/BRIDGE/ASSET/CROSS-ADAPTER-HARDENING");
    bytes32 private constant ETH_ROUTE = keccak256("420/BRIDGE/ROUTE/HARDENING/ETHEREUM/MAINNET");
    bytes32 private constant SOL_ROUTE = keccak256("420/BRIDGE/ROUTE/HARDENING/SOLANA/MAINNET");
    bytes32 private constant SOL_OWNER = bytes32(uint256(0xA11CE));

    CrossAdapterEthereumVerifierMock420 private ethVerifier;
    CrossAdapterSolanaVerifierMock420 private solVerifier;
    CrossAdapterRouterCaller420 private router;
    EthereumBridgeAdapter420 private ethAdapter;
    SolanaBridgeAdapter420 private solAdapter;

    constructor() {
        ethVerifier = new CrossAdapterEthereumVerifierMock420();
        solVerifier = new CrossAdapterSolanaVerifierMock420();
        router = new CrossAdapterRouterCaller420();

        ethAdapter = new EthereumBridgeAdapter420(address(this), address(router), address(ethVerifier));
        solAdapter = new SolanaBridgeAdapter420(address(this), address(router), address(solVerifier));

        ethAdapter.setGateway(ETH_GATEWAY, true);
        ethAdapter.setAssetMapping(ethAdapter.sourceAssetKey(ETH_TOKEN), ASSET, true);
        ethAdapter.setRouteBinding(ASSET, ETH_ROUTE);

        solAdapter.setGatewayProgram(SOL_GATEWAY_PROGRAM, true);
        solAdapter.setAssetMapping(SOL_MINT, ASSET, true);
        solAdapter.setRouteBinding(ASSET, SOL_ROUTE);
    }

    function testSameAssetIdBindsDistinctCanonicalSourcesAndRoutes() public view {
        require(ethAdapter.assetIdBySourceAsset(ethAdapter.sourceAssetKey(ETH_TOKEN)) == ASSET, "eth source mapping");
        require(solAdapter.assetIdBySourceAsset(SOL_MINT) == ASSET, "sol source mapping");
        require(ethAdapter.routeIdByAssetId(ASSET) == ETH_ROUTE, "eth route");
        require(solAdapter.routeIdByAssetId(ASSET) == SOL_ROUTE, "sol route");
        require(ETH_ROUTE != SOL_ROUTE, "route collision");
    }

    function testCrossAdapterReplayStateIsIsolated() public {
        bytes32 sharedMessageId = keccak256("cross-adapter-shared-message");
        ethVerifier.set(_ethTransfer(sharedMessageId));
        solVerifier.set(_solTransfer(sharedMessageId));

        router.ethInbound(ethAdapter, hex"01");
        router.solInbound(solAdapter, hex"02");

        require(ethAdapter.consumedMessages(sharedMessageId), "eth not consumed");
        require(solAdapter.consumedMessages(sharedMessageId), "sol not consumed");

        (bool ethReplayOk,) = address(router).call(
            abi.encodeCall(router.ethInbound, (ethAdapter, bytes(hex"01")))
        );
        (bool solReplayOk,) = address(router).call(
            abi.encodeCall(router.solInbound, (solAdapter, bytes(hex"02")))
        );
        require(!ethReplayOk, "eth replay accepted");
        require(!solReplayOk, "sol replay accepted");
    }

    function testOutboundMessagesAreAdapterDomainSeparated() public {
        bytes32 ethMessageId = router.ethOutbound(
            ethAdapter,
            ETH_ROUTE,
            ASSET,
            address(this),
            abi.encodePacked(address(0xCAFE)),
            420_000_000
        );
        bytes32 solMessageId = router.solOutbound(
            solAdapter,
            SOL_ROUTE,
            ASSET,
            address(this),
            abi.encodePacked(bytes32(uint256(0xCAFE))),
            420_000_000
        );
        require(ethMessageId != bytes32(0) && solMessageId != bytes32(0), "zero message");
        require(ethMessageId != solMessageId, "cross-adapter message collision");
    }

    function testDirectCallsCannotBypassEitherRouter() public {
        ethVerifier.set(_ethTransfer(keccak256("direct-eth")));
        solVerifier.set(_solTransfer(keccak256("direct-sol")));

        (bool ethOk,) = address(ethAdapter).call(abi.encodeWithSelector(ethAdapter.verifyInbound.selector, hex"01"));
        (bool solOk,) = address(solAdapter).call(abi.encodeWithSelector(solAdapter.verifyInbound.selector, hex"02"));
        require(!ethOk, "eth router bypass");
        require(!solOk, "sol router bypass");
    }

    function testUnknownAssetsFailClosedOnOutbound() public {
        bytes32 unknownAsset = keccak256("420/BRIDGE/ASSET/UNKNOWN");
        (bool ethOk,) = address(router).call(
            abi.encodeCall(
                router.ethOutbound,
                (ethAdapter, ETH_ROUTE, unknownAsset, address(this), abi.encodePacked(address(0xCAFE)), 1)
            )
        );
        (bool solOk,) = address(router).call(
            abi.encodeCall(
                router.solOutbound,
                (solAdapter, SOL_ROUTE, unknownAsset, address(this), abi.encodePacked(bytes32(uint256(0xCAFE))), 1)
            )
        );
        require(!ethOk, "unknown eth asset accepted");
        require(!solOk, "unknown sol asset accepted");
    }

    function testWrongRoutesFailClosedOnOutbound() public {
        (bool ethOk,) = address(router).call(
            abi.encodeCall(
                router.ethOutbound,
                (ethAdapter, SOL_ROUTE, ASSET, address(this), abi.encodePacked(address(0xCAFE)), 1)
            )
        );
        (bool solOk,) = address(router).call(
            abi.encodeCall(
                router.solOutbound,
                (solAdapter, ETH_ROUTE, ASSET, address(this), abi.encodePacked(bytes32(uint256(0xCAFE))), 1)
            )
        );
        require(!ethOk, "cross-route eth accepted");
        require(!solOk, "cross-route sol accepted");
    }

    function testRebindingClearsStaleSourcesOnBothAdapters() public {
        bytes32 replacementEthSource = ethAdapter.sourceAssetKey(address(0xE421));
        bytes32 oldEthSource = ethAdapter.sourceAssetKey(ETH_TOKEN);
        ethAdapter.setAssetMapping(replacementEthSource, ASSET, true);
        require(ethAdapter.assetIdBySourceAsset(oldEthSource) == bytes32(0), "stale eth source");
        require(ethAdapter.sourceAssetByAssetId(ASSET) == replacementEthSource, "eth replacement missing");

        bytes32 replacementSolMint = keccak256("420/BRIDGE/SOLANA/HARDENING/REPLACEMENT");
        solAdapter.setAssetMapping(replacementSolMint, ASSET, true);
        require(solAdapter.assetIdBySourceAsset(SOL_MINT) == bytes32(0), "stale sol source");
        require(solAdapter.sourceAssetByAssetId(ASSET) == replacementSolMint, "sol replacement missing");
    }

    function _ethTransfer(bytes32 messageId)
        private view returns (IEthereumFinalityVerifier420.FinalizedTransfer memory p)
    {
        p = IEthereumFinalityVerifier420.FinalizedTransfer({
            sourceChainId: ethAdapter.ETHEREUM_MAINNET_CHAIN_ID(),
            blockNumber: 22_000_000,
            blockHash: keccak256("cross-adapter-eth-block"),
            receiptsRoot: keccak256("cross-adapter-eth-receipts"),
            transactionHash: keccak256(abi.encode("cross-adapter-eth-tx", messageId)),
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
            slot: 250_000_000,
            transactionSignature: keccak256(abi.encode("cross-adapter-sol-tx", messageId)),
            messageId: messageId,
            gatewayProgram: SOL_GATEWAY_PROGRAM,
            sourceAsset: SOL_MINT,
            sourceOwner: SOL_OWNER,
            recipient: address(0xB0B),
            amount: 420_000_000,
            finalized: true
        });
    }
}
