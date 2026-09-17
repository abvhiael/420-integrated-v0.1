// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/SolanaBridgeAdapter420.sol";
import "../src/interfaces/ISolanaFinalityVerifier420.sol";

contract RaySolanaFinalityVerifierMock420 is ISolanaFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata transfer_) external { nextTransfer = transfer_; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract RaySolanaRouterCaller420 {
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

/// @notice V12.5.23 qualification: RAY is the canonical Raydium SPL asset over the existing SOL adapter.
contract RaySolanaBridgeAdapter420Test {
    bytes32 private constant RAY_SOLANA_MINT =
        0x37998ccbf2d0458b615cbcc6b1a367c4749e9fef7306622e1b1b58910120bc9a;
    bytes32 private constant GATEWAY_PROGRAM = keccak256("420/BRIDGE/GATEWAY/RAY/SOLANA/V1");
    bytes32 private constant RAY_ASSET = keccak256("420/BRIDGE/ASSET/RAY");
    bytes32 private constant RAY_ROUTE = keccak256("420/BRIDGE/ROUTE/RAY/SOLANA/MAINNET");
    bytes32 private constant OWNER = bytes32(uint256(0xA11CE));
    uint256 private constant ONE_RAY = 1_000_000;

    RaySolanaFinalityVerifierMock420 private verifier;
    RaySolanaRouterCaller420 private router;
    SolanaBridgeAdapter420 private adapter;

    constructor() {
        verifier = new RaySolanaFinalityVerifierMock420();
        router = new RaySolanaRouterCaller420();
        adapter = new SolanaBridgeAdapter420(address(this), address(router), address(verifier));

        adapter.setGatewayProgram(GATEWAY_PROGRAM, true);
        adapter.setAssetMapping(RAY_SOLANA_MINT, RAY_ASSET, true);
        adapter.setRouteBinding(RAY_ASSET, RAY_ROUTE);
        _setHealthy(RAY_SOLANA_MINT, keccak256("ray-solana-message-1"));
    }

    function testCanonicalRaySolanaInboundPasses() public {
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, hex"01");
        require(v.routeId == RAY_ROUTE, "route");
        require(v.assetId == RAY_ASSET, "asset");
        require(v.sender == address(uint160(uint256(OWNER))), "sender");
        require(v.recipient == address(0xB0B), "recipient");
        require(v.amount == 420 * ONE_RAY, "amount");
    }

    function testWrongRaySolanaMintRejected() public {
        _setHealthy(keccak256("wrong-ray-mint"), keccak256("wrong-ray-mint-message"));
        (bool ok,) = address(router).call(abi.encodeWithSelector(router.inbound.selector, adapter, hex"01"));
        require(!ok, "wrong RAY mint accepted");
    }

    function testWrongSolanaClusterRejected() public {
        ISolanaFinalityVerifier420.FinalizedTransfer memory p = _healthy(
            RAY_SOLANA_MINT, keccak256("wrong-cluster")
        );
        p.genesisHash = keccak256("solana-devnet");
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeWithSelector(router.inbound.selector, adapter, hex"01"));
        require(!ok, "wrong cluster accepted");
    }

    function testRaySolanaReplayRejected() public {
        bytes32 messageId = keccak256("ray-solana-replay");
        _setHealthy(RAY_SOLANA_MINT, messageId);
        router.inbound(adapter, hex"01");
        (bool ok,) = address(router).call(abi.encodeWithSelector(router.inbound.selector, adapter, hex"01"));
        require(!ok, "RAY replay accepted");
    }

    function testRaySolanaOutboundUsesBoundRoute() public {
        bytes memory recipient = abi.encodePacked(bytes32(uint256(0xCAFE)));
        bytes32 messageId = router.outbound(adapter, RAY_ROUTE, RAY_ASSET, address(this), recipient, 42 * ONE_RAY);
        require(messageId != bytes32(0), "message");
    }

    function testRaySolanaDifferentRouteRejected() public {
        bytes memory recipient = abi.encodePacked(bytes32(uint256(0xCAFE)));
        (bool ok,) = address(router).call(
            abi.encodeCall(
                router.outbound,
                (adapter, keccak256("420/BRIDGE/ROUTE/RAY/SOLANA/WRONG"), RAY_ASSET, address(this), recipient, 42 * ONE_RAY)
            )
        );
        require(!ok, "wrong RAY Solana route accepted");
    }

    function testRaySolanaRejectsShortRecipient() public {
        (bool ok,) = address(router).call(
            abi.encodeCall(router.outbound, (adapter, RAY_ROUTE, RAY_ASSET, address(this), hex"1234", 42 * ONE_RAY))
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
            transactionSignature: keccak256(abi.encodePacked("ray-signature", messageId)),
            messageId: messageId,
            gatewayProgram: GATEWAY_PROGRAM,
            sourceAsset: sourceAsset,
            sourceOwner: OWNER,
            recipient: address(0xB0B),
            amount: 420 * ONE_RAY,
            finalized: true
        });
    }
}
