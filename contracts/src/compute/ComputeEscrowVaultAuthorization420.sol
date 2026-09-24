// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "../vault/VaultIds420.sol";

/// @notice Dedicated CMP Vault authorization fence. Never install on an ordinary/shared Vault.
/// @dev AssetVault420 and VaultRegistry420 call the ABI of VaultAuthorization420; this
/// implementation has the same authorization and scope selectors, but refuses all grants
/// to non-CMP writers regardless of what the underlying capability authority issues.
/// The eventual settlement/refund controller must be separately qualified BEFORE live
/// funding; binding it here alone does not constitute an authorized payout implementation.
contract ComputeEscrowVaultAuthorization420 {
    ICapabilityRegistry420 public immutable capabilityRegistry;
    bytes32 public immutable protectedVaultId;
    address public immutable bindingAuthority;
    address public fundingAdapter;
    address public settlementController;
    bool public bindingsFrozen;

    error InvalidBinding();
    event BindingsFrozen(address indexed fundingAdapter, address indexed settlementController);

    constructor(address registry_, bytes32 vaultId_, address bindingAuthority_) {
        if (registry_.code.length == 0 || vaultId_ == bytes32(0) || bindingAuthority_ == address(0)) {
            revert InvalidBinding();
        }
        capabilityRegistry = ICapabilityRegistry420(registry_);
        protectedVaultId = vaultId_;
        bindingAuthority = bindingAuthority_;
    }

    /// @dev Both real deployed contracts must already exist; the authority gets one
    /// irreversible binding only. No binding changes can occur after payer funding.
    function freezeBindings(address funding_, address settlement_) external {
        if (msg.sender != bindingAuthority || bindingsFrozen || funding_.code.length == 0
            || settlement_.code.length == 0 || funding_ == settlement_) revert InvalidBinding();
        fundingAdapter = funding_;
        settlementController = settlement_;
        bindingsFrozen = true;
        emit BindingsFrozen(funding_, settlement_);
    }

    function scopeForVault(bytes32 vaultId) public pure returns (bytes32) {
        return keccak256(abi.encode(vaultId));
    }

    function scopeForRoute(bytes32 vaultId, address asset, address recipient, bytes32 actionClass)
        public pure returns (bytes32) {
        return keccak256(abi.encode(vaultId, asset, recipient, actionClass));
    }

    function isAuthorized(address principal, bytes32 vaultId, bytes32 actionId, uint256 amount)
        external view returns (bool) {
        if (vaultId == protectedVaultId) {
            if (!bindingsFrozen) return false;
            if (actionId == VaultIds420.ACTION_CREATE_OBLIGATION) {
                if (principal != fundingAdapter && principal != settlementController) return false;
            } else if (actionId == VaultIds420.ACTION_RELEASE_OBLIGATION
                || actionId == VaultIds420.ACTION_CANCEL_OBLIGATION) {
                if (principal != settlementController) return false;
            } else if (actionId == VaultIds420.ACTION_WITHDRAW
                || actionId == VaultIds420.ACTION_CLAIM) {
                // Beneficiaries may still claim their *own* immutable claimable obligation
                // using AssetVault420.claim()'s direct beneficiary path.
                return false;
            } else if (actionId != VaultIds420.ACTION_FREEZE
                && actionId != VaultIds420.ACTION_UNFREEZE
                && actionId != VaultIds420.ACTION_BEGIN_WIND_DOWN
                && actionId != VaultIds420.ACTION_CLOSE
                && actionId != VaultIds420.ACTION_UPDATE_METADATA) {
                return false;
            }
        }
        return capabilityRegistry.isAuthorized(principal, VaultIds420.COMPONENT_VAULT,
            actionId, scopeForVault(vaultId), amount);
    }

    function isRouteAuthorized(address principal, bytes32 vaultId, bytes32 actionId,
        address asset, address recipient, uint256 amount) external view returns (bool) {
        // No route grant, including one freshly issued by a rotated component authority,
        // can withdraw or redirect money from the dedicated CMP Vault.
        if (vaultId == protectedVaultId && (actionId == VaultIds420.ACTION_WITHDRAW
            || actionId == VaultIds420.ACTION_CLAIM)) return false;
        return capabilityRegistry.isAuthorized(principal, VaultIds420.COMPONENT_VAULT,
            actionId, scopeForRoute(vaultId, asset, recipient, actionId), amount);
    }
}
