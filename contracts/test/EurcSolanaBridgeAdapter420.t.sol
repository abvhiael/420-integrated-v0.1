// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/SolanaBridgeAdapter420.sol";
import "../src/interfaces/ISolanaFinalityVerifier420.sol";

contract EurcSolanaFinalityVerifierMock420 is ISolanaFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata transfer_) external { nextTransfer = transfer_; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract EurcSolanaRouterCaller420 {
    function inbound(SolanaBridgeAdapter420 adapter, bytes calldata proof)
        external returns (IBridgeAdapter420.VerifiedTransfer memory)
    {
        return adapter.verifyInbound(proof);
    }

    function outbound(
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

/// @notice V12.5.22 qualification: Circle EURC is the canonical Solana SPL asset over the existing SOL adapter.
contract EurcSolanaBridgeAdapter420Test {
    bytes32 private constant EURC_SOLANA_MINT =
        0xfc931a2b58cd23db2d91d296d96505a06f80942083f841e8a887f138ac030437;
    bytes32 private constant GATEWAY_PROGRAM = keccak256("420/BRIDGE/GATEWAY/EURC/SOLANA/V1");
    bytes32 private constant EURC_ASSET = keccak256("420/BRIDGE/ASSET/EURC");
    bytes32 private constant EURC_ROUTE = keccak256("420/BRIDGE/ROUTE/EURC/SOLANA/MAINNET");
    bytes32 private constant OWNER = bytes32(uint256(0xA11CE));
    uint256 private constant ONE_EURC = 1_000_000;

    EurcSolanaFinalityVerifierMock420 private verifier;
    EurcSolanaRouterCaller420 private router;
    SolanaBridgeAdapter420 private adapter;

    constructor() {
        verifier = new EurcSolanaFinalityVerifierMock420();
        router = new EurcSolanaRouterCaller420();
        adapter = new SolanaBridgeAdapter420(address(this), address(router), address(verifier));

        adapter.setGatewayProgram(GATEWAY_PROGRAM, true);
        adapter.setAssetMapping(EURC_SOLANA_MINT, EURC_ASSET, true);
        adapter.setRouteBinding(EURC_ASSET, EURC_ROUTE);
        _setHealthy(EURC_SOLANA_MINT, keccak256("eurc-solana-message-1"));
    }

    function testCanonicalEurcSolanaInboundPasses() public {
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, hex"01");
        require(v.routeId == EURC_ROUTE, "route");
        require(v.assetId == EURC_ASSET, "asset");
        require(v.sender == address(uint160(uint256(OWNER))), "sender");
        require(v.recipient == address(0xB0B), "recipient");
        require(v.amount == 420 * ONE_EURC, "amount");
    }

    function testWrongEurcSolanaMintRejected() public {
        _setHealthy(keccak256("wrong-eurc-mint"), keccak256("wrong-eurc-mint-message"));
        (bool ok,) = address(router).call(abi.encodeWithSelector(router.inbound.selector, adapter, hex"01"));
        require(!ok, "wrong EURC mint accepted");
    }

    function testWrongSolanaClusterRejected() public {
        ISolanaFinalityVerifier420.FinalizedTransfer memory p = _healthy(
            EURC_SOLANA_MINT, keccak256("wrong-cluster")
        );
        p.genesisHash = keccak256("solana-devnet");
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeWithSelector(router.inbound.selector, adapter, hex"01"));
        require(!ok, "wrong cluster accepted");
    }

    function testEurcSolanaReplayRejected() public {
        bytes32 messageId = keccak256("eurc-solana-replay");
        _setHealthy(EURC_SOLANA_MINT, messageId);
        router.inbound(adapter, hex"01");
        (bool ok,) = address(router).call(abi.encodeWithSelector(router.inbound.selector, adapter, hex"01"));
        require(!ok, "EURC replay accepted");
    }

    function testEurcSolanaOutboundUsesBoundRoute() public {
        bytes memory recipient = abi.encodePacked(bytes32(uint256(0xCAFE)));
        bytes32 messageId = router.outbound(adapter, EURC_ROUTE, EURC_ASSET, address(this), recipient, 42 * ONE_EURC);
        require(messageId != bytes32(0), "message");
    }

    function testEurcSolanaDifferentRouteRejected() public {
        bytes memory recipient = abi.encodePacked(bytes32(uint256(0xCAFE)));
        (bool ok,) = address(router).call(
            abi.encodeCall(
                router.outbound,
                (adapter, keccak256("420/BRIDGE/ROUTE/EURC/SOLANA/WRONG"), EURC_ASSET, address(this), recipient, 42 * ONE_EURC)
            )
        );
        require(!ok, "wrong EURC Solana route accepted");
    }

    function testEurcSolanaRejectsShortRecipient() public {
        (bool ok,) = address(router).call(
            abi.encodeCall(router.outbound, (adapter, EURC_ROUTE, EURC_ASSET, address(this), hex"1234", 42 * ONE_EURC))
        );
        require(!ok, "short Solana recipient accepted");
    }

    function _setHealthy(bytes32 sourceAsset, bytes32 messageId) private {
        verifier.set(_healthy(sourceAsset, messageId));
    }

    function _healthy(bytes32 sourceAsset, bytes32 messageId)
        private view returns (ISolanaFinalityVerifier420.FinalizedTransfer memory p)
    {
        p = ISolanaFinalityVerifier420.FinalizedTransfer({
            genesisHash: adapter.SOLANA_MAINNET_GENESIS_HASH(),
            slot: 250_000_000,
            transactionSignature: keccak256(abi.encodePacked("eurc-signature", messageId)),
            messageId: messageId,
            gatewayProgram: GATEWAY_PROGRAM,
            sourceAsset: sourceAsset,
            sourceOwner: OWNER,
            recipient: address(0xB0B),
            amount: 420 * ONE_EURC,
            finalized: true
        });
    }
}
