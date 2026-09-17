// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/CurecoinBridgeAdapter420.sol";
import "../src/interfaces/ICurecoinFinalityVerifier420.sol";

contract CurecoinFinalityVerifierMock420 is ICurecoinFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata t) external { nextTransfer = t; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract CurecoinRouterCaller420 {
    function inbound(CurecoinBridgeAdapter420 adapter, bytes calldata proof) external returns (IBridgeAdapter420.VerifiedTransfer memory) {
        return adapter.verifyInbound(proof);
    }
    function outbound(CurecoinBridgeAdapter420 adapter, bytes32 routeId, bytes32 assetId, address sender, bytes calldata recipient, uint256 amount, bytes calldata extra) external returns (bytes32) {
        return adapter.initiateOutbound(routeId, assetId, sender, recipient, amount, extra);
    }
}

contract CurecoinBridgeAdapter420Test {
    bytes32 private constant CURE_ASSET = keccak256("420/BRIDGE/ASSET/CURE");
    bytes32 private constant CURE_ROUTE = keccak256("420/BRIDGE/ROUTE/CURE/CURECOIN/MAINNET");
    bytes32 private constant GATEWAY_SCRIPT = keccak256("curecoin-gateway-script");
    bytes32 private constant GENESIS = 0x00000ce427729d5393dbf9f464e7a1d2c039e393e881f93448516b1530b688fc;

    CurecoinFinalityVerifierMock420 private verifier;
    CurecoinRouterCaller420 private router;
    CurecoinBridgeAdapter420 private adapter;

    constructor() {
        verifier = new CurecoinFinalityVerifierMock420();
        router = new CurecoinRouterCaller420();
        adapter = new CurecoinBridgeAdapter420(address(this), address(router), address(verifier));
        adapter.setGatewayScript(GATEWAY_SCRIPT, true);
        adapter.setCureBinding(CURE_ASSET, CURE_ROUTE);
        _setTransfer(keccak256("cure-message-1"), true, true, GENESIS, 0xe4e8e9e5);
    }

    function testCanonicalCurecoinInboundPasses() public {
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, bytes("proof"));
        require(v.routeId == CURE_ROUTE, "route");
        require(v.assetId == CURE_ASSET, "asset");
        require(v.recipient == address(0xB0B), "recipient");
        require(v.amount == 42000000000, "amount");
    }

    function testNonPoSBlockRejected() public {
        _setTransfer(keccak256("cure-not-pos"), false, true, GENESIS, 0xe4e8e9e5);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, bytes("proof"))));
        require(!ok, "non-PoS accepted");
    }

    function testWrongNetworkRejected() public {
        _setTransfer(keccak256("cure-wrong-network"), true, true, keccak256("wrong"), 0xe4e8e9e5);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, bytes("proof"))));
        require(!ok, "wrong network accepted");
    }

    function testReplayRejected() public {
        _setTransfer(keccak256("cure-replay"), true, true, GENESIS, 0xe4e8e9e5);
        router.inbound(adapter, bytes("proof"));
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, bytes("proof"))));
        require(!ok, "replay accepted");
    }

    function testOutboundP2PKHAndP2SH() public {
        bytes memory recipient = abi.encodePacked(address(0xCAFE));
        bytes32 a = router.outbound(adapter, CURE_ROUTE, CURE_ASSET, address(this), recipient, 1e8, hex"00");
        bytes32 b = router.outbound(adapter, CURE_ROUTE, CURE_ASSET, address(this), recipient, 2e8, hex"01");
        require(a != bytes32(0) && b != bytes32(0) && a != b, "outbound");
    }

    function _setTransfer(bytes32 messageId, bool pos, bool finalized, bytes32 genesis, bytes4 messageStart) private {
        verifier.set(ICurecoinFinalityVerifier420.FinalizedTransfer({
            genesisHash: genesis,
            messageStart: messageStart,
            blockHeight: 3_000_000,
            blockHash: keccak256(abi.encode("cure-block", messageId)),
            transactionHash: keccak256(abi.encode("cure-tx", messageId)),
            messageId: messageId,
            gatewayScriptHash: GATEWAY_SCRIPT,
            sourceOutput: keccak256(abi.encode("cure-out", messageId)),
            recipient: address(0xB0B),
            amount: 42000000000,
            proofOfStake: pos,
            finalized: finalized
        }));
    }
}
