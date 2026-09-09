// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/EthereumBridgeAdapter420.sol";
import "../src/bridge/verifiers/EthereumFinalityVerifier420.sol";
import "../src/interfaces/IEthereumFinalityOracle420.sol";
import "../src/interfaces/IEthereumGatewayMessageVerifier420.sol";

contract EthereumFinalityOracleMock420 is IEthereumFinalityOracle420 {
    bool public finalized = true;
    function setFinalized(bool v) external { finalized = v; }
    function isFinalizedExecutionBlock(uint64, bytes32, bytes32) external view returns (bool) { return finalized; }
}

contract EthereumGatewayMessageVerifierMock420 is IEthereumGatewayMessageVerifier420 {
    GatewayMessage private nextMessage;
    function set(GatewayMessage calldata m) external { nextMessage = m; }
    function verifyGatewayMessage(bytes calldata, uint64, bytes32, bytes32) external view returns (GatewayMessage memory) { return nextMessage; }
}

contract EthereumRouterCaller420 {
    function inbound(EthereumBridgeAdapter420 adapter, bytes calldata proof) external returns (IBridgeAdapter420.VerifiedTransfer memory) { return adapter.verifyInbound(proof); }
    function outbound(EthereumBridgeAdapter420 adapter, bytes32 routeId, bytes32 assetId, address sender, bytes calldata recipient, uint256 amount, bytes calldata extra) external returns (bytes32) {
        return adapter.initiateOutbound(routeId, assetId, sender, recipient, amount, extra);
    }
}

contract EthereumBridgeAdapter420Test {
    bytes32 private constant ROUTE = keccak256("420/BRIDGE/ROUTE/ETH/MAINNET");
    bytes32 private constant ETH_ASSET = keccak256("420/BRIDGE/ASSET/ETH");
    bytes32 private constant ERC20_ASSET = keccak256("420/BRIDGE/ASSET/ERC20/TEST");
    address private constant GATEWAY = address(0x420420);
    address private constant TOKEN = address(0xBEEF20);

    EthereumFinalityOracleMock420 private oracle;
    EthereumGatewayMessageVerifierMock420 private messageVerifier;
    EthereumFinalityVerifier420 private verifier;
    EthereumRouterCaller420 private router;
    EthereumBridgeAdapter420 private adapter;

    constructor() {
        oracle = new EthereumFinalityOracleMock420();
        messageVerifier = new EthereumGatewayMessageVerifierMock420();
        verifier = new EthereumFinalityVerifier420(address(this), address(oracle), address(messageVerifier));
        router = new EthereumRouterCaller420();
        adapter = new EthereumBridgeAdapter420(address(this), address(router), address(verifier));
        adapter.setGateway(GATEWAY, true);
        adapter.setAssetMapping(adapter.ETH_NATIVE_SOURCE_ASSET(), ETH_ASSET, true);
        adapter.setRouteBinding(ETH_ASSET, ROUTE);
        _setMessage(address(0), keccak256("eth-message-1"));
    }

    function testFinalizedEthereumInboundPasses() public {
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, _proof());
        require(v.routeId == ROUTE, "route");
        require(v.assetId == ETH_ASSET, "asset");
        require(v.sender == address(0xA11CE), "sender");
        require(v.recipient == address(0xB0B), "recipient");
        require(v.amount == 42 ether, "amount");
    }

    function testUnfinalizedExecutionBlockFailsClosed() public {
        oracle.setFinalized(false);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, _proof())));
        require(!ok, "unfinalized accepted");
    }

    function testWrongGatewayFailsClosed() public {
        IEthereumGatewayMessageVerifier420.GatewayMessage memory m = _message(address(0), keccak256("wrong-gateway"));
        m.gateway = address(0xBAD);
        messageVerifier.set(m);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, _proof())));
        require(!ok, "gateway accepted");
    }

    function testUnknownErc20FailsClosed() public {
        _setMessage(TOKEN, keccak256("unknown-token"));
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, _proof())));
        require(!ok, "unknown token accepted");
    }

    function testQualifiedErc20Passes() public {
        bytes32 key = adapter.sourceAssetKey(TOKEN);
        adapter.setAssetMapping(key, ERC20_ASSET, true);
        adapter.setRouteBinding(ERC20_ASSET, ROUTE);
        _setMessage(TOKEN, keccak256("erc20"));
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, _proof());
        require(v.assetId == ERC20_ASSET, "asset");
    }

    function testReplayFailsClosed() public {
        _setMessage(address(0), keccak256("replay"));
        router.inbound(adapter, _proof());
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, _proof())));
        require(!ok, "replay accepted");
    }

    function testDirectAdapterBypassFailsClosed() public {
        (bool ok,) = address(adapter).call(abi.encodeCall(adapter.verifyInbound, (_proof())));
        require(!ok, "direct accepted");
    }

    function testMalformedOutboundRecipientFailsClosed() public {
        (bool ok,) = address(router).call(abi.encodeCall(router.outbound, (adapter, ROUTE, ETH_ASSET, address(this), hex"010203", 1 ether, bytes(""))));
        require(!ok, "bad recipient accepted");
    }

    function _proof() private pure returns (bytes memory) {
        return abi.encode(uint64(22_000_000), keccak256("eth-block"), keccak256("receipts-root"), bytes("receipt-proof"));
    }

    function _setMessage(address token, bytes32 messageId) private { messageVerifier.set(_message(token, messageId)); }

    function _message(address token, bytes32 messageId) private pure returns (IEthereumGatewayMessageVerifier420.GatewayMessage memory m) {
        m = IEthereumGatewayMessageVerifier420.GatewayMessage({
            messageId: messageId,
            gateway: GATEWAY,
            sourceToken: token,
            sourceSender: address(0xA11CE),
            recipient: address(0xB0B),
            amount: 42 ether,
            transactionHash: keccak256(abi.encode("eth-tx", messageId))
        });
    }
}
