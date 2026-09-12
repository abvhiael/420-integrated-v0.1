// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/XrplBridgeAdapter420.sol";
import "../src/interfaces/IXrplFinalityVerifier420.sol";

contract XrplFinalityVerifierMock420 is IXrplFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata transfer_) external { nextTransfer = transfer_; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract XrplRouterCaller420 {
    function inbound(XrplBridgeAdapter420 adapter, bytes calldata proof)
        external
        returns (IBridgeAdapter420.VerifiedTransfer memory)
    { return adapter.verifyInbound(proof); }

    function outbound(
        XrplBridgeAdapter420 adapter,
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

contract XrplBridgeAdapter420Test {
    bytes32 private constant ROUTE = keccak256("420/BRIDGE/ROUTE/XRP/MAINNET");
    bytes32 private constant XRP_ASSET = keccak256("420/BRIDGE/ASSET/XRP");
    bytes20 private constant GATEWAY = bytes20(uint160(0x420420));
    bytes20 private constant SOURCE = bytes20(uint160(0xA11CE));

    XrplFinalityVerifierMock420 private verifier;
    XrplRouterCaller420 private router;
    XrplBridgeAdapter420 private adapter;

    constructor() {
        verifier = new XrplFinalityVerifierMock420();
        router = new XrplRouterCaller420();
        adapter = new XrplBridgeAdapter420(address(this), address(router), address(verifier));
        adapter.setGatewayAccount(GATEWAY, true);
        adapter.setXrpBinding(XRP_ASSET, ROUTE);
        _setHealthy(keccak256("xrp-message-1"), keccak256("xrp-tx-1"));
    }

    function testValidatedSuccessfulInboundPasses() public {
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, hex"01");
        require(v.routeId == ROUTE, "route");
        require(v.assetId == XRP_ASSET, "asset");
        require(v.sender == address(uint160(SOURCE)), "sender");
        require(v.recipient == address(0xB0B), "recipient");
        require(v.amount == 42_000_000, "drops");
    }

    function testUnvalidatedLedgerFailsClosed() public {
        IXrplFinalityVerifier420.FinalizedTransfer memory p = _healthy(keccak256("unvalidated"), keccak256("tx-u"));
        p.validated = false;
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "unvalidated accepted");
    }

    function testFailedTransactionFailsClosed() public {
        IXrplFinalityVerifier420.FinalizedTransfer memory p = _healthy(keccak256("failed"), keccak256("tx-f"));
        p.tesSuccess = false;
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "failed txn accepted");
    }

    function testWrongGatewayFailsClosed() public {
        IXrplFinalityVerifier420.FinalizedTransfer memory p = _healthy(keccak256("wrong-gateway"), keccak256("tx-g"));
        p.gatewayAccount = bytes20(uint160(0xBAD));
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "gateway accepted");
    }

    function testMessageReplayFailsClosed() public {
        _setHealthy(keccak256("message-replay"), keccak256("tx-r1"));
        router.inbound(adapter, hex"01");
        _setHealthy(keccak256("message-replay"), keccak256("tx-r2"));
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "message replay accepted");
    }

    function testTransactionReplayFailsClosedAcrossMessageIds() public {
        _setHealthy(keccak256("msg-a"), keccak256("same-tx"));
        router.inbound(adapter, hex"01");
        _setHealthy(keccak256("msg-b"), keccak256("same-tx"));
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "tx replay accepted");
    }

    function testDirectAdapterBypassFailsClosed() public {
        (bool ok,) = address(adapter).call(abi.encodeCall(adapter.verifyInbound, (hex"01")));
        require(!ok, "direct accepted");
    }

    function testOutboundWithoutTagPasses() public {
        bytes memory recipient = abi.encodePacked(bytes20(uint160(0x1234)), uint8(0), uint32(0));
        bytes32 id = router.outbound(adapter, ROUTE, XRP_ASSET, address(this), recipient, 1_000_000, bytes(""));
        require(id != bytes32(0), "message");
    }

    function testOutboundWithTagPasses() public {
        bytes memory recipient = abi.encodePacked(bytes20(uint160(0x1234)), uint8(1), uint32(420));
        bytes32 id = router.outbound(adapter, ROUTE, XRP_ASSET, address(this), recipient, 1_000_000, bytes(""));
        require(id != bytes32(0), "message");
    }

    function testMalformedOutboundTagFailsClosed() public {
        bytes memory recipient = abi.encodePacked(bytes20(uint160(0x1234)), uint8(0), uint32(420));
        (bool ok,) = address(router).call(
            abi.encodeCall(router.outbound, (adapter, ROUTE, XRP_ASSET, address(this), recipient, 1_000_000, bytes("")))
        );
        require(!ok, "tag accepted");
    }

    function _setHealthy(bytes32 messageId, bytes32 transactionHash) private {
        verifier.set(_healthy(messageId, transactionHash));
    }

    function _healthy(bytes32 messageId, bytes32 transactionHash)
        private
        pure
        returns (IXrplFinalityVerifier420.FinalizedTransfer memory p)
    {
        p = IXrplFinalityVerifier420.FinalizedTransfer({
            ledgerIndex: 100_000_000,
            ledgerHash: keccak256("validated-ledger"),
            transactionRoot: keccak256("transaction-root"),
            transactionHash: transactionHash,
            messageId: messageId,
            gatewayAccount: GATEWAY,
            sourceAccount: SOURCE,
            recipient: address(0xB0B),
            amountDrops: 42_000_000,
            destinationTag: 420,
            hasDestinationTag: true,
            validated: true,
            tesSuccess: true
        });
    }
}
