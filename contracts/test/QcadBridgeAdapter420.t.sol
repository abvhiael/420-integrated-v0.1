// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/EthereumBridgeAdapter420.sol";
import "../src/bridge/verifiers/EthereumFinalityVerifier420.sol";
import "../src/interfaces/IEthereumFinalityOracle420.sol";
import "../src/interfaces/IEthereumGatewayMessageVerifier420.sol";

contract QcadEthereumFinalityOracleMock420 is IEthereumFinalityOracle420 {
    bool public finalized = true;
    function isFinalizedExecutionBlock(uint64, bytes32, bytes32) external view returns (bool) { return finalized; }
}

contract QcadEthereumGatewayMessageVerifierMock420 is IEthereumGatewayMessageVerifier420 {
    GatewayMessage private nextMessage;
    function set(GatewayMessage calldata m) external { nextMessage = m; }
    function verifyGatewayMessage(bytes calldata, uint64, bytes32, bytes32) external view returns (GatewayMessage memory) {
        return nextMessage;
    }
}

contract QcadEthereumRouterCaller420 {
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

/// @notice V12.5.20 qualification: trust-era QCAD is the canonical Ethereum ERC-20 asset over the existing ETH adapter.
contract QcadBridgeAdapter420Test {
    address private constant QCAD_ETHEREUM = 0x3fa142dd3f384414e05e71ad0939274edc82ec0a;
    address private constant LEGACY_QCAD_ETHEREUM = 0x4A16BAf414b8e637Ed12019faD5Dd705735DB2e0;
    address private constant GATEWAY = address(0x420420);
    bytes32 private constant QCAD_ASSET = keccak256("420/BRIDGE/ASSET/QCAD");
    bytes32 private constant QCAD_ROUTE = keccak256("420/BRIDGE/ROUTE/QCAD/ETHEREUM/MAINNET");
    uint256 private constant ONE_QCAD = 1_000_000;

    QcadEthereumFinalityOracleMock420 private oracle;
    QcadEthereumGatewayMessageVerifierMock420 private messageVerifier;
    EthereumFinalityVerifier420 private verifier;
    QcadEthereumRouterCaller420 private router;
    EthereumBridgeAdapter420 private adapter;

    constructor() {
        oracle = new QcadEthereumFinalityOracleMock420();
        messageVerifier = new QcadEthereumGatewayMessageVerifierMock420();
        verifier = new EthereumFinalityVerifier420(address(this), address(oracle), address(messageVerifier));
        router = new QcadEthereumRouterCaller420();
        adapter = new EthereumBridgeAdapter420(address(this), address(router), address(verifier));

        adapter.setGateway(GATEWAY, true);
        adapter.setAssetMapping(adapter.sourceAssetKey(QCAD_ETHEREUM), QCAD_ASSET, true);
        adapter.setRouteBinding(QCAD_ASSET, QCAD_ROUTE);
        _setMessage(keccak256("qcad-message-1"));
    }

    function testCanonicalQcadEthereumInboundPasses() public {
        IBridgeAdapter420.VerifiedTransfer memory v = router.inbound(adapter, _proof());
        require(v.routeId == QCAD_ROUTE, "route");
        require(v.assetId == QCAD_ASSET, "asset");
        require(v.sender == address(0xA11CE), "sender");
        require(v.recipient == address(0xB0B), "recipient");
        require(v.amount == 420 * ONE_QCAD, "amount");
    }

    function testLegacyQcadTokenRejected() public {
        IEthereumGatewayMessageVerifier420.GatewayMessage memory m = _message(keccak256("legacy-qcad-token"));
        m.sourceToken = LEGACY_QCAD_ETHEREUM;
        messageVerifier.set(m);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, _proof())));
        require(!ok, "legacy QCAD token accepted");
    }

    function testWrongQcadTokenRejected() public {
        IEthereumGatewayMessageVerifier420.GatewayMessage memory m = _message(keccak256("wrong-qcad-token"));
        m.sourceToken = address(0xBAD20);
        messageVerifier.set(m);
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, _proof())));
        require(!ok, "wrong QCAD token accepted");
    }

    function testQcadReplayRejected() public {
        _setMessage(keccak256("qcad-replay"));
        router.inbound(adapter, _proof());
        (bool ok,) = address(router).call(abi.encodeCall(router.inbound, (adapter, _proof())));
        require(!ok, "QCAD replay accepted");
    }

    function testQcadOutboundUsesEthereumRoute() public {
        bytes memory recipient = abi.encodePacked(address(0xCAFE));
        bytes32 messageId = router.outbound(adapter, QCAD_ROUTE, QCAD_ASSET, address(this), recipient, 42 * ONE_QCAD);
        require(messageId != bytes32(0), "message");
    }

    function testQcadDifferentRouteRejected() public {
        bytes memory recipient = abi.encodePacked(address(0xCAFE));
        (bool ok,) = address(router).call(
            abi.encodeCall(
                router.outbound,
                (adapter, keccak256("420/BRIDGE/ROUTE/QCAD/WRONG"), QCAD_ASSET, address(this), recipient, 42 * ONE_QCAD)
            )
        );
        require(!ok, "wrong QCAD route accepted");
    }

    function _proof() private pure returns (bytes memory) {
        return abi.encode(uint64(22_000_000), keccak256("qcad-eth-block"), keccak256("qcad-receipts-root"), bytes("receipt-proof"));
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
            sourceToken: QCAD_ETHEREUM,
            sourceSender: address(0xA11CE),
            recipient: address(0xB0B),
            amount: 420 * ONE_QCAD,
            transactionHash: keccak256(abi.encode("qcad-eth-tx", messageId))
        });
    }
}
