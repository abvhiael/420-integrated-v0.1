
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Minimal genesis-system access base.
/// Governance authority is expected to be the GovernanceTimelock system contract.
/// This contract deliberately contains no hidden owner backdoor.
abstract contract SystemAccess {
    address public immutable governanceTimelock;

    error Unauthorized();
    error ZeroAddress();

    constructor(address timelock_) {
        if (timelock_ == address(0)) revert ZeroAddress();
        governanceTimelock = timelock_;
    }

    modifier onlyGovernance() {
        if (msg.sender != governanceTimelock) revert Unauthorized();
        _;
    }
}
