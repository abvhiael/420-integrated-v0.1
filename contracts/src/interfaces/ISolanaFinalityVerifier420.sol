// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Verifier boundary for finalized Solana bridge messages.
/// @dev Implementations may use a light client, zk proof, or another governance-approved verifier,
///      but must return only messages proven against the pinned Solana cluster identity.
interface ISolanaFinalityVerifier420 {
    struct FinalizedTransfer {
        bytes32 genesisHash;
        uint64 slot;
        bytes32 transactionSignature;
        bytes32 messageId;
        bytes32 gatewayProgram;
        bytes32 sourceAsset;
        bytes32 sourceOwner;
        address recipient;
        uint256 amount;
        bool finalized;
    }

    function verifyFinalizedTransfer(bytes calldata proof) external view returns (FinalizedTransfer memory transfer_);
}
