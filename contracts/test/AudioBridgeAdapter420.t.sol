// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/EthereumBridgeAdapter420.sol";
import "../src/bridge/verifiers/EthereumFinalityVerifier420.sol";
import "../src/interfaces/IEthereumFinalityOracle420.sol";
import "../src/interfaces/IEthereumGatewayMessageVerifier420.sol";

contract AudioEthereumFinalityOracleMock420 is IEthereumFinalityOracle420 {
    bool public finalized = true;
    function isFinalizedExecutionBlock(uint64, bytes32, bytes32) external view returns (bool) { return finalized; }
}

contract AudioEthereumGatewayMessageVerifierMock420 is IEthereumGatewayMessageVerifier420 {
    GatewayMessage private nextMessage;
    function set(GatewayMessage calldata m) external { nextMessage = m; }
    function verifyGatewayMessage(bytes calldata, uint64, bytes32, bytes32) external view returns (GatewayMessage memory) {
        return nextMessage;
    }
}

contract AudioEthereumRouterCaller420 {
    function inbound(EthereumBridgeAdapter420 adapter, bytes calldata proof)
        external returns (IBridgeAdapter420.VerifiedTransfer memory)
    {
        return adapter.verifyInbound(proof);
    }

    function outbound(
        EthereumBridgeAdapter420 adapter,
        bytes32 routeId,
        bytes32 assetId,
        address sender,
        bytes calldata recipient,
        uint256 amount
    ) external returns (bytes32) {
        return adapter.initiateOutbound(routeId, assetId, sender, recipient, amount, bytes(""));
    }
}

/// @notice V12.5.8 qualification: AUDIO is an Ethereum ERC-20 asset, not a standalone chain adapter.
contract AudioBridgeAdapter420Test {
    address private constant AUDIO_ETHEREUM = 0x18aAA7115705e8be94bfFEBDE57Af9BFc265B998;
    address private constant GATEWAY = address(0x420420);
    bytes32 private constant AUDIO_ASSET = keccak256("420/BRIDGE/ASSET/AUDIO");
    bytes32 private constant AUDIO_ROUTE = keccak256("420/BRIDGE/ROUTE/AUDIO/ETHEREUM/MAINNET");

    AudioEthereumFinalityOracleMock420 private oracle;
    AudioEthereumGatewayMessageVerifierMock420 private messageVerifier;
    EthereumFinalityVerifier420 private verifier;
    AudioEthereumRouterCaller420 private router;
    EthereumBridgeAdapter420 private adapter;

    constructor() {
        oracle = new AudioEthereumFinalityOracleMock420();
        messageVerifier = new AudioEthereumGatewayMessageVerifierMock420();
        verifier = new EthereumFinalityVerifier420(address(this), address(oracle), address(messageVerifier));
        router = new AudioEthereumRouterCaller420();
        adapter = new EthereumBridgeAdapter420(address(this), address(router), address(verifier));

        adapter.setGateway(GATEWAY, true);
        adapter.setAssetMapping(adapter.sourceAssetKey(AUDIO_ETHEREUM), AUDIO_ASSET, true);
        adapter.setRouteBinding(AUDIO_ASSET, AUDIO_ROUTE);
        _setMessage(keccak256("audio-message-1"));
    }

    function testCanonicalAudioEthereumInboundPasses() public {
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, _proof());
        require(v.routeId == AUDIO_ROUTE, "route");
        require(v.assetId == AUDIO_ASSET, "asset");
        require(v.sender == address(0xA11CE), "sender");
        require(v.recipient == address(0xB0B), "recipient");
        require(v.amount == 420 ether, "amount");
    }

    function testWrongAudioTokenFailsClosed() public {
        IEthereumGatewayMessageVerifier420.GatewayMessage memory m = _message(keccak256("wrong-audio-token"));
        m.sourceToken = address(0xBAD20);
        messageVerifier.set(m);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, _proof())));
        require(!ok, "wrong AUDIO token accepted");
    }

    function testAudioReplayFailsClosed() public {
        _setMessage(keccak256("audio-replay"));
        router.inbound(adapter, _proof());
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, _proof())));
        require(!ok, "AUDIO replay accepted");
    }

    function testAudioOutboundUsesEthereumRoute() public {
        bytes memory recipient = abi.encodePacked(address(0xCAFE));
        bytes32 messageId = router.outbound(adapter, AUDIO_ROUTE, AUDIO_ASSET, address(this), recipient, 42 ether);
        require(messageId != bytes32(0), "message");
    }

    function testAudioCannotUseDifferentRoute() public {
        bytes memory recipient = abi.encodePacked(address(0xCAFE));
        (bool ok,) = address(router).call(
            abi.encodeCall(
                router.outbound,
                (adapter, keccak256("420/BRIDGE/ROUTE/AUDIO/WRONG"), AUDIO_ASSET, address(this), recipient, 42 ether)
            )
        );
        require(!ok, "wrong AUDIO route accepted");
    }

    function _proof() private pure returns (bytes memory) {
        return abi.encode(uint64(22_000_000), keccak256("audio-eth-block"), keccak256("audio-receipts-root"), bytes("receipt-proof"));
    }

    function _setMessage(bytes32 messageId) private {
        messageVerifier.set(_message(messageId));
    }

    function _message(bytes32 messageId)
        private pure returns (IEthereumGatewayMessageVerifier420.GatewayMessage memory m)
    {
        m = IEthereumGatewayMessageVerifier420.GatewayMessage({
            messageId: messageId,
            gateway: GATEWAY,
            sourceToken: AUDIO_ETHEREUM,
            sourceSender: address(0xA11CE),
            recipient: address(0xB0B),
            amount: 420 ether,
            transactionHash: keccak256(abi.encode("audio-eth-tx", messageId))
        });
    }
}
