// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../apps/ProtocolRegistry.sol";
import "../libraries/ServiceIds420.sol";
import "../vault/AssetVault420.sol";
import "../vault/VaultRouter420.sol";
import "../vault/VaultIds420.sol";
import "./TreasuryRouter420.sol";

/// @notice Read-only binding of a Treasury disbursement to the canonical Vault release target.
/// @dev The caller must supply its trusted canonical ProtocolRegistry, not an untrusted client
///      registry. This is a preflight, not custody, a capability grant or proof of a release.
library TreasuryVaultBinding420 {
    struct ReleaseTarget {
        bytes32 vaultId;
        AssetVault420 vault;
        address asset;
        address recipient;
        uint128 amount;
    }

    error InvalidServiceBinding();
    error InvalidVaultBinding();
    error IneligibleDisbursement();
    error InsufficientVaultFreeBalance();

    function resolveRelease(
        ProtocolRegistry registry,
        bytes32 id
    ) internal view returns (ReleaseTarget memory target) {
        TreasuryRouter420 treasury = TreasuryRouter420(_resolve(registry, ServiceIds420.TREASURY));
        VaultRouter420 vaultRouter = VaultRouter420(_resolve(registry, ServiceIds420.VAULT));

        TreasuryDisbursementRegistry420 disbursements = treasury.disbursements();
        TreasuryBudgetRegistry420 budgets = treasury.budgets();
        if (
            address(disbursements.budgets()) != address(budgets)
                || address(disbursements.policy()) != address(budgets.policy())
                || budgets.controller() != address(disbursements)
        ) revert InvalidServiceBinding();
        if (!treasury.isExecutable(id)) revert IneligibleDisbursement();

        TreasuryDisbursementRegistry420.Disbursement memory d = disbursements.disbursement(id);
        TreasuryBudgetRegistry420.Budget memory b = budgets.budget(d.budgetId);
        VaultRegistry420 vaultRegistry = vaultRouter.registry();
        VaultAccounting420 accounting = vaultRouter.accounting();
        VaultAuthorization420 authorization = vaultRouter.authorization();
        if (
            address(accounting.registry()) != address(vaultRegistry)
                || address(vaultRegistry.authorization()) != address(authorization)
        ) revert InvalidServiceBinding();
        VaultRegistry420.Vault memory v = vaultRegistry.getVault(b.vaultId);
        if (
            d.asset != b.asset || v.vaultType != VaultIds420.VAULT_TREASURY
                || v.state != VaultRegistry420.VaultState.ACTIVE || v.vaultAddress.code.length == 0
                || vaultRegistry.vaultIdForAddress(v.vaultAddress) != b.vaultId
        ) revert InvalidVaultBinding();
        AssetVault420 vault = AssetVault420(payable(v.vaultAddress));
        if (
            vault.vaultId() != b.vaultId || address(vault.registry()) != address(vaultRegistry)
                || address(vault.accounting()) != address(accounting)
                || address(vault.authorization()) != address(authorization)
                || d.recipient == address(vault)
        ) revert InvalidVaultBinding();
        if (accounting.freeBalance(b.vaultId, d.asset) < d.amount) revert InsufficientVaultFreeBalance();

        return ReleaseTarget(b.vaultId, vault, d.asset, d.recipient, d.amount);
    }

    function _resolve(
        ProtocolRegistry registry,
        bytes32 serviceId
    ) private view returns (address implementation) {
        ProtocolRegistry.Service memory service = registry.getService(serviceId);
        (implementation,) = registry.resolveActive(serviceId);
        if (
            implementation != service.implementation || implementation.code.length == 0
                || implementation.codehash != service.codeHash
        ) revert InvalidServiceBinding();
    }
}
