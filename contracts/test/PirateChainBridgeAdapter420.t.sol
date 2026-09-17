// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/PirateChainBridgeAdapter420.sol";
import "../src/interfaces/IPirateChainFinalityVerifier420.sol";

contract PirateChainFinalityVerifierMock420 is IPirateChainFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata t) external { nextTransfer = t; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract PirateChainRouterCaller420 {
    function inbound(PirateChainBridgeAdapter420 adapter, bytes calldata proof)
        external returns (IBridgeAdapter420.VerifiedTransfer memory)
    { return adapter.verifyInbound(proof); }

    function outbound(
        PirateChainBridgeAdapter420 adapter,
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

contract PirateChainBridgeAdapter420Test {
    bytes32 private constant ARRR_ASSET = keccak256("420/BRIDGE/ASSET/ARRR");
    bytes32 private constant ARRR_ROUTE = keccak256("420/BRIDGE/ROUTE/ARRR/PIRATE/MAINNET");
    bytes32 private constant NETWORK = keccak256("PIRATE/MAINNET");

    PirateChainFinalityVerifierMock420 private verifier;
    PirateChainRouterCaller420 private router;
    PirateChainBridgeAdapter420 private adapter;

    constructor() {
        verifier = new PirateChainFinalityVerifierMock420();
        router = new PirateChainRouterCaller420();
        adapter = new PirateChainBridgeAdapter420(address(this), address(router), address(verifier));
        adapter.setArrrBinding(ARRR_ASSET, ARRR_ROUTE);
        _setTransfer(keccak256("arrr-message-1"), NETWORK, 3, true, true, 0);
    }

    function testCanonicalPirateInboundPasses() public {
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, bytes("proof"));
        require(v.routeId == ARRR_ROUTE, "route");
        require(v.assetId == ARRR_ASSET, "asset");
        require(v.recipient == address(0xB0B), "recipient");
        require(v.amount == 42000000000, "amount");
    }

    function testNotarizationRequired() public {
        _setTransfer(keccak256("arrr-notarization"), NETWORK, 3, true, false, 0);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, bytes("proof"))));
        require(!ok, "unnotarized accepted");
    }

    function testEquihashRequired() public {
        _setTransfer(keccak256("arrr-equihash"), NETWORK, 3, false, true, 0);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, bytes("proof"))));
        require(!ok, "invalid PoW accepted");
    }

    function testMinimumDpowConfirmationsRequired() public {
        _setTransfer(keccak256("arrr-confirmations"), NETWORK, 2, true, true, 0);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, bytes("proof"))));
        require(!ok, "too few confirmations accepted");
    }

    function testWrongNetworkRejected() public {
        _setTransfer(keccak256("arrr-network"), keccak256("wrong"), 3, true, true, 0);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, bytes("proof"))));
        require(!ok, "wrong network accepted");
    }

    function testNullifierReplayRejected() public {
        bytes32 messageId = keccak256("arrr-replay");
        _setTransfer(messageId, NETWORK, 3, true, true, 0);
        router.inbound(adapter, bytes("proof"));
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, bytes("proof"))));
        require(!ok, "replay accepted");
    }

    function testSaplingOutboundPasses() public {
        bytes memory recipient = bytes("zs1piratebridgeexample");
        bytes32 id = router.outbound(adapter, ARRR_ROUTE, ARRR_ASSET, address(this), recipient, 1e8, hex"00");
        require(id != bytes32(0), "sapling outbound");
    }

    function testIronwoodOutboundPasses() public {
        bytes memory recipient = bytes("pirate1bridgeexample");
        bytes32 id = router.outbound(adapter, ARRR_ROUTE, ARRR_ASSET, address(this), recipient, 1e8, hex"01");
        require(id != bytes32(0), "ironwood outbound");
    }

    function testTransparentOutboundRejected() public {
        bytes memory recipient = bytes("Rtransparentaddress");
        (bool ok,) = address(router).call(
            abi.encodeCall(router.outbound, (adapter, ARRR_ROUTE, ARRR_ASSET, address(this), recipient, 1e8, hex"00"))
        );
        require(!ok, "transparent destination accepted");
    }

    function _setTransfer(
        bytes32 messageId,
        bytes32 networkId,
        uint32 confirmations,
        bool equihashValidated,
        bool notarizationValidated,
        uint8 pool
    ) private {
        verifier.set(IPirateChainFinalityVerifier420.FinalizedTransfer({
            networkId: networkId,
            blockHeight: 4_200_000,
            blockHash: keccak256(abi.encode("arrr-block", messageId)),
            transactionHash: keccak256(abi.encode("arrr-tx", messageId)),
            messageId: messageId,
            nullifier: keccak256(abi.encode("arrr-nullifier", messageId)),
            noteCommitment: keccak256(abi.encode("arrr-note", messageId)),
            memoBindingHash: keccak256(abi.encode("arrr-memo", messageId)),
            recipient: address(0xB0B),
            amountArrrtoshi: 42000000000,
            confirmations: confirmations,
            shieldedPool: pool,
            equihashValidated: equihashValidated,
            notarizationValidated: notarizationValidated,
            finalized: true
        }));
    }
}
