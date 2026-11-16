// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./IEthereumOutboundMessage420.sol";

/// @notice Ethereum custody-provider boundary for a finalized, backed withdrawal.
/// @dev Implementations MUST authenticate the approved source chain/router/adapter and full request,
/// finalized burn/escrow backing, route/token/amount/recipient and gateway domain before release.
/// A request event, its hash, an RPC finality flag or caller-supplied payload is NOT that evidence.
/// Production implementations and custody authority require independent deployment qualification.
interface IEthereumSourceGatewaySettlement420 {
    function settleEthereumWithdrawal(
        IEthereumOutboundMessage420.OutboundMessage calldata request,
        bytes calldata finalizedBackingProof
    ) external returns (bytes32 settlementId);

    /// @notice Authenticated successful delivery; implementations preserve replay across rotation.
    function settlementEvidence(bytes32 messageId)
        external view returns (address token, address recipient, uint256 amount, bytes32 evidenceHash);
}
