// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/EthereumBridgeAdapter420.sol";
import "../src/bridge/adapters/SolanaBridgeAdapter420.sol";
import "../src/interfaces/IEthereumFinalityVerifier420.sol";
import "../src/interfaces/ISolanaFinalityVerifier420.sol";

contract RotationEthereumVerifierMock420 is IEthereumFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata transfer_) external { nextTransfer = transfer_; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract RotationSolanaVerifierMock420 is ISolanaFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata transfer_) external { nextTransfer = transfer_; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract RotationRouterCaller420 {
    function ethInbound(EthereumBridgeAdapter420 adapter) external returns (IBridgeAdapter420.VerifiedTransfer memory) {
        return adapter.verifyInbound(hex"01");
    }
    function solInbound(SolanaBridgeAdapter420 adapter) external returns (IBridgeAdapter420.VerifiedTransfer memory) {
        return adapter.verifyInbound(hex"02");
    }
}

contract UnauthorizedVerifierRotator420 {
    function rotateEth(EthereumBridgeAdapter420 adapter, address verifier_) external { adapter.setVerifier(verifier_); }
    function rotateSol(SolanaBridgeAdapter420 adapter, address verifier_) external { adapter.setVerifier(verifier_); }
}

/// @notice V12.6.3 verifier rotation and authorization hardening.
contract VerifierRotationHardening420Test {
    address private constant ETH_GATEWAY = address(0x420420);
    address private constant ETH_TOKEN = address(0xE420);
    bytes32 private constant ETH_ASSET = keccak256("420/BRIDGE/ASSET/ROTATION/ETH");
    bytes32 private constant ETH_ROUTE = keccak256("420/BRIDGE/ROUTE/ROTATION/ETH");

    bytes32 private constant SOL_PROGRAM = keccak256("420/BRIDGE/GATEWAY/ROTATION/SOL");
    bytes32 private constant SOL_MINT = keccak256("420/BRIDGE/SOLANA/ROTATION/MINT");
    bytes32 private constant SOL_ASSET = keccak256("420/BRIDGE/ASSET/ROTATION/SOL");
    bytes32 private constant SOL_ROUTE = keccak256("420/BRIDGE/ROUTE/ROTATION/SOL");
    bytes32 private constant SOL_OWNER = bytes32(uint256(0xA11CE));

    RotationEthereumVerifierMock420 private oldEthVerifier;
    RotationEthereumVerifierMock420 private newEthVerifier;
    RotationSolanaVerifierMock420 private oldSolVerifier;
    RotationSolanaVerifierMock420 private newSolVerifier;
    RotationRouterCaller420 private router;
    UnauthorizedVerifierRotator420 private attacker;
    EthereumBridgeAdapter420 private ethAdapter;
    SolanaBridgeAdapter420 private solAdapter;

    constructor() {
        oldEthVerifier = new RotationEthereumVerifierMock420();
        newEthVerifier = new RotationEthereumVerifierMock420();
        oldSolVerifier = new RotationSolanaVerifierMock420();
        newSolVerifier = new RotationSolanaVerifierMock420();
        router = new RotationRouterCaller420();
        attacker = new UnauthorizedVerifierRotator420();

        ethAdapter = new EthereumBridgeAdapter420(address(this), address(router), address(oldEthVerifier));
        solAdapter = new SolanaBridgeAdapter420(address(this), address(router), address(oldSolVerifier));

        ethAdapter.setGateway(ETH_GATEWAY, true);
        ethAdapter.setAssetMapping(ethAdapter.sourceAssetKey(ETH_TOKEN), ETH_ASSET, true);
        ethAdapter.setRouteBinding(ETH_ASSET, ETH_ROUTE);

        solAdapter.setGatewayProgram(SOL_PROGRAM, true);
        solAdapter.setAssetMapping(SOL_MINT, SOL_ASSET, true);
        solAdapter.setRouteBinding(SOL_ASSET, SOL_ROUTE);
    }

    function testUnauthorizedVerifierRotationRejected() public {
        (bool ethOk,) = address(attacker).call(abi.encodeCall(attacker.rotateEth, (ethAdapter, address(newEthVerifier))));
        (bool solOk,) = address(attacker).call(abi.encodeCall(attacker.rotateSol, (solAdapter, address(newSolVerifier))));
        require(!ethOk, "unauthorized eth rotation accepted");
        require(!solOk, "unauthorized sol rotation accepted");
        require(address(ethAdapter.verifier()) == address(oldEthVerifier), "eth verifier changed");
        require(address(solAdapter.verifier()) == address(oldSolVerifier), "sol verifier changed");
    }

    function testZeroAndEoaVerifierRotationRejected() public {
        (bool ethZero,) = address(ethAdapter).call(abi.encodeCall(ethAdapter.setVerifier, (address(0))));
        (bool solZero,) = address(solAdapter).call(abi.encodeCall(solAdapter.setVerifier, (address(0))));
        require(!ethZero && !solZero, "zero verifier accepted");

        address eoaLike = address(0xBEEF);
        (bool ethEoa,) = address(ethAdapter).call(abi.encodeCall(ethAdapter.setVerifier, (eoaLike)));
        (bool solEoa,) = address(solAdapter).call(abi.encodeCall(solAdapter.setVerifier, (eoaLike)));
        require(!ethEoa && !solEoa, "EOA verifier accepted");
    }

    function testGovernanceCanRotateVerifiers() public {
        ethAdapter.setVerifier(address(newEthVerifier));
        solAdapter.setVerifier(address(newSolVerifier));
        require(address(ethAdapter.verifier()) == address(newEthVerifier), "eth rotation missing");
        require(address(solAdapter.verifier()) == address(newSolVerifier), "sol rotation missing");
    }

    function testRotationTransfersEthereumProofAuthorityToNewVerifier() public {
        bytes32 oldMessage = keccak256("rotation-old-eth");
        bytes32 newMessage = keccak256("rotation-new-eth");
        oldEthVerifier.set(_ethTransfer(oldMessage, true));
        newEthVerifier.set(_ethTransfer(newMessage, true));

        ethAdapter.setVerifier(address(newEthVerifier));
        IBridgeAdapter420.VerifiedTransfer memory v = router.ethInbound(ethAdapter);
        require(v.sourceMessageId == newMessage, "old eth verifier retained authority");
        require(!ethAdapter.consumedMessages(oldMessage), "old eth message consumed");
        require(ethAdapter.consumedMessages(newMessage), "new eth message not consumed");
    }

    function testRotationTransfersSolanaProofAuthorityToNewVerifier() public {
        bytes32 oldMessage = keccak256("rotation-old-sol");
        bytes32 newMessage = keccak256("rotation-new-sol");
        oldSolVerifier.set(_solTransfer(oldMessage, true));
        newSolVerifier.set(_solTransfer(newMessage, true));

        solAdapter.setVerifier(address(newSolVerifier));
        IBridgeAdapter420.VerifiedTransfer memory v = router.solInbound(solAdapter);
        require(v.sourceMessageId == newMessage, "old sol verifier retained authority");
        require(!solAdapter.consumedMessages(oldMessage), "old sol message consumed");
        require(solAdapter.consumedMessages(newMessage), "new sol message not consumed");
    }

    function _ethTransfer(bytes32 messageId, bool finalized)
        private view returns (IEthereumFinalityVerifier420.FinalizedTransfer memory p)
    {
        p = IEthereumFinalityVerifier420.FinalizedTransfer({
            sourceChainId: ethAdapter.ETHEREUM_MAINNET_CHAIN_ID(),
            blockNumber: 22_000_001,
            blockHash: keccak256("rotation-eth-block"),
            receiptsRoot: keccak256("rotation-eth-receipts"),
            transactionHash: keccak256(abi.encode("rotation-eth-tx", messageId)),
            messageId: messageId,
            gateway: ETH_GATEWAY,
            sourceToken: ETH_TOKEN,
            sourceSender: address(0xA11CE),
            recipient: address(0xB0B),
            amount: 420_000_000,
            finalized: finalized
        });
    }

    function _solTransfer(bytes32 messageId, bool finalized)
        private view returns (ISolanaFinalityVerifier420.FinalizedTransfer memory p)
    {
        p = ISolanaFinalityVerifier420.FinalizedTransfer({
            genesisHash: solAdapter.SOLANA_MAINNET_GENESIS_HASH(),
            slot: 250_000_001,
            transactionSignature: keccak256(abi.encode("rotation-sol-tx", messageId)),
            messageId: messageId,
            gatewayProgram: SOL_PROGRAM,
            sourceAsset: SOL_MINT,
            sourceOwner: SOL_OWNER,
            recipient: address(0xB0B),
            amount: 420_000_000,
            finalized: finalized
        });
    }
}
