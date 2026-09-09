// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../interfaces/IEthereumFinalityOracle420.sol";
import "../../interfaces/IEthereumGatewayMessageVerifier420.sol";
import "../../interfaces/IEthereumFinalityVerifier420.sol";
import "../../system/SystemAccess.sol";

/// @notice Production composition boundary for Ethereum mainnet bridge proofs.
/// @dev A transfer is accepted only when the execution block is finalized by the configured light-client/oracle
///      AND the canonical gateway message is proven against that exact block receipts root.
contract EthereumFinalityVerifier420 is IEthereumFinalityVerifier420, SystemAccess {
    uint256 public constant ETHEREUM_MAINNET_CHAIN_ID = 1;

    IEthereumFinalityOracle420 public finalityOracle;
    IEthereumGatewayMessageVerifier420 public messageVerifier;

    error InvalidVerifier();
    error InvalidEnvelope();
    error BlockNotFinalized();
    error InvalidMessage();

    event FinalityOracleSet(address indexed oracle);
    event MessageVerifierSet(address indexed verifier);

    constructor(address governanceTimelock_, address finalityOracle_, address messageVerifier_)
        SystemAccess(governanceTimelock_)
    {
        _setFinalityOracle(finalityOracle_);
        _setMessageVerifier(messageVerifier_);
    }

    function setFinalityOracle(address oracle_) external onlyGovernance { _setFinalityOracle(oracle_); }
    function setMessageVerifier(address verifier_) external onlyGovernance { _setMessageVerifier(verifier_); }

    function verifyFinalizedTransfer(bytes calldata proof) external view returns (FinalizedTransfer memory transfer_) {
        (uint64 blockNumber, bytes32 blockHash, bytes32 receiptsRoot, bytes memory messageProof) =
            abi.decode(proof, (uint64, bytes32, bytes32, bytes));

        if (blockNumber == 0 || blockHash == bytes32(0) || receiptsRoot == bytes32(0) || messageProof.length == 0) {
            revert InvalidEnvelope();
        }
        if (!finalityOracle.isFinalizedExecutionBlock(blockNumber, blockHash, receiptsRoot)) revert BlockNotFinalized();

        IEthereumGatewayMessageVerifier420.GatewayMessage memory m =
            messageVerifier.verifyGatewayMessage(messageProof, blockNumber, blockHash, receiptsRoot);
        if (
            m.messageId == bytes32(0) || m.gateway == address(0) || m.sourceSender == address(0)
                || m.recipient == address(0) || m.amount == 0 || m.transactionHash == bytes32(0)
        ) revert InvalidMessage();

        transfer_ = FinalizedTransfer({
            sourceChainId: ETHEREUM_MAINNET_CHAIN_ID,
            blockNumber: blockNumber,
            blockHash: blockHash,
            receiptsRoot: receiptsRoot,
            transactionHash: m.transactionHash,
            messageId: m.messageId,
            gateway: m.gateway,
            sourceToken: m.sourceToken,
            sourceSender: m.sourceSender,
            recipient: m.recipient,
            amount: m.amount,
            finalized: true
        });
    }

    function _setFinalityOracle(address oracle_) private {
        if (oracle_ == address(0) || oracle_.code.length == 0) revert InvalidVerifier();
        finalityOracle = IEthereumFinalityOracle420(oracle_);
        emit FinalityOracleSet(oracle_);
    }

    function _setMessageVerifier(address verifier_) private {
        if (verifier_ == address(0) || verifier_.code.length == 0) revert InvalidVerifier();
        messageVerifier = IEthereumGatewayMessageVerifier420(verifier_);
        emit MessageVerifierSet(verifier_);
    }
}
