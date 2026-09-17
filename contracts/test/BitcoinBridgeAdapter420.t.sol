// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/BitcoinBridgeAdapter420.sol";
import "../src/interfaces/IBitcoinFinalityVerifier420.sol";

contract BitcoinFinalityVerifierMock420 is IBitcoinFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata t) external { nextTransfer = t; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract BitcoinRouterCaller420 {
    function inbound(BitcoinBridgeAdapter420 adapter, bytes calldata proof)
        external returns (IBridgeAdapter420.VerifiedTransfer memory) { return adapter.verifyInbound(proof); }
    function outbound(BitcoinBridgeAdapter420 adapter, bytes32 routeId, bytes32 assetId, address sender,
        bytes calldata recipient, uint256 amount, bytes calldata extra) external returns (bytes32) {
        return adapter.initiateOutbound(routeId, assetId, sender, recipient, amount, extra);
    }
}

contract BitcoinBridgeAdapter420Test {
    bytes32 private constant BTC_ASSET = keccak256("420/BRIDGE/ASSET/BTC");
    bytes32 private constant BTC_ROUTE = keccak256("420/BRIDGE/ROUTE/BTC/BITCOIN/MAINNET");
    bytes32 private constant GENESIS = 0x000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f;

    BitcoinFinalityVerifierMock420 private verifier;
    BitcoinRouterCaller420 private router;
    BitcoinBridgeAdapter420 private adapter;

    constructor() {
        verifier = new BitcoinFinalityVerifierMock420();
        router = new BitcoinRouterCaller420();
        adapter = new BitcoinBridgeAdapter420(address(this), address(router), address(verifier));
        adapter.setBtcBinding(BTC_ASSET, BTC_ROUTE);
        _setTransfer(keccak256("btc-message-1"), 6, true, true, GENESIS, 0xf9beb4d9);
    }

    function testCanonicalBitcoinInboundPasses() public {
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, bytes("proof"));
        require(v.routeId == BTC_ROUTE, "route");
        require(v.assetId == BTC_ASSET, "asset");
        require(v.recipient == address(0xB0B), "recipient");
        require(v.amount == 1_00000000, "amount");
    }

    function testInsufficientConfirmationsRejected() public {
        _setTransfer(keccak256("btc-low-conf"), 5, true, true, GENESIS, 0xf9beb4d9);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, bytes("proof"))));
        require(!ok, "low confirmations accepted");
    }

    function testInvalidPowRejected() public {
        _setTransfer(keccak256("btc-bad-pow"), 6, false, true, GENESIS, 0xf9beb4d9);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, bytes("proof"))));
        require(!ok, "invalid PoW accepted");
    }

    function testInvalidChainworkRejected() public {
        _setTransfer(keccak256("btc-bad-work"), 6, true, false, GENESIS, 0xf9beb4d9);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, bytes("proof"))));
        require(!ok, "invalid chainwork accepted");
    }

    function testWrongNetworkRejected() public {
        _setTransfer(keccak256("btc-wrong-network"), 6, true, true, keccak256("wrong"), 0xf9beb4d9);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, bytes("proof"))));
        require(!ok, "wrong network accepted");
    }

    function testReplayRejected() public {
        _setTransfer(keccak256("btc-replay"), 6, true, true, GENESIS, 0xf9beb4d9);
        router.inbound(adapter, bytes("proof"));
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, bytes("proof"))));
        require(!ok, "replay accepted");
    }

    function testOutboundLegacySegwitAndTaproot() public {
        bytes memory h160 = abi.encodePacked(address(0xCAFE));
        bytes memory h256 = abi.encodePacked(bytes32(uint256(0xCAFE)));
        bytes32 a = router.outbound(adapter, BTC_ROUTE, BTC_ASSET, address(this), h160, 1e8, hex"00");
        bytes32 b = router.outbound(adapter, BTC_ROUTE, BTC_ASSET, address(this), h160, 2e8, hex"02");
        bytes32 c = router.outbound(adapter, BTC_ROUTE, BTC_ASSET, address(this), h256, 3e8, hex"04");
        require(a != bytes32(0) && b != bytes32(0) && c != bytes32(0), "outbound");
        require(a != b && b != c && a != c, "domain separation");
    }

    function _setTransfer(bytes32 messageId, uint32 confirmations, bool pow, bool chainwork,
        bytes32 genesis, bytes4 messageStart) private {
        verifier.set(IBitcoinFinalityVerifier420.FinalizedTransfer({
            genesisHash: genesis,
            messageStart: messageStart,
            blockHeight: 900_000,
            blockHash: keccak256(abi.encode("btc-block", messageId)),
            transactionHash: keccak256(abi.encode("btc-tx", messageId)),
            messageId: messageId,
            sourceOutput: keccak256(abi.encode("btc-out", messageId)),
            recipient: address(0xB0B),
            amountSatoshis: 1_00000000,
            confirmations: confirmations,
            sha256dPowValidated: pow,
            chainWorkValidated: chainwork,
            finalized: true
        }));
    }
}
