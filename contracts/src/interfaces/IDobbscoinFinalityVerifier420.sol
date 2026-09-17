// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Verifier boundary for canonical Dobbscoin mainnet bridge messages.
/// @dev Production implementations must validate Dobbscoin header-chain work, LWMA/emergency-difficulty
///      rules, transaction inclusion, canonical bridge output and the configured confirmation policy.
///      At/after the AuxPoW activation height they must additionally validate the AuxPoW commitment and
///      parent-chain scrypt proof according to Dobbscoin chain-id separation rules.
interface IDobbscoinFinalityVerifier420 {
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
        uint32 confirmations;
        bool finalized;
        bool auxPowValidated;
    }

    function verifyFinalizedTransfer(bytes calldata proof)
        external view returns (FinalizedTransfer memory transfer_);
}
