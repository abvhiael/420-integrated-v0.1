// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../vault/VaultAuthorization420.sol";
import "../vault/AssetVault420.sol";
import "../vault/VaultIds420.sol";
import "./ComputeEscrowFunding420.sol";

/// @notice CMP V1 Vault policy. The Vault is CONSTRUCTED with this authorization contract,
/// not the generic VaultAuthorization420. Shared registry grants are necessary but NEVER
/// sufficient: even its component authority cannot bypass the sealed CMP allowlist.
/// @dev Bind the newly created Vault and funding adapter exactly once, then seal BEFORE
/// admitting funds. Only the current funding contract may create a payer safety obligation
/// or release it through its independently guarded expired/unmatched refund function.
/// No direct cancel/withdraw/route claim/delegated claim is allowed in this version.
contract CMPVaultAuthorization420 is VaultAuthorization420 {
    bytes32 public immutable cmpVaultId;
    address public immutable deployer;
    address public boundVault;
    address public fundingAdapter;
    bool public configurationSealed;

    error InvalidCMPBinding();
    event CMPVaultBound(address indexed vault);
    event CMPFundingBound(address indexed funding);
    event CMPPolicySealed(address indexed vault, address indexed funding);

    constructor(address sharedCapabilities, bytes32 dedicatedVaultId)
        VaultAuthorization420(sharedCapabilities)
    {
        if (dedicatedVaultId == bytes32(0)) revert InvalidCMPBinding();
        cmpVaultId = dedicatedVaultId;
        deployer = msg.sender;
    }

    function bindVault(address vault_) external {
        if (msg.sender != deployer || configurationSealed || boundVault != address(0)
            || vault_.code.length == 0) revert InvalidCMPBinding();
        AssetVault420 candidate = AssetVault420(payable(vault_));
        if (candidate.vaultId() != cmpVaultId || address(candidate.authorization()) != address(this))
            revert InvalidCMPBinding();
        boundVault = vault_;
        emit CMPVaultBound(vault_);
    }

    function bindFunding(address funding_) external {
        if (msg.sender != deployer || configurationSealed || fundingAdapter != address(0)
            || boundVault == address(0) || funding_.code.length == 0) revert InvalidCMPBinding();
        ComputeEscrowFunding420 candidate = ComputeEscrowFunding420(payable(funding_));
        if (address(candidate.vault()) != boundVault || candidate.vaultId() != cmpVaultId
            || address(candidate.jobs()) == address(0)) revert InvalidCMPBinding();
        fundingAdapter = funding_;
        emit CMPFundingBound(funding_);
    }

    /// @notice No method exists to rotate the Vault, funding adapter, or policy after sealing.
    function seal() external {
        if (msg.sender != deployer || configurationSealed || boundVault == address(0)
            || fundingAdapter == address(0)) revert InvalidCMPBinding();
        configurationSealed = true;
        emit CMPPolicySealed(boundVault, fundingAdapter);
    }

    /// @dev Registry authorization is checked AFTER the immutable CMP restrictions.
    /// Registry/administrative actions are denied for now; no grant can broaden this set.
    function isAuthorized(address principal, bytes32 vaultId, bytes32 actionId, uint256 amount)
        public view override returns (bool)
    {
        if (!configurationSealed || msg.sender != boundVault || vaultId != cmpVaultId
            || principal != fundingAdapter) return false;
        if (actionId != VaultIds420.ACTION_CREATE_OBLIGATION
            && actionId != VaultIds420.ACTION_RELEASE_OBLIGATION) return false;
        return super.isAuthorized(principal, vaultId, actionId, amount);
    }

    function isRouteAuthorized(address, bytes32, bytes32, address, address, uint256)
        public pure override returns (bool)
    {
        return false;
    }
}
