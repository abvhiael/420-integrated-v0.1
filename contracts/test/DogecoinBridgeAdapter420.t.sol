// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/DogecoinBridgeAdapter420.sol";
import "../src/interfaces/IDogecoinFinalityVerifier420.sol";

contract DogecoinFinalityVerifierMock420 is IDogecoinFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata transfer_) external { nextTransfer = transfer_; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract DogecoinRouterCaller420 {
    function inbound(DogecoinBridgeAdapter420 adapter, bytes calldata proof)
        external returns (IBridgeAdapter420.VerifiedTransfer memory)
    { return adapter.verifyInbound(proof); }

    function outbound(
        DogecoinBridgeAdapter420 adapter,
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

contract DogecoinBridgeAdapter420Test {
    bytes32 private constant ROUTE = keccak256("420/BRIDGE/ROUTE/DOGE/MAINNET");
    bytes32 private constant DOGE_ASSET = keccak256("420/BRIDGE/ASSET/DOGE");
    bytes32 private constant SCRIPT = keccak256("dogecoin/gateway/script/v1");
    bytes32 private constant OUTPOINT = keccak256("dogecoin/outpoint/1");

    DogecoinFinalityVerifierMock420 private verifier;
    DogecoinRouterCaller420 private router;
    DogecoinBridgeAdapter420 private adapter;

    constructor() {
        verifier = new DogecoinFinalityVerifierMock420();
        router = new DogecoinRouterCaller420();
        adapter = new DogecoinBridgeAdapter420(address(this), address(router), address(verifier));
        adapter.setGatewayScript(SCRIPT, true);
        adapter.setDogeBinding(DOGE_ASSET, ROUTE);
        verifier.set(_healthy(keccak256("doge-message-1"), OUTPOINT));
    }

    function testCanonicalDogecoinInboundPasses() public {
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, hex"01");
        require(v.routeId == ROUTE, "route");
        require(v.assetId == DOGE_ASSET, "asset");
        require(v.recipient == address(0xB0B), "recipient");
        require(v.amount == 42_00000000, "amount");
    }

    function testWrongGenesisFailsClosed() public {
        IDogecoinFinalityVerifier420.FinalizedTransfer memory p = _healthy(keccak256("wrong-genesis"), keccak256("out-2"));
        p.genesisHash = keccak256("wrong");
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "wrong genesis accepted");
    }

    function testWrongMessageStartFailsClosed() public {
        IDogecoinFinalityVerifier420.FinalizedTransfer memory p = _healthy(keccak256("wrong-magic"), keccak256("out-3"));
        p.messageStart = 0xfcc1b7dc;
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "wrong magic accepted");
    }

    function testUnfinalizedFailsClosed() public {
        IDogecoinFinalityVerifier420.FinalizedTransfer memory p = _healthy(keccak256("unfinalized"), keccak256("out-4"));
        p.finalized = false;
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "unfinalized accepted");
    }

    function testWrongGatewayScriptFailsClosed() public {
        IDogecoinFinalityVerifier420.FinalizedTransfer memory p = _healthy(keccak256("wrong-script"), keccak256("out-5"));
        p.gatewayScriptHash = keccak256("bad-script");
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "script accepted");
    }

    function testMessageReplayFailsClosed() public {
        bytes32 messageId = keccak256("replay-message");
        verifier.set(_healthy(messageId, keccak256("out-6")));
        router.inbound(adapter, hex"01");
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "message replay accepted");
    }

    function testSourceOutputReplayFailsClosed() public {
        bytes32 outpoint = keccak256("shared-outpoint");
        verifier.set(_healthy(keccak256("message-a"), outpoint));
        router.inbound(adapter, hex"01");
        verifier.set(_healthy(keccak256("message-b"), outpoint));
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "outpoint replay accepted");
    }

    function testDirectInboundBypassFailsClosed() public {
        (bool ok,) = address(adapter).call(abi.encodeCall(adapter.verifyInbound, (hex"01")));
        require(!ok, "direct inbound accepted");
    }

    function testOutboundP2pkhPasses() public {
        bytes memory recipient = abi.encodePacked(bytes20(uint160(0x1234)));
        bytes32 id = router.outbound(adapter, ROUTE, DOGE_ASSET, address(this), recipient, 10_00000000, hex"00");
        require(id != bytes32(0), "message");
    }

    function testOutboundMalformedRecipientFailsClosed() public {
        (bool ok,) = address(router).call(
            abi.encodeCall(router.outbound, (adapter, ROUTE, DOGE_ASSET, address(this), hex"010203", 1, hex"00"))
        );
        require(!ok, "bad recipient accepted");
    }

    function testOutboundUnsupportedScriptTypeFailsClosed() public {
        bytes memory recipient = abi.encodePacked(bytes20(uint160(0x1234)));
        (bool ok,) = address(router).call(
            abi.encodeCall(router.outbound, (adapter, ROUTE, DOGE_ASSET, address(this), recipient, 1, hex"02"))
        );
        require(!ok, "bad script accepted");
    }

    function _healthy(bytes32 messageId, bytes32 sourceOutput)
        private pure returns (IDogecoinFinalityVerifier420.FinalizedTransfer memory p)
    {
        p = IDogecoinFinalityVerifier420.FinalizedTransfer({
            genesisHash: 0x1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691,
            messageStart: 0xc0c0c0c0,
            blockHeight: 6_000_000,
            blockHash: keccak256(abi.encode("doge-block", messageId)),
            transactionHash: keccak256(abi.encode("doge-tx", messageId)),
            messageId: messageId,
            gatewayScriptHash: SCRIPT,
            sourceOutput: sourceOutput,
            recipient: address(0xB0B),
            amount: 42_00000000,
            finalized: true
        });
    }
}
