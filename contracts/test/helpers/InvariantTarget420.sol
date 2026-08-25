// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Minimal local invariant-target helper matching Forge StdInvariant's
/// targetContract/targetContracts contract-level configuration mechanism.
/// @dev This is intentionally not a VM cheatcode. Forge reads targetContracts()
/// from the invariant test contract when constructing its fuzz campaign.
abstract contract InvariantTarget420 {
    address[] private _targetedContracts;

    function targetContract(address target) internal {
        _targetedContracts.push(target);
    }

    function targetContracts() public view returns (address[] memory targets) {
        targets = _targetedContracts;
    }
}
