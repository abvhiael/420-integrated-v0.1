// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/LitecoinBridgeAdapter420.sol";
import "../src/interfaces/ILitecoinFinalityVerifier420.sol";

contract LitecoinFinalityVerifierMock420 is ILitecoinFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata t) external { nextTransfer = t; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract LitecoinRouterCaller420 {
    function inbound(LitecoinBridgeAdapter420 adapter, bytes calldata proof)
        external returns (IBridgeAdapter420.VerifiedTransfer memory) { return adapter.verifyInbound(proof); }
    function outbound(LitecoinBridgeAdapter420 adapter, bytes32 routeId, bytes32 assetId, address sender,
        bytes calldata recipient, uint256 amount, bytes calldata extra) external returns (bytes32) {
        return adapter.initiateOutbound(routeId, assetId, sender, recipient, amount, extra);
    }
}

contract LitecoinBridgeAdapter420Test {
    bytes32 private constant LTC_ASSET = keccak256("420/BRIDGE/ASSET/LTC");
    bytes32 private constant LTC_ROUTE = keccak256("420/BRIDGE/ROUTE/LTC/LITECOIN/MAINNET");
    bytes32 private constant GENESIS = 0x12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2;

    LitecoinFinalityVerifierMock420 private verifier;
    LitecoinRouterCaller420 private router;
    LitecoinBridgeAdapter420 private adapter;

    constructor() {
        verifier = new LitecoinFinalityVerifierMock420();
        router = new LitecoinRouterCaller420();
        adapter = new LitecoinBridgeAdapter420(address(this), address(router), address(verifier));
        adapter.setLtcBinding(LTC_ASSET, LTC_ROUTE);
        _setTransfer(keccak256("ltc-message-1"), 12, true, true, false, GENESIS, 0xfbc0b6db);
    }

    function testCanonicalLitecoinInboundPasses() public {
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, bytes("proof"));
        require(v.routeId == LTC_ROUTE, "route");
        require(v.assetId == LTC_ASSET, "asset");
        require(v.recipient == address(0xB0B), "recipient");
        require(v.amount == 42_00000000, "amount");
    }

    function testInsufficientConfirmationsRejected() public {
        _setTransfer(keccak256("ltc-low-conf"), 11, true, true, false, GENESIS, 0xfbc0b6db);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, bytes("proof"))));
        require(!ok, "low confirmations accepted");
    }

    function testInvalidPowRejected() public {
        _setTransfer(keccak256("ltc-bad-pow"), 12, false, true, false, GENESIS, 0xfbc0b6db);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, bytes("proof"))));
        require(!ok, "invalid PoW accepted");
    }

    function testMwebRejected() public {
        _setTransfer(keccak256("ltc-mweb"), 12, true, true, true, GENESIS, 0xfbc0b6db);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, bytes("proof"))));
        require(!ok, "MWEB accepted");
    }

    function testWrongNetworkRejected() public {
        _setTransfer(keccak256("ltc-wrong-network"), 12, true, true, false, keccak256("wrong"), 0xfbc0b6db);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, bytes("proof"))));
        require(!ok, "wrong network accepted");
    }

    function testReplayRejected() public {
        _setTransfer(keccak256("ltc-replay"), 12, true, true, false, GENESIS, 0xfbc0b6db);
        router.inbound(adapter, bytes("proof"));
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, bytes("proof"))));
        require(!ok, "replay accepted");
    }

    function testOutboundLegacySegwitAndTaproot() public {
        bytes memory h160 = abi.encodePacked(address(0xCAFE));
        bytes memory h256 = abi.encodePacked(bytes32(uint256(0xCAFE)));
        bytes32 a = router.outbound(adapter, LTC_ROUTE, LTC_ASSET, address(this), h160, 1e8, hex"00");
        bytes32 b = router.outbound(adapter, LTC_ROUTE, LTC_ASSET, address(this), h160, 2e8, hex"02");
        bytes32 c = router.outbound(adapter, LTC_ROUTE, LTC_ASSET, address(this), h256, 3e8, hex"04");
        require(a != bytes32(0) && b != bytes32(0) && c != bytes32(0), "outbound");
        require(a != b && b != c && a != c, "domain separation");
    }

    function _setTransfer(bytes32 messageId, uint32 confirmations, bool pow, bool chainwork, bool mweb,
        bytes32 genesis, bytes4 messageStart) private {
        verifier.set(ILitecoinFinalityVerifier420.FinalizedTransfer({
            genesisHash: genesis,
            messageStart: messageStart,
            blockHeight: 3_500_000,
            blockHash: keccak256(abi.encode("ltc-block", messageId)),
            transactionHash: keccak256(abi.encode("ltc-tx", messageId)),
            messageId: messageId,
            sourceOutput: keccak256(abi.encode("ltc-out", messageId)),
            recipient: address(0xB0B),
            amountLitoshis: 42_00000000,
            confirmations: confirmations,
            scryptPowValidated: pow,
            chainWorkValidated: chainwork,
            mweb: mweb,
            finalized: true
        }));
    }
}
