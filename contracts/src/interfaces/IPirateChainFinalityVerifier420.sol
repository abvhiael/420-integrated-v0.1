// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Verifier boundary for canonical Pirate Chain shielded bridge transfers.
/// @dev Production implementations must validate Pirate mainnet consensus/finality, the shielded
///      transaction, and gateway viewing-key evidence for the deposited note. Public chain data alone
///      does not reveal the recipient or amount for ordinary ARRR transfers.
interface IPirateChainFinalityVerifier420 {
    struct FinalizedTransfer {
        bytes32 networkId;
        uint64 blockHeight;
        bytes32 blockHash;
        bytes32 transactionHash;
        bytes32 messageId;
        bytes32 nullifier;
        bytes32 noteCommitment;
        bytes32 memoBindingHash;
        address recipient;
        uint256 amountArrrtoshi;
        uint32 confirmations;
        uint8 shieldedPool; // 0 = Sapling, 1 = Ironwood/Orchard
        bool equihashValidated;
        bool notarizationValidated;
        bool finalized;
    }

    function verifyFinalizedTransfer(bytes calldata proof)
        external view
        returns (FinalizedTransfer memory transfer_);
}
