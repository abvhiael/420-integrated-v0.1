// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Verifier boundary for canonical Litecoin mainnet bridge transfers.
/// @dev Production implementations must validate Litecoin scrypt PoW/header-chain work,
///      transaction inclusion, source-output ownership and the configured confirmation policy.
///      MWEB transfers are intentionally excluded from the Genesis route.
interface ILitecoinFinalityVerifier420 {
    struct FinalizedTransfer {
        bytes32 genesisHash;
        bytes4 messageStart;
        uint64 blockHeight;
        bytes32 blockHash;
        bytes32 transactionHash;
        bytes32 messageId;
        bytes32 sourceOutput;
        address recipient;
        uint256 amountLitoshis;
        uint32 confirmations;
        bool scryptPowValidated;
        bool chainWorkValidated;
        bool mweb;
        bool finalized;
    }

    function verifyFinalizedTransfer(bytes calldata proof)
        external view
        returns (FinalizedTransfer memory transfer_);
}
