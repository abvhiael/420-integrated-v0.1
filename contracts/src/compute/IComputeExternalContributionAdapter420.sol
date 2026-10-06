// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Minimal provider-neutral identity surface shared by CMP-5 external compute adapters.
/// @dev This interface conveys adapter/system/protocol identity only. It grants no attestation,
/// verification, reward, settlement, stake/slash, registry, or duplicate-prevention authority.
interface IComputeExternalContributionAdapter420 {
    function adapterKind() external view returns (bytes32);
    function externalSystemId() external view returns (bytes32);
    function protocolCommitment() external view returns (bytes32);
}
