// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IEthereumFinalityVerifier420 {
    struct FinalizedTransfer {
        uint256 sourceChainId;
        uint64 blockNumber;
        bytes32 blockHash;
        bytes32 receiptsRoot;
        bytes32 transactionHash;
        bytes32 messageId;
        address gateway;
        address sourceToken;
        address sourceSender;
        address recipient;
        uint256 amount;
        bool finalized;
    }

    function verifyFinalizedTransfer(bytes calldata proof) external view returns (FinalizedTransfer memory transfer_);
}
