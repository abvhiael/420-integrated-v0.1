// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./IEntryPoint420.sol";

/// @notice Post-operation outcome supplied by EntryPoint420 to a canonical 420Gas paymaster.
/// @dev GAS-1 freezes the interface only. EntryPoint420 does not invoke paymasters until GAS-2+.
enum PostOpMode420 {
    OpSucceeded,
    OpReverted
}

/// @notice Canonical 420 Integrated paymaster interface.
/// @dev A paymaster may decide whether to sponsor an already-formed UserOperation. It never
///      replaces Smart Account validation or grants target-protocol authority.
interface IPaymaster420 {
    /// @notice Validate sponsorship for an exact UserOperation and maximum native gas cost.
    /// @param userOp The immutable UserOperation being considered for sponsorship.
    /// @param userOpHash Canonical EntryPoint420 UserOperation hash.
    /// @param maxCostWei Maximum native $420 cost EntryPoint420 may charge to this sponsorship.
    /// @return context Opaque bounded context for later post-operation settlement.
    /// @return validationData ERC-4337-style validity data; 0 means valid with no additional window.
    function validatePaymasterUserOp(
        PackedUserOperation420 calldata userOp,
        bytes32 userOpHash,
        uint256 maxCostWei
    ) external returns (bytes memory context, uint256 validationData);

    /// @notice Settle bounded sponsorship accounting after account execution.
    /// @dev GAS-1 freezes this callback shape. GAS-4 defines settlement semantics before EntryPoint420
    ///      is permitted to rely on it for production accounting.
    function postOp(PostOpMode420 mode, bytes calldata context, uint256 actualGasCostWei) external;
}
