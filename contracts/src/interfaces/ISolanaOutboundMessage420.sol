// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
/// @notice Public 420-to-Solana request transport, not source-finality or withdrawal authority.
interface ISolanaOutboundMessage420 {
    struct OutboundMessage {
        uint256 sourceChainId;
        address sourceRouter;
        address sourceAdapter;
        bytes32 messageId;
        bytes32 routeId;
        bytes32 assetId;
        address sender;
        bytes32 recipient;
        uint256 localAmount;
        uint64 solanaAmount;
        bytes32 solanaAsset;
        uint256 nonce;
        bytes extra;
    }
    function outboundMessage(bytes32 messageId) external view returns (OutboundMessage memory);
    /// @notice 420SREQ1 public message bytes; not an instruction accepted by the deposit-only SBF program.
    /// A custody provider must authenticate finalized backing, source/domain/program/account identities
    /// and persistent replay independently before constructing its authorized release instruction.
    function outboundMessageData(bytes32 messageId) external view returns (bytes memory);
}
