// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Verifier boundary for canonical PotCoin mainnet bridge messages.
/// @dev Production implementations must validate the native PotCoin header/stake chain,
///      finalized transaction inclusion, canonical gateway-script output and UTXO spend provenance.
interface IPotcoinFinalityVerifier420 {
    struct FinalizedTransfer {
        bytes32 networkId;
        uint64 blockHeight;
        bytes32 blockHash;
        bytes32 transactionHash;
        bytes32 messageId;
        bytes32 gatewayScriptHash;
        bytes32 sourceOutput;
        address recipient;
        uint256 amountPotSatoshis;
        bool proofOfStake;
        bool finalized;
    }

    function verifyFinalizedTransfer(bytes calldata proof)
        external view
        returns (FinalizedTransfer memory transfer_);
}
