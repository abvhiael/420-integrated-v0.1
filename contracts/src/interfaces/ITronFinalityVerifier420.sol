// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Verifier boundary for canonical TRON mainnet bridge messages.
/// @dev Production implementations must prove that the transaction is included in a solidified TRON block,
///      bind it to the canonical TRON mainnet domain, and validate the final execution result.
interface ITronFinalityVerifier420 {
    struct FinalizedTransfer {
        bytes32 networkId;
        uint64 blockNumber;
        bytes32 blockHash;
        bytes32 transactionHash;
        bytes32 messageId;
        bytes20 gatewayAccount;
        bytes20 sourceAccount;
        address recipient;
        uint256 amountSun;
        bool solidified;
        bool executionSuccess;
    }

    function verifyFinalizedTransfer(bytes calldata proof) external view returns (FinalizedTransfer memory transfer_);
}
