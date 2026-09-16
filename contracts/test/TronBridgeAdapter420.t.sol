// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/TronBridgeAdapter420.sol";
import "../src/interfaces/ITronFinalityVerifier420.sol";

contract TronFinalityVerifierMock420 is ITronFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;

    function set(FinalizedTransfer calldata transfer_) external { nextTransfer = transfer_; }

    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) {
        return nextTransfer;
    }
}

contract TronRouterCaller420 {
    function inbound(TronBridgeAdapter420 adapter, bytes calldata proof)
        external returns (IBridgeAdapter420.VerifiedTransfer memory)
    {
        return adapter.verifyInbound(proof);
    }

    function outbound(
        TronBridgeAdapter420 adapter,
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

contract TronBridgeAdapter420Test {
    bytes32 private constant ROUTE = keccak256("420/BRIDGE/ROUTE/TRX/MAINNET");
    bytes32 private constant TRX_ASSET = keccak256("420/BRIDGE/ASSET/TRX");
    bytes20 private constant GATEWAY = bytes20(uint160(0x420420));
    bytes20 private constant SOURCE = bytes20(uint160(0x123456));

    TronFinalityVerifierMock420 private verifier;
    TronRouterCaller420 private router;
    TronBridgeAdapter420 private adapter;

    constructor() {
        verifier = new TronFinalityVerifierMock420();
        router = new TronRouterCaller420();
        adapter = new TronBridgeAdapter420(address(this), address(router), address(verifier));
        adapter.setGatewayAccount(GATEWAY, true);
        adapter.setTrxBinding(TRX_ASSET, ROUTE);
        verifier.set(_healthy(keccak256("tron-message-1"), keccak256("tron-tx-1")));
    }

    function testCanonicalTronInboundPasses() public {
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, hex"01");
        require(v.routeId == ROUTE, "route");
        require(v.assetId == TRX_ASSET, "asset");
        require(v.sender == address(SOURCE), "sender");
        require(v.recipient == address(0xB0B), "recipient");
        require(v.amount == 42_000_000, "amount");
    }

    function testWrongNetworkFailsClosed() public {
        ITronFinalityVerifier420.FinalizedTransfer memory p =
            _healthy(keccak256("wrong-network"), keccak256("tron-tx-2"));
        p.networkId = keccak256("TRON/NILE");
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "wrong network accepted");
    }

    function testUnsolidifiedFailsClosed() public {
        ITronFinalityVerifier420.FinalizedTransfer memory p =
            _healthy(keccak256("unsolidified"), keccak256("tron-tx-3"));
        p.solidified = false;
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "unsolidified accepted");
    }

    function testFailedExecutionFailsClosed() public {
        ITronFinalityVerifier420.FinalizedTransfer memory p =
            _healthy(keccak256("failed-execution"), keccak256("tron-tx-4"));
        p.executionSuccess = false;
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "failed execution accepted");
    }

    function testWrongGatewayFailsClosed() public {
        ITronFinalityVerifier420.FinalizedTransfer memory p =
            _healthy(keccak256("wrong-gateway"), keccak256("tron-tx-5"));
        p.gatewayAccount = bytes20(uint160(0xDEAD));
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "wrong gateway accepted");
    }

    function testMessageReplayFailsClosed() public {
        bytes32 messageId = keccak256("replay-message");
        verifier.set(_healthy(messageId, keccak256("tron-tx-6")));
        router.inbound(adapter, hex"01");
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "message replay accepted");
    }

    function testTransactionReplayFailsClosed() public {
        bytes32 txHash = keccak256("shared-tron-tx");
        verifier.set(_healthy(keccak256("message-a"), txHash));
        router.inbound(adapter, hex"01");
        verifier.set(_healthy(keccak256("message-b"), txHash));
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "transaction replay accepted");
    }

    function testDirectInboundBypassFailsClosed() public {
        (bool ok,) = address(adapter).call(abi.encodeCall(adapter.verifyInbound, (hex"01")));
        require(!ok, "direct inbound accepted");
    }

    function testOutboundCanonicalHexAddressPasses() public {
        bytes memory recipient = abi.encodePacked(bytes1(0x41), bytes20(uint160(0x987654)));
        bytes32 id = router.outbound(adapter, ROUTE, TRX_ASSET, address(this), recipient, 10_000_000, hex"");
        require(id != bytes32(0), "message");
    }

    function testOutboundWrongPrefixFailsClosed() public {
        bytes memory recipient = abi.encodePacked(bytes1(0x42), bytes20(uint160(0x987654)));
        (bool ok,) = address(router).call(
            abi.encodeCall(router.outbound, (adapter, ROUTE, TRX_ASSET, address(this), recipient, 1, hex""))
        );
        require(!ok, "wrong prefix accepted");
    }

    function testOutboundMalformedRecipientFailsClosed() public {
        (bool ok,) = address(router).call(
            abi.encodeCall(router.outbound, (adapter, ROUTE, TRX_ASSET, address(this), hex"4101", 1, hex""))
        );
        require(!ok, "malformed recipient accepted");
    }

    function testOutboundExtraDataFailsClosed() public {
        bytes memory recipient = abi.encodePacked(bytes1(0x41), bytes20(uint160(0x987654)));
        (bool ok,) = address(router).call(
            abi.encodeCall(router.outbound, (adapter, ROUTE, TRX_ASSET, address(this), recipient, 1, hex"01"))
        );
        require(!ok, "extra data accepted");
    }

    function _healthy(bytes32 messageId, bytes32 txHash)
        private pure returns (ITronFinalityVerifier420.FinalizedTransfer memory p)
    {
        p = ITronFinalityVerifier420.FinalizedTransfer({
            networkId: keccak256("TRON/MAINNET"),
            blockNumber: 76_000_000,
            blockHash: keccak256(abi.encode("tron-block", messageId)),
            transactionHash: txHash,
            messageId: messageId,
            gatewayAccount: GATEWAY,
            sourceAccount: SOURCE,
            recipient: address(0xB0B),
            amountSun: 42_000_000,
            solidified: true,
            executionSuccess: true
        });
    }
}
