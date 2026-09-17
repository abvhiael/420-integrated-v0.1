// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/EthereumBridgeAdapter420.sol";
import "../src/bridge/verifiers/EthereumFinalityVerifier420.sol";
import "../src/interfaces/IEthereumFinalityOracle420.sol";
import "../src/interfaces/IEthereumGatewayMessageVerifier420.sol";

contract AaveEthereumFinalityOracleMock420 is IEthereumFinalityOracle420 {
    bool public finalized = true;
    function isFinalizedExecutionBlock(uint64, bytes32, bytes32) external view returns (bool) { return finalized; }
}

contract AaveEthereumGatewayMessageVerifierMock420 is IEthereumGatewayMessageVerifier420 {
    GatewayMessage private nextMessage;
    function set(GatewayMessage calldata m) external { nextMessage = m; }
    function verifyGatewayMessage(bytes calldata, uint64, bytes32, bytes32) external view returns (GatewayMessage memory) {
        return nextMessage;
    }
}

contract AaveEthereumRouterCaller420 {
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

/// @notice V12.5.18 qualification: AAVE is the canonical Ethereum token over the existing ETH adapter.
contract AaveBridgeAdapter420Test {
    address private constant AAVE_ETHEREUM = 0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9;
    address private constant GATEWAY = address(0x420420);
    bytes32 private constant AAVE_ASSET = keccak256("420/BRIDGE/ASSET/AAVE");
    bytes32 private constant AAVE_ROUTE = keccak256("420/BRIDGE/ROUTE/AAVE/ETHEREUM/MAINNET");

    AaveEthereumFinalityOracleMock420 private oracle;
    AaveEthereumGatewayMessageVerifierMock420 private messageVerifier;
    EthereumFinalityVerifier420 private verifier;
    AaveEthereumRouterCaller420 private router;
    EthereumBridgeAdapter420 private adapter;

    constructor() {
        oracle = new AaveEthereumFinalityOracleMock420();
        messageVerifier = new AaveEthereumGatewayMessageVerifierMock420();
        verifier = new EthereumFinalityVerifier420(address(this), address(oracle), address(messageVerifier));
        router = new AaveEthereumRouterCaller420();
        adapter = new EthereumBridgeAdapter420(address(this), address(router), address(verifier));

        adapter.setGateway(GATEWAY, true);
        adapter.setAssetMapping(adapter.sourceAssetKey(AAVE_ETHEREUM), AAVE_ASSET, true);
        adapter.setRouteBinding(AAVE_ASSET, AAVE_ROUTE);
        _setMessage(keccak256("aave-message-1"));
    }

    function testCanonicalAaveEthereumInboundPasses() public {
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, _proof());
        require(v.routeId == AAVE_ROUTE, "route");
        require(v.assetId == AAVE_ASSET, "asset");
        require(v.sender == address(0xA11CE), "sender");
        require(v.recipient == address(0xB0B), "recipient");
        require(v.amount == 420 ether, "amount");
    }

    function testWrongAaveTokenRejected() public {
        IEthereumGatewayMessageVerifier420.GatewayMessage memory m = _message(keccak256("wrong-aave-token"));
        m.sourceToken = address(0xBAD20);
        messageVerifier.set(m);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, _proof())));
        require(!ok, "wrong AAVE token accepted");
    }

    function testAaveReplayRejected() public {
        _setMessage(keccak256("aave-replay"));
        router.inbound(adapter, _proof());
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, _proof())));
        require(!ok, "AAVE replay accepted");
    }

    function testAaveOutboundUsesEthereumRoute() public {
        bytes memory recipient = abi.encodePacked(address(0xCAFE));
        bytes32 messageId = router.outbound(adapter, AAVE_ROUTE, AAVE_ASSET, address(this), recipient, 42 ether);
        require(messageId != bytes32(0), "message");
    }

    function testAaveDifferentRouteRejected() public {
        bytes memory recipient = abi.encodePacked(address(0xCAFE));
        (bool ok,) = address(router).call(
            abi.encodeCall(
                router.outbound,
                (adapter, keccak256("420/BRIDGE/ROUTE/AAVE/WRONG"), AAVE_ASSET, address(this), recipient, 42 ether)
            )
        );
        require(!ok, "wrong AAVE route accepted");
    }

    function _proof() private pure returns (bytes memory) {
        return abi.encode(uint64(22_000_000), keccak256("aave-eth-block"), keccak256("aave-receipts-root"), bytes("receipt-proof"));
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
            sourceToken: AAVE_ETHEREUM,
            sourceSender: address(0xA11CE),
            recipient: address(0xB0B),
            amount: 420 ether,
            transactionHash: keccak256(abi.encode("aave-eth-tx", messageId))
        });
    }
}
