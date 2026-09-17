// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Verifier boundary for canonical Curecoin mainnet bridge transfers.
/// @dev Production implementations must validate Curecoin PoS header-chain trust/finality,
///      transaction inclusion and the canonical gateway output. Folding@home reward accounting
///      is intentionally outside this bridge verifier boundary.
interface ICurecoinFinalityVerifier420 {
    struct FinalizedTransfer {
        bytes32 genesisHash;
        bytes4 messageStart;
        uint64 blockHeight;
        bytes32 blockHash;
        bytes32 transactionHash;
        bytes32 messageId;
        bytes32 gatewayScriptHash;
        bytes32 sourceOutput;
        address recipient;
        uint256 amount;
        bool proofOfStake;
        bool finalized;
    }

    function verifyFinalizedTransfer(bytes calldata proof) external view returns (FinalizedTransfer memory transfer_);
}
