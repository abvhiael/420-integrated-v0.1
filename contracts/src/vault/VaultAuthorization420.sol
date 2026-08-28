// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./VaultIds420.sol";

contract VaultAuthorization420 is I420System {
    ICapabilityRegistry420 public immutable capabilityRegistry;

    error ZeroAddress();

    constructor(address capabilityRegistry_) {
        if (capabilityRegistry_ == address(0)) revert ZeroAddress();
        capabilityRegistry = ICapabilityRegistry420(capabilityRegistry_);
    }

    function systemName() external pure returns (string memory) { return "VaultAuthorization420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function scopeForVault(bytes32 vaultId) public pure returns (bytes32) {
        return keccak256(abi.encode(vaultId));
    }

    function scopeForRoute(bytes32 vaultId, address asset, address recipient, bytes32 actionClass) public pure returns (bytes32) {
        return keccak256(abi.encode(vaultId, asset, recipient, actionClass));
    }

    function isAuthorized(address principal, bytes32 vaultId, bytes32 actionId, uint256 amount) external view returns (bool) {
        return capabilityRegistry.isAuthorized(
            principal,
            VaultIds420.COMPONENT_VAULT,
            actionId,
            scopeForVault(vaultId),
            amount
        );
    }

    function isRouteAuthorized(
        address principal,
        bytes32 vaultId,
        bytes32 actionId,
        address asset,
        address recipient,
        uint256 amount
    ) external view returns (bool) {
        return capabilityRegistry.isAuthorized(
            principal,
            VaultIds420.COMPONENT_VAULT,
            actionId,
            scopeForRoute(vaultId, asset, recipient, actionId),
            amount
        );
    }
}