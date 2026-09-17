// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/EthereumBridgeAdapter420.sol";
import "../src/bridge/verifiers/EthereumFinalityVerifier420.sol";
import "../src/interfaces/IEthereumFinalityOracle420.sol";
import "../src/interfaces/IEthereumGatewayMessageVerifier420.sol";

contract UsdtEthereumFinalityOracleMock420 is IEthereumFinalityOracle420 {
    bool public finalized = true;
    function isFinalizedExecutionBlock(uint64, bytes32, bytes32) external view returns (bool) { return finalized; }
}

contract UsdtEthereumGatewayMessageVerifierMock420 is IEthereumGatewayMessageVerifier420 {
    GatewayMessage private nextMessage;
    function set(GatewayMessage calldata m) external { nextMessage = m; }
    function verifyGatewayMessage(bytes calldata, uint64, bytes32, bytes32) external view returns (GatewayMessage memory) {
        return nextMessage;
    }
}

contract UsdtEthereumRouterCaller420 {
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

/// @notice V12.5.19 qualification: USDT is the canonical Ethereum ERC-20 asset over the existing ETH adapter.
contract UsdtBridgeAdapter420Test {
    address private constant USDT_ETHEREUM = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address private constant GATEWAY = address(0x420420);
    bytes32 private constant USDT_ASSET = keccak256("420/BRIDGE/ASSET/USDT");
    bytes32 private constant USDT_ROUTE = keccak256("420/BRIDGE/ROUTE/USDT/ETHEREUM/MAINNET");
    uint256 private constant ONE_USDT = 1_000_000;

    UsdtEthereumFinalityOracleMock420 private oracle;
    UsdtEthereumGatewayMessageVerifierMock420 private messageVerifier;
    EthereumFinalityVerifier420 private verifier;
    UsdtEthereumRouterCaller420 private router;
    EthereumBridgeAdapter420 private adapter;

    constructor() {
        oracle = new UsdtEthereumFinalityOracleMock420();
        messageVerifier = new UsdtEthereumGatewayMessageVerifierMock420();
        verifier = new EthereumFinalityVerifier420(address(this), address(oracle), address(messageVerifier));
        router = new UsdtEthereumRouterCaller420();
        adapter = new EthereumBridgeAdapter420(address(this), address(router), address(verifier));

        adapter.setGateway(GATEWAY, true);
        adapter.setAssetMapping(adapter.sourceAssetKey(USDT_ETHEREUM), USDT_ASSET, true);
        adapter.setRouteBinding(USDT_ASSET, USDT_ROUTE);
        _setMessage(keccak256("usdt-message-1"));
    }

    function testCanonicalUsdtEthereumInboundPasses() public {
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, _proof());
        require(v.routeId == USDT_ROUTE, "route");
        require(v.assetId == USDT_ASSET, "asset");
        require(v.sender == address(0xA11CE), "sender");
        require(v.recipient == address(0xB0B), "recipient");
        require(v.amount == 420 * ONE_USDT, "amount");
    }

    function testWrongUsdtTokenRejected() public {
        IEthereumGatewayMessageVerifier420.GatewayMessage memory m = _message(keccak256("wrong-usdt-token"));
        m.sourceToken = address(0xBAD20);
        messageVerifier.set(m);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, _proof())));
        require(!ok, "wrong USDT token accepted");
    }

    function testUsdtReplayRejected() public {
        _setMessage(keccak256("usdt-replay"));
        router.inbound(adapter, _proof());
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, _proof())));
        require(!ok, "USDT replay accepted");
    }

    function testUsdtOutboundUsesEthereumRoute() public {
        bytes memory recipient = abi.encodePacked(address(0xCAFE));
        bytes32 messageId = router.outbound(adapter, USDT_ROUTE, USDT_ASSET, address(this), recipient, 42 * ONE_USDT);
        require(messageId != bytes32(0), "message");
    }

    function testUsdtDifferentRouteRejected() public {
        bytes memory recipient = abi.encodePacked(address(0xCAFE));
        (bool ok,) = address(router).call(
            abi.encodeCall(
                router.outbound,
                (adapter, keccak256("420/BRIDGE/ROUTE/USDT/WRONG"), USDT_ASSET, address(this), recipient, 42 * ONE_USDT)
            )
        );
        require(!ok, "wrong USDT route accepted");
    }

    function _proof() private pure returns (bytes memory) {
        return abi.encode(uint64(22_000_000), keccak256("usdt-eth-block"), keccak256("usdt-receipts-root"), bytes("receipt-proof"));
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
            sourceToken: USDT_ETHEREUM,
            sourceSender: address(0xA11CE),
            recipient: address(0xB0B),
            amount: 420 * ONE_USDT,
            transactionHash: keccak256(abi.encode("usdt-eth-tx", messageId))
        });
    }
}
