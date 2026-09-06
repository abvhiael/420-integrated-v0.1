// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/SolanaBridgeAdapter420.sol";
import "../src/interfaces/ISolanaFinalityVerifier420.sol";

contract SolanaFinalityVerifierMock420 is ISolanaFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata transfer_) external { nextTransfer = transfer_; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract SolanaRouterCaller420 {
    function inbound(SolanaBridgeAdapter420 adapter, bytes calldata proof)
        external
        returns (IBridgeAdapter420.VerifiedTransfer memory)
    {
        return adapter.verifyInbound(proof);
    }

    function outbound(
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

contract SolanaBridgeAdapter420Test {
    bytes32 private constant ROUTE = keccak256("420/BRIDGE/ROUTE/SOL/MAINNET");
    bytes32 private constant SOL_ASSET = keccak256("420/BRIDGE/ASSET/SOL");
    bytes32 private constant SPL_ASSET = keccak256("420/BRIDGE/ASSET/SPL/TEST");
    bytes32 private constant PROGRAM = keccak256("solana/gateway/program/v1");
    bytes32 private constant SPL_MINT = keccak256("solana/spl/test-mint");
    bytes32 private constant OWNER = bytes32(uint256(0xA11CE));

    SolanaFinalityVerifierMock420 private verifier;
    SolanaRouterCaller420 private router;
    SolanaBridgeAdapter420 private adapter;

    constructor() {
        verifier = new SolanaFinalityVerifierMock420();
        router = new SolanaRouterCaller420();
        adapter = new SolanaBridgeAdapter420(address(this), address(router), address(verifier));
        adapter.setGatewayProgram(PROGRAM, true);
        adapter.setAssetMapping(adapter.SOL_NATIVE_SOURCE_ASSET(), SOL_ASSET, true);
        adapter.setRouteBinding(SOL_ASSET, ROUTE);
        _setHealthy(adapter.SOL_NATIVE_SOURCE_ASSET(), keccak256("solana-message-1"));
    }

    function testCanonicalMainnetSolInboundPasses() public {
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, hex"01");
        require(v.routeId == ROUTE, "route");
        require(v.assetId == SOL_ASSET, "asset");
        require(v.sender == address(uint160(uint256(OWNER))), "sender");
        require(v.recipient == address(0xB0B), "recipient");
        require(v.amount == 42 ether, "amount");
        require(adapter.consumedMessages(keccak256("solana-message-1")), "not consumed");
    }

    function testWrongClusterFailsClosed() public {
        ISolanaFinalityVerifier420.FinalizedTransfer memory p = _healthy(
            adapter.SOL_NATIVE_SOURCE_ASSET(), keccak256("wrong-cluster")
        );
        p.genesisHash = keccak256("solana-devnet");
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeWithSelector(router.inbound.selector, adapter, hex"01"));
        require(!ok, "wrong cluster accepted");
    }

    function testUnfinalizedProofFailsClosed() public {
        ISolanaFinalityVerifier420.FinalizedTransfer memory p = _healthy(
            adapter.SOL_NATIVE_SOURCE_ASSET(), keccak256("unfinalized")
        );
        p.finalized = false;
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeWithSelector(router.inbound.selector, adapter, hex"01"));
        require(!ok, "unfinalized accepted");
    }

    function testWrongGatewayProgramFailsClosed() public {
        ISolanaFinalityVerifier420.FinalizedTransfer memory p = _healthy(
            adapter.SOL_NATIVE_SOURCE_ASSET(), keccak256("wrong-program")
        );
        p.gatewayProgram = keccak256("unapproved-program");
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeWithSelector(router.inbound.selector, adapter, hex"01"));
        require(!ok, "wrong program accepted");
    }

    function testUnapprovedSplMintFailsClosed() public {
        _setHealthy(SPL_MINT, keccak256("unknown-spl"));
        (bool ok,) = address(router).call(abi.encodeWithSelector(router.inbound.selector, adapter, hex"01"));
        require(!ok, "unknown mint accepted");
    }

    function testQualifiedSplMintUsesBoundAssetAndRoute() public {
        adapter.setAssetMapping(SPL_MINT, SPL_ASSET, true);
        bytes32 splRoute = keccak256("420/BRIDGE/ROUTE/SPL/TEST");
        adapter.setRouteBinding(SPL_ASSET, splRoute);
        _setHealthy(SPL_MINT, keccak256("qualified-spl"));
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, hex"02");
        require(v.assetId == SPL_ASSET && v.routeId == splRoute, "spl binding");
    }

    function testReplayFailsClosed() public {
        bytes32 messageId = keccak256("replay");
        _setHealthy(adapter.SOL_NATIVE_SOURCE_ASSET(), messageId);
        router.inbound(adapter, hex"01");
        (bool ok,) = address(router).call(abi.encodeWithSelector(router.inbound.selector, adapter, hex"01"));
        require(!ok, "replay accepted");
    }

    function testDirectCallerCannotBypassRouter() public {
        (bool ok,) = address(adapter).call(abi.encodeWithSelector(adapter.verifyInbound.selector, hex"01"));
        require(!ok, "router bypass");
    }

    function testOutboundRequiresExactRouteAndSolanaRecipientWidth() public {
        bytes memory recipient = abi.encodePacked(bytes32(uint256(0xCAFE)));
        bytes32 messageId = router.outbound(adapter, ROUTE, SOL_ASSET, address(0xA11CE), recipient, 5 ether, hex"1234");
        require(messageId != bytes32(0), "message");

        (bool wrongRoute,) = address(router).call(
            abi.encodeWithSelector(
                router.outbound.selector,
                adapter,
                keccak256("wrong-route"),
                SOL_ASSET,
                address(0xA11CE),
                recipient,
                5 ether,
                hex""
            )
        );
        require(!wrongRoute, "wrong route accepted");

        (bool shortRecipient,) = address(router).call(
            abi.encodeWithSelector(
                router.outbound.selector,
                adapter,
                ROUTE,
                SOL_ASSET,
                address(0xA11CE),
                hex"1234",
                5 ether,
                hex""
            )
        );
        require(!shortRecipient, "short recipient accepted");
    }

    function testAssetRebindingClearsPriorSourceMapping() public {
        adapter.setAssetMapping(SPL_MINT, SPL_ASSET, true);
        bytes32 replacementMint = keccak256("solana/spl/replacement");
        adapter.setAssetMapping(replacementMint, SPL_ASSET, true);
        require(adapter.assetIdBySourceAsset(SPL_MINT) == bytes32(0), "stale mint retained");
        require(adapter.sourceAssetByAssetId(SPL_ASSET) == replacementMint, "replacement missing");
    }

    function _setHealthy(bytes32 sourceAsset, bytes32 messageId) private {
        verifier.set(_healthy(sourceAsset, messageId));
    }

    function _healthy(bytes32 sourceAsset, bytes32 messageId)
        private
        view
        returns (ISolanaFinalityVerifier420.FinalizedTransfer memory p)
    {
        p = ISolanaFinalityVerifier420.FinalizedTransfer({
            genesisHash: adapter.SOLANA_MAINNET_GENESIS_HASH(),
            slot: 250_000_000,
            transactionSignature: keccak256(abi.encodePacked("signature", messageId)),
            messageId: messageId,
            gatewayProgram: PROGRAM,
            sourceAsset: sourceAsset,
            sourceOwner: OWNER,
            recipient: address(0xB0B),
            amount: 42 ether,
            finalized: true
        });
    }
}
