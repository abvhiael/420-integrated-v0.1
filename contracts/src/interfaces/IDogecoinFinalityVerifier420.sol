// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Verifier boundary for canonical Dogecoin mainnet bridge messages.
/// @dev Production implementations must validate Dogecoin PoW/AuxPoW header-chain work,
///      transaction inclusion and the configured confirmation/finality policy before returning a transfer.
interface IDogecoinFinalityVerifier420 {
    struct FinalizedTransfer {
        bytes32 genesisHash;
        bytes4 messageStart;
        uint64 blockHeight;
        bytes32 blockHash;
        bytes32 transactionHash;
        bytes32 messageId;
        bytes32 sourceOutput;
        address recipient;
        uint256 amount;
        bool finalized;
    }

    function verifyFinalizedTransfer(bytes calldata proof) external view returns (FinalizedTransfer memory transfer_);
}
