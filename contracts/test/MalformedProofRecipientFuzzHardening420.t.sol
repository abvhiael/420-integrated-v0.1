// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/EthereumBridgeAdapter420.sol";
import "../src/bridge/adapters/SolanaBridgeAdapter420.sol";
import "../src/interfaces/IEthereumFinalityVerifier420.sol";
import "../src/interfaces/ISolanaFinalityVerifier420.sol";

contract FuzzEthereumVerifierMock420 is IEthereumFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata transfer_) external { nextTransfer = transfer_; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract FuzzSolanaVerifierMock420 is ISolanaFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata transfer_) external { nextTransfer = transfer_; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract FuzzRouterCaller420 {
    function ethInbound(EthereumBridgeAdapter420 adapter) external returns (IBridgeAdapter420.VerifiedTransfer memory) {
        return adapter.verifyInbound(hex"01");
    }

    function solInbound(SolanaBridgeAdapter420 adapter) external returns (IBridgeAdapter420.VerifiedTransfer memory) {
        return adapter.verifyInbound(hex"02");
    }

    function ethOutbound(EthereumBridgeAdapter420 adapter, bytes32 routeId, bytes32 assetId, bytes calldata recipient)
        external returns (bytes32)
    {
        return adapter.initiateOutbound(routeId, assetId, address(this), recipient, 420, hex"31");
    }

    function solOutbound(SolanaBridgeAdapter420 adapter, bytes32 routeId, bytes32 assetId, bytes calldata recipient)
        external returns (bytes32)
    {
        return adapter.initiateOutbound(routeId, assetId, address(this), recipient, 420, hex"32");
    }
}

/// @notice V12.6.5 malformed-proof and recipient fuzz hardening.
contract MalformedProofRecipientFuzzHardening420Test {
    address private constant ETH_GATEWAY = address(0x420420);
    address private constant ETH_TOKEN = address(0xE420);
    bytes32 private constant ETH_ASSET = keccak256("420/BRIDGE/ASSET/FUZZ/ETH");
    bytes32 private constant ETH_ROUTE = keccak256("420/BRIDGE/ROUTE/FUZZ/ETH");

    bytes32 private constant SOL_PROGRAM = keccak256("420/BRIDGE/GATEWAY/FUZZ/SOL");
    bytes32 private constant SOL_MINT = keccak256("420/BRIDGE/SOLANA/FUZZ/MINT");
    bytes32 private constant SOL_ASSET = keccak256("420/BRIDGE/ASSET/FUZZ/SOL");
    bytes32 private constant SOL_ROUTE = keccak256("420/BRIDGE/ROUTE/FUZZ/SOL");
    bytes32 private constant SOL_OWNER = bytes32(uint256(0xA11CE));

    FuzzEthereumVerifierMock420 private ethVerifier;
    FuzzSolanaVerifierMock420 private solVerifier;
    FuzzRouterCaller420 private router;
    EthereumBridgeAdapter420 private ethAdapter;
    SolanaBridgeAdapter420 private solAdapter;

    constructor() {
        ethVerifier = new FuzzEthereumVerifierMock420();
        solVerifier = new FuzzSolanaVerifierMock420();
        router = new FuzzRouterCaller420();

        ethAdapter = new EthereumBridgeAdapter420(address(this), address(router), address(ethVerifier));
        solAdapter = new SolanaBridgeAdapter420(address(this), address(router), address(solVerifier));

        ethAdapter.setGateway(ETH_GATEWAY, true);
        ethAdapter.setAssetMapping(ethAdapter.sourceAssetKey(ETH_TOKEN), ETH_ASSET, true);
        ethAdapter.setRouteBinding(ETH_ASSET, ETH_ROUTE);

        solAdapter.setGatewayProgram(SOL_PROGRAM, true);
        solAdapter.setAssetMapping(SOL_MINT, SOL_ASSET, true);
        solAdapter.setRouteBinding(SOL_ASSET, SOL_ROUTE);
    }

    function testFuzzEthereumMalformedMandatoryFieldRejected(uint8 selector, bytes32 entropy) public {
        bytes32 messageId = keccak256(abi.encode("fuzz-eth-proof", selector, entropy));
        IEthereumFinalityVerifier420.FinalizedTransfer memory p = _ethTransfer(messageId);
        uint8 field = selector % 10;

        if (field == 0) p.blockNumber = 0;
        else if (field == 1) p.blockHash = bytes32(0);
        else if (field == 2) p.receiptsRoot = bytes32(0);
        else if (field == 3) p.transactionHash = bytes32(0);
        else if (field == 4) p.messageId = bytes32(0);
        else if (field == 5) p.gateway = address(0);
        else if (field == 6) p.sourceSender = address(0);
        else if (field == 7) p.recipient = address(0);
        else if (field == 8) p.amount = 0;
        else p.finalized = false;

        ethVerifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.ethInbound, (ethAdapter)));
        require(!ok, "malformed eth proof accepted");
        if (messageId != bytes32(0)) require(!ethAdapter.consumedMessages(messageId), "malformed eth proof consumed replay");
    }

    function testFuzzSolanaMalformedMandatoryFieldRejected(uint8 selector, bytes32 entropy) public {
        bytes32 messageId = keccak256(abi.encode("fuzz-sol-proof", selector, entropy));
        ISolanaFinalityVerifier420.FinalizedTransfer memory p = _solTransfer(messageId);
        uint8 field = selector % 9;

        if (field == 0) p.slot = 0;
        else if (field == 1) p.transactionSignature = bytes32(0);
        else if (field == 2) p.messageId = bytes32(0);
        else if (field == 3) p.gatewayProgram = bytes32(0);
        else if (field == 4) p.sourceAsset = bytes32(0);
        else if (field == 5) p.sourceOwner = bytes32(0);
        else if (field == 6) p.recipient = address(0);
        else if (field == 7) p.amount = 0;
        else p.finalized = false;

        solVerifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.solInbound, (solAdapter)));
        require(!ok, "malformed sol proof accepted");
        if (messageId != bytes32(0)) require(!solAdapter.consumedMessages(messageId), "malformed sol proof consumed replay");
    }

    function testFuzzEthereumWrongChainRejected(uint256 wrongChain, bytes32 entropy) public {
        if (wrongChain == ethAdapter.ETHEREUM_MAINNET_CHAIN_ID()) return;
        bytes32 messageId = keccak256(abi.encode("fuzz-eth-chain", wrongChain, entropy));
        IEthereumFinalityVerifier420.FinalizedTransfer memory p = _ethTransfer(messageId);
        p.sourceChainId = wrongChain;
        ethVerifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.ethInbound, (ethAdapter)));
        require(!ok, "wrong eth chain accepted");
        require(!ethAdapter.consumedMessages(messageId), "wrong eth chain consumed replay");
    }

    function testFuzzSolanaWrongGenesisRejected(bytes32 wrongGenesis, bytes32 entropy) public {
        if (wrongGenesis == solAdapter.SOLANA_MAINNET_GENESIS_HASH()) return;
        bytes32 messageId = keccak256(abi.encode("fuzz-sol-genesis", wrongGenesis, entropy));
        ISolanaFinalityVerifier420.FinalizedTransfer memory p = _solTransfer(messageId);
        p.genesisHash = wrongGenesis;
        solVerifier.set(p);
        (bool ok,) = address(router).call(abi.encodeCall(router.solInbound, (solAdapter)));
        require(!ok, "wrong sol genesis accepted");
        require(!solAdapter.consumedMessages(messageId), "wrong sol genesis consumed replay");
    }

    function testFuzzEthereumRecipientLength(bytes calldata recipient) public {
        uint256 nonceBefore = ethAdapter.outboundNonce();
        (bool ok, bytes memory data) = address(router).call(
            abi.encodeCall(router.ethOutbound, (ethAdapter, ETH_ROUTE, ETH_ASSET, recipient))
        );
        if (recipient.length == 20) {
            require(ok, "canonical eth recipient rejected");
            require(data.length >= 32, "missing eth message id");
            require(ethAdapter.outboundNonce() == nonceBefore + 1, "eth nonce did not advance once");
        } else {
            require(!ok, "malformed eth recipient accepted");
            require(ethAdapter.outboundNonce() == nonceBefore, "malformed eth recipient advanced nonce");
        }
    }

    function testFuzzSolanaRecipientLength(bytes calldata recipient) public {
        uint256 nonceBefore = solAdapter.outboundNonce();
        (bool ok, bytes memory data) = address(router).call(
            abi.encodeCall(router.solOutbound, (solAdapter, SOL_ROUTE, SOL_ASSET, recipient))
        );
        if (recipient.length == 32) {
            require(ok, "canonical sol recipient rejected");
            require(data.length >= 32, "missing sol message id");
            require(solAdapter.outboundNonce() == nonceBefore + 1, "sol nonce did not advance once");
        } else {
            require(!ok, "malformed sol recipient accepted");
            require(solAdapter.outboundNonce() == nonceBefore, "malformed sol recipient advanced nonce");
        }
    }

    function _ethTransfer(bytes32 messageId)
        private view returns (IEthereumFinalityVerifier420.FinalizedTransfer memory p)
    {
        p = IEthereumFinalityVerifier420.FinalizedTransfer({
            sourceChainId: ethAdapter.ETHEREUM_MAINNET_CHAIN_ID(),
            blockNumber: 22_000_005,
            blockHash: keccak256("fuzz-eth-block"),
            receiptsRoot: keccak256("fuzz-eth-receipts"),
            transactionHash: keccak256(abi.encode("fuzz-eth-tx", messageId)),
            messageId: messageId,
            gateway: ETH_GATEWAY,
            sourceToken: ETH_TOKEN,
            sourceSender: address(0xA11CE),
            recipient: address(0xB0B),
            amount: 420_000_000,
            finalized: true
        });
    }

    function _solTransfer(bytes32 messageId)
        private view returns (ISolanaFinalityVerifier420.FinalizedTransfer memory p)
    {
        p = ISolanaFinalityVerifier420.FinalizedTransfer({
            genesisHash: solAdapter.SOLANA_MAINNET_GENESIS_HASH(),
            slot: 250_000_005,
            transactionSignature: keccak256(abi.encode("fuzz-sol-tx", messageId)),
            messageId: messageId,
            gatewayProgram: SOL_PROGRAM,
            sourceAsset: SOL_MINT,
            sourceOwner: SOL_OWNER,
            recipient: address(0xB0B),
            amount: 420_000_000,
            finalized: true
        });
    }
}
