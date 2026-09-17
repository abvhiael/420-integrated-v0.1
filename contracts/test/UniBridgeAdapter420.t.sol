// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/EthereumBridgeAdapter420.sol";
import "../src/bridge/verifiers/EthereumFinalityVerifier420.sol";
import "../src/interfaces/IEthereumFinalityOracle420.sol";
import "../src/interfaces/IEthereumGatewayMessageVerifier420.sol";

contract UniEthereumFinalityOracleMock420 is IEthereumFinalityOracle420 {
    bool public finalized = true;
    function isFinalizedExecutionBlock(uint64, bytes32, bytes32) external view returns (bool) { return finalized; }
}

contract UniEthereumGatewayMessageVerifierMock420 is IEthereumGatewayMessageVerifier420 {
    GatewayMessage private nextMessage;
    function set(GatewayMessage calldata m) external { nextMessage = m; }
    function verifyGatewayMessage(bytes calldata, uint64, bytes32, bytes32) external view returns (GatewayMessage memory) {
        return nextMessage;
    }
}

contract UniEthereumRouterCaller420 {
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

/// @notice V12.5.16 qualification: UNI is the canonical Ethereum ERC-20 asset over the existing ETH adapter.
contract UniBridgeAdapter420Test {
    address private constant UNI_ETHEREUM = 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984;
    address private constant GATEWAY = address(0x420420);
    bytes32 private constant UNI_ASSET = keccak256("420/BRIDGE/ASSET/UNI");
    bytes32 private constant UNI_ROUTE = keccak256("420/BRIDGE/ROUTE/UNI/ETHEREUM/MAINNET");

    UniEthereumFinalityOracleMock420 private oracle;
    UniEthereumGatewayMessageVerifierMock420 private messageVerifier;
    EthereumFinalityVerifier420 private verifier;
    UniEthereumRouterCaller420 private router;
    EthereumBridgeAdapter420 private adapter;

    constructor() {
        oracle = new UniEthereumFinalityOracleMock420();
        messageVerifier = new UniEthereumGatewayMessageVerifierMock420();
        verifier = new EthereumFinalityVerifier420(address(this), address(oracle), address(messageVerifier));
        router = new UniEthereumRouterCaller420();
        adapter = new EthereumBridgeAdapter420(address(this), address(router), address(verifier));

        adapter.setGateway(GATEWAY, true);
        adapter.setAssetMapping(adapter.sourceAssetKey(UNI_ETHEREUM), UNI_ASSET, true);
        adapter.setRouteBinding(UNI_ASSET, UNI_ROUTE);
        _setMessage(keccak256("uni-message-1"));
    }

    function testCanonicalUniEthereumInboundPasses() public {
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, _proof());
        require(v.routeId == UNI_ROUTE, "route");
        require(v.assetId == UNI_ASSET, "asset");
        require(v.sender == address(0xA11CE), "sender");
        require(v.recipient == address(0xB0B), "recipient");
        require(v.amount == 420 ether, "amount");
    }

    function testWrongUniTokenRejected() public {
        IEthereumGatewayMessageVerifier420.GatewayMessage memory m = _message(keccak256("wrong-uni-token"));
        m.sourceToken = address(0xBAD20);
        messageVerifier.set(m);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, _proof())));
        require(!ok, "wrong UNI token accepted");
    }

    function testUniReplayRejected() public {
        _setMessage(keccak256("uni-replay"));
        router.inbound(adapter, _proof());
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, _proof())));
        require(!ok, "UNI replay accepted");
    }

    function testUniOutboundUsesEthereumRoute() public {
        bytes memory recipient = abi.encodePacked(address(0xCAFE));
        bytes32 messageId = router.outbound(adapter, UNI_ROUTE, UNI_ASSET, address(this), recipient, 42 ether);
        require(messageId != bytes32(0), "message");
    }

    function testUniDifferentRouteRejected() public {
        bytes memory recipient = abi.encodePacked(address(0xCAFE));
        (bool ok,) = address(router).call(
            abi.encodeCall(
                router.outbound,
                (adapter, keccak256("420/BRIDGE/ROUTE/UNI/WRONG"), UNI_ASSET, address(this), recipient, 42 ether)
            )
        );
        require(!ok, "wrong UNI route accepted");
    }

    function _proof() private pure returns (bytes memory) {
        return abi.encode(uint64(22_000_000), keccak256("uni-eth-block"), keccak256("uni-receipts-root"), bytes("receipt-proof"));
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
            sourceToken: UNI_ETHEREUM,
            sourceSender: address(0xA11CE),
            recipient: address(0xB0B),
            amount: 420 ether,
            transactionHash: keccak256(abi.encode("uni-eth-tx", messageId))
        });
    }
}
