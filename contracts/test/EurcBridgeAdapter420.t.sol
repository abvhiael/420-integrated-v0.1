// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/EthereumBridgeAdapter420.sol";
import "../src/bridge/verifiers/EthereumFinalityVerifier420.sol";
import "../src/interfaces/IEthereumFinalityOracle420.sol";
import "../src/interfaces/IEthereumGatewayMessageVerifier420.sol";

contract EurcEthereumFinalityOracleMock420 is IEthereumFinalityOracle420 {
    bool public finalized = true;
    function isFinalizedExecutionBlock(uint64, bytes32, bytes32) external view returns (bool) { return finalized; }
}

contract EurcEthereumGatewayMessageVerifierMock420 is IEthereumGatewayMessageVerifier420 {
    GatewayMessage private nextMessage;
    function set(GatewayMessage calldata m) external { nextMessage = m; }
    function verifyGatewayMessage(bytes calldata, uint64, bytes32, bytes32) external view returns (GatewayMessage memory) {
        return nextMessage;
    }
}

contract EurcEthereumRouterCaller420 {
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

/// @notice V12.5.21 qualification: EURC is the canonical Circle-issued Ethereum asset over the existing ETH adapter.
contract EurcBridgeAdapter420Test {
    address private constant EURC_ETHEREUM = 0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c;
    address private constant GATEWAY = address(0x420420);
    bytes32 private constant EURC_ASSET = keccak256("420/BRIDGE/ASSET/EURC");
    bytes32 private constant EURC_ROUTE = keccak256("420/BRIDGE/ROUTE/EURC/ETHEREUM/MAINNET");
    uint256 private constant ONE_EURC = 1_000_000;

    EurcEthereumFinalityOracleMock420 private oracle;
    EurcEthereumGatewayMessageVerifierMock420 private messageVerifier;
    EthereumFinalityVerifier420 private verifier;
    EurcEthereumRouterCaller420 private router;
    EthereumBridgeAdapter420 private adapter;

    constructor() {
        oracle = new EurcEthereumFinalityOracleMock420();
        messageVerifier = new EurcEthereumGatewayMessageVerifierMock420();
        verifier = new EthereumFinalityVerifier420(address(this), address(oracle), address(messageVerifier));
        router = new EurcEthereumRouterCaller420();
        adapter = new EthereumBridgeAdapter420(address(this), address(router), address(verifier));

        adapter.setGateway(GATEWAY, true);
        adapter.setAssetMapping(adapter.sourceAssetKey(EURC_ETHEREUM), EURC_ASSET, true);
        adapter.setRouteBinding(EURC_ASSET, EURC_ROUTE);
        _setMessage(keccak256("eurc-message-1"));
    }

    function testCanonicalEurcEthereumInboundPasses() public {
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, _proof());
        require(v.routeId == EURC_ROUTE, "route");
        require(v.assetId == EURC_ASSET, "asset");
        require(v.sender == address(0xA11CE), "sender");
        require(v.recipient == address(0xB0B), "recipient");
        require(v.amount == 420 * ONE_EURC, "amount");
    }

    function testWrongEurcTokenRejected() public {
        IEthereumGatewayMessageVerifier420.GatewayMessage memory m = _message(keccak256("wrong-eurc-token"));
        m.sourceToken = address(0xBAD20);
        messageVerifier.set(m);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, _proof())));
        require(!ok, "wrong EURC token accepted");
    }

    function testEurcReplayRejected() public {
        _setMessage(keccak256("eurc-replay"));
        router.inbound(adapter, _proof());
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, _proof())));
        require(!ok, "EURC replay accepted");
    }

    function testEurcOutboundUsesEthereumRoute() public {
        bytes memory recipient = abi.encodePacked(address(0xCAFE));
        bytes32 messageId = router.outbound(adapter, EURC_ROUTE, EURC_ASSET, address(this), recipient, 42 * ONE_EURC);
        require(messageId != bytes32(0), "message");
    }

    function testEurcDifferentRouteRejected() public {
        bytes memory recipient = abi.encodePacked(address(0xCAFE));
        (bool ok,) = address(router).call(
            abi.encodeCall(
                router.outbound,
                (adapter, keccak256("420/BRIDGE/ROUTE/EURC/WRONG"), EURC_ASSET, address(this), recipient, 42 * ONE_EURC)
            )
        );
        require(!ok, "wrong EURC route accepted");
    }

    function _proof() private pure returns (bytes memory) {
        return abi.encode(uint64(22_000_000), keccak256("eurc-eth-block"), keccak256("eurc-receipts-root"), bytes("receipt-proof"));
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
            sourceToken: EURC_ETHEREUM,
            sourceSender: address(0xA11CE),
            recipient: address(0xB0B),
            amount: 420 * ONE_EURC,
            transactionHash: keccak256(abi.encode("eurc-eth-tx", messageId))
        });
    }
}
