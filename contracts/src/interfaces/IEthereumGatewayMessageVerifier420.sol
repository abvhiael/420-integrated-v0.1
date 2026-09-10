// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Verifies inclusion/decoding of one canonical 420 gateway message in an Ethereum receipts root.
interface IEthereumGatewayMessageVerifier420 {
    struct GatewayMessage {
        bytes32 messageId;
        address gateway;
        address sourceToken;
        address sourceSender;
        address recipient;
        uint256 amount;
        bytes32 transactionHash;
    }

    function verifyGatewayMessage(
        bytes calldata proof,
        uint64 blockNumber,
        bytes32 blockHash,
        bytes32 receiptsRoot
    ) external view returns (GatewayMessage memory message_);
}
