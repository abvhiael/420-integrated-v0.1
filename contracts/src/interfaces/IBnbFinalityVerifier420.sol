// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Verifier boundary for finalized BNB Smart Chain bridge messages.
/// @dev Implementations may use a light client, zk proof, quorum attestation, or another governance-approved verifier,
///      but must return only messages proven against canonical BNB Smart Chain mainnet identity.
interface IBnbFinalityVerifier420 {
    struct FinalizedTransfer {
        uint256 sourceChainId;
        uint64 blockNumber;
        bytes32 blockHash;
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
