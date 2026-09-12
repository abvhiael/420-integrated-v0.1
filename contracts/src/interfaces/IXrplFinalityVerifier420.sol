// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Proof boundary for canonical XRP Ledger mainnet bridge payments.
/// @dev Production implementations must prove membership in a validated ledger and a successful Payment result.
interface IXrplFinalityVerifier420 {
    struct FinalizedTransfer {
        uint32 ledgerIndex;
        bytes32 ledgerHash;
        bytes32 transactionRoot;
        bytes32 transactionHash;
        bytes32 messageId;
        bytes20 gatewayAccount;
        bytes20 sourceAccount;
        address recipient;
        uint256 amountDrops;
        uint32 destinationTag;
        bool hasDestinationTag;
        bool validated;
        bool tesSuccess;
    }

    function verifyFinalizedTransfer(bytes calldata proof) external view returns (FinalizedTransfer memory transfer_);
}
