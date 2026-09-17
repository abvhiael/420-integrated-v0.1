// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/DobbscoinBridgeAdapter420.sol";
import "../src/interfaces/IDobbscoinFinalityVerifier420.sol";

contract DobbscoinFinalityVerifierMock420 is IDobbscoinFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata transfer_) external { nextTransfer = transfer_; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract DobbscoinRouterCaller420 {
    function inbound(DobbscoinBridgeAdapter420 adapter, bytes calldata proof) external returns (IBridgeAdapter420.VerifiedTransfer memory) { return adapter.verifyInbound(proof); }
    function outbound(DobbscoinBridgeAdapter420 adapter, bytes32 routeId, bytes32 assetId, address sender, bytes calldata recipient, uint256 amount, bytes calldata extra) external returns (bytes32) {
        return adapter.initiateOutbound(routeId, assetId, sender, recipient, amount, extra);
    }
}

contract DobbscoinBridgeAdapter420Test {
    bytes32 private constant ROUTE = keccak256("420/BRIDGE/ROUTE/BOB/MAINNET");
    bytes32 private constant BOB_ASSET = keccak256("420/BRIDGE/ASSET/BOB");
    bytes32 private constant GATEWAY = keccak256("dobbscoin-gateway-script");

    DobbscoinFinalityVerifierMock420 private verifier;
    DobbscoinRouterCaller420 private router;
    DobbscoinBridgeAdapter420 private adapter;

    constructor() {
        verifier = new DobbscoinFinalityVerifierMock420();
        router = new DobbscoinRouterCaller420();
        adapter = new DobbscoinBridgeAdapter420(address(this), address(router), address(verifier));
        adapter.setGatewayScript(GATEWAY, true);
        adapter.setBobBinding(BOB_ASSET, ROUTE);
        verifier.set(_healthy(1_900_000, keccak256("bob-message-1"), keccak256("bob-output-1"), false));
    }

    function testCanonicalDobbscoinInboundPasses() public {
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, hex"01");
        require(v.routeId == ROUTE, "route"); require(v.assetId == BOB_ASSET, "asset");
        require(v.recipient == address(0xB0B), "recipient"); require(v.amount == 42_00000000, "amount");
    }

    function testInsufficientConfirmationsFailsClosed() public {
        IDobbscoinFinalityVerifier420.FinalizedTransfer memory p = _healthy(1_900_001, keccak256("low-conf"), keccak256("out-low"), false);
        p.confirmations = 287; verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01"))); require(!ok, "low confirmations accepted");
    }

    function testAuxPowRequiredAfterActivation() public {
        verifier.set(_healthy(2_000_000, keccak256("auxpow-required"), keccak256("out-aux"), false));
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01"))); require(!ok, "missing auxpow accepted");
    }

    function testValidatedAuxPowPassesAfterActivation() public {
        verifier.set(_healthy(2_000_000, keccak256("auxpow-ok"), keccak256("out-aux-ok"), true));
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, hex"01"); require(v.assetId == BOB_ASSET, "asset");
    }

    function testReplayFailsClosed() public {
        bytes32 m = keccak256("replay"); bytes32 o = keccak256("shared-output"); verifier.set(_healthy(1_900_100, m, o, false));
        router.inbound(adapter, hex"01");
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01"))); require(!ok, "replay accepted");
    }

    function testWrongNetworkFailsClosed() public {
        IDobbscoinFinalityVerifier420.FinalizedTransfer memory p = _healthy(1_900_200, keccak256("wrong-network"), keccak256("out-wrong"), false);
        p.messageStart = 0xdeadbeef; verifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, hex"01"))); require(!ok, "wrong network accepted");
    }

    function testOutboundP2PKHPasses() public {
        bytes memory recipient = abi.encodePacked(bytes20(uint160(0x1234)));
        bytes32 id = router.outbound(adapter, ROUTE, BOB_ASSET, address(this), recipient, 1e8, hex"00"); require(id != bytes32(0), "message");
    }

    function _healthy(uint64 height, bytes32 messageId, bytes32 sourceOutput, bool aux)
        private pure returns (IDobbscoinFinalityVerifier420.FinalizedTransfer memory p)
    {
        p = IDobbscoinFinalityVerifier420.FinalizedTransfer({
            genesisHash: 0x6d2d7d525900712451b9697d0b5b2304ebae6efb349540da445bf575c0159969,
            messageStart: 0xa0fb1783, blockHeight: height, blockHash: keccak256(abi.encode("bob-block", height)),
            transactionHash: keccak256(abi.encode("bob-tx", messageId)), messageId: messageId, gatewayScriptHash: GATEWAY,
            sourceOutput: sourceOutput, recipient: address(0xB0B), amount: 42_00000000, confirmations: 288,
            finalized: true, auxPowValidated: aux
        });
    }
}
