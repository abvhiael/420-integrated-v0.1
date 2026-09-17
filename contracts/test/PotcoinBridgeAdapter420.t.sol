// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/PotcoinBridgeAdapter420.sol";
import "../src/interfaces/IPotcoinFinalityVerifier420.sol";

contract PotcoinFinalityVerifierMock420 is IPotcoinFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;

    function set(FinalizedTransfer calldata transfer_) external { nextTransfer = transfer_; }

    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) {
        return nextTransfer;
    }
}

contract PotcoinRouterCaller420 {
    function inbound(PotcoinBridgeAdapter420 adapter, bytes calldata proof)
        external returns (IBridgeAdapter420.VerifiedTransfer memory)
    {
        return adapter.verifyInbound(proof);
    }

    function outbound(
        PotcoinBridgeAdapter420 adapter,
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

contract PotcoinBridgeAdapter420Test {
    bytes32 private constant ROUTE = keccak256("420/BRIDGE/ROUTE/POT/MAINNET");
    bytes32 private constant POT_ASSET = keccak256("420/BRIDGE/ASSET/POT");
    bytes32 private constant GATEWAY = keccak256("420/POT/GATEWAY/SCRIPT/V1");

    PotcoinFinalityVerifierMock420 private verifier;
    PotcoinRouterCaller420 private router;
    PotcoinBridgeAdapter420 private adapter;

    constructor() {
        verifier = new PotcoinFinalityVerifierMock420();
        router = new PotcoinRouterCaller420();
        adapter = new PotcoinBridgeAdapter420(address(this), address(router), address(verifier));
        adapter.setGatewayScript(GATEWAY, true);
        adapter.setPotBinding(POT_ASSET, ROUTE);
        verifier.set(_healthy(keccak256("pot-message-1"), keccak256("pot-output-1")));
    }

    function testCanonicalPotcoinInboundPasses() public {
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, hex"01");
        require(v.routeId == ROUTE, "route");
        require(v.assetId == POT_ASSET, "asset");
        require(v.recipient == address(0xB0B), "recipient");
        require(v.amount == 42_00000000, "amount");
    }

    function testBootstrapPowBlockRejected() public {
        IPotcoinFinalityVerifier420.FinalizedTransfer memory p =
            _healthy(keccak256("bootstrap"), keccak256("pot-output-2"));
        p.blockHeight = 500;
        p.proofOfStake = false;
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "bootstrap block accepted");
    }

    function testPostBootstrapNonPosRejected() public {
        IPotcoinFinalityVerifier420.FinalizedTransfer memory p =
            _healthy(keccak256("not-pos"), keccak256("pot-output-3"));
        p.proofOfStake = false;
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "non-PoS block accepted");
    }

    function testUnfinalizedPotcoinTransferRejected() public {
        IPotcoinFinalityVerifier420.FinalizedTransfer memory p =
            _healthy(keccak256("unfinalized"), keccak256("pot-output-4"));
        p.finalized = false;
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "unfinalized transfer accepted");
    }

    function testWrongPotcoinNetworkRejected() public {
        IPotcoinFinalityVerifier420.FinalizedTransfer memory p =
            _healthy(keccak256("wrong-network"), keccak256("pot-output-5"));
        p.networkId = keccak256("POTCOIN/TESTNET");
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "wrong network accepted");
    }

    function testWrongGatewayRejected() public {
        IPotcoinFinalityVerifier420.FinalizedTransfer memory p =
            _healthy(keccak256("wrong-gateway"), keccak256("pot-output-6"));
        p.gatewayScriptHash = keccak256("unapproved-gateway");
        verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "wrong gateway accepted");
    }

    function testMessageReplayRejected() public {
        bytes32 messageId = keccak256("pot-replay-message");
        verifier.set(_healthy(messageId, keccak256("pot-output-7")));
        router.inbound(adapter, hex"01");
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "message replay accepted");
    }

    function testSourceOutputReplayRejected() public {
        bytes32 output = keccak256("pot-shared-output");
        verifier.set(_healthy(keccak256("pot-message-a"), output));
        router.inbound(adapter, hex"01");
        verifier.set(_healthy(keccak256("pot-message-b"), output));
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01")));
        require(!ok, "source output replay accepted");
    }

    function testDirectInboundBypassRejected() public {
        (bool ok,) = address(adapter).call(abi.encodeCall(adapter.verifyInbound, (hex"01")));
        require(!ok, "direct adapter inbound accepted");
    }

    function testOutboundP2pkhPasses() public {
        bytes memory recipient = abi.encodePacked(bytes20(uint160(0x123456)));
        bytes32 id = router.outbound(adapter, ROUTE, POT_ASSET, address(this), recipient, 10_00000000, hex"00");
        require(id != bytes32(0), "message");
    }

    function testOutboundP2shPasses() public {
        bytes memory recipient = abi.encodePacked(bytes20(uint160(0x654321)));
        bytes32 id = router.outbound(adapter, ROUTE, POT_ASSET, address(this), recipient, 10_00000000, hex"01");
        require(id != bytes32(0), "message");
    }

    function testOutboundUnknownScriptTypeRejected() public {
        bytes memory recipient = abi.encodePacked(bytes20(uint160(0x123456)));
        (bool ok,) = address(router).call(
            abi.encodeCall(router.outbound, (adapter, ROUTE, POT_ASSET, address(this), recipient, 1, hex"02"))
        );
        require(!ok, "unknown script type accepted");
    }

    function _healthy(bytes32 messageId, bytes32 sourceOutput)
        private pure returns (IPotcoinFinalityVerifier420.FinalizedTransfer memory p)
    {
        p = IPotcoinFinalityVerifier420.FinalizedTransfer({
            networkId: keccak256("POTCOIN/MAINNET"),
            blockHeight: 42_420,
            blockHash: keccak256(abi.encode("pot-block", messageId)),
            transactionHash: keccak256(abi.encode("pot-tx", messageId)),
            messageId: messageId,
            gatewayScriptHash: GATEWAY,
            sourceOutput: sourceOutput,
            recipient: address(0xB0B),
            amountPotSatoshis: 42_00000000,
            proofOfStake: true,
            finalized: true
        });
    }
}
