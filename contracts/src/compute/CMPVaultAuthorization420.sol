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
/// admitting funds. The funding contract exclusively creates payer-backed obligations and
/// controls the protected safety obligation; an optional pre-seal settlement adapter may only
/// release provider claims and execute their immutable-beneficiary claim transfer.
/// Registry lifecycle calls may freeze/unfreeze/wind down/close only through separately
/// scoped shared capabilities. They never gain obligation or withdrawal authority.
contract CMPVaultAuthorization420 is VaultAuthorization420 {
    bytes32 public immutable cmpVaultId;
    address public immutable deployer;
    address public boundVault;
    address public boundRegistry;
    address public fundingAdapter;
    address public settlementAdapter;
    bool public configurationSealed;

    error InvalidCMPBinding();
    event CMPVaultBound(address indexed vault, address indexed registry);
    event CMPFundingBound(address indexed funding);
    event CMPSettlementBound(address indexed settlement);
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
        address registry_ = address(candidate.registry());
        if (candidate.vaultId() != cmpVaultId || address(candidate.authorization()) != address(this)
            || registry_.code.length == 0) revert InvalidCMPBinding();
        boundVault = vault_;
        boundRegistry = registry_;
        emit CMPVaultBound(vault_, registry_);
    }

    function bindFunding(address funding_) external {
        if (msg.sender != deployer || configurationSealed || fundingAdapter != address(0)
            || boundVault == address(0) || boundRegistry == address(0)
            || funding_.code.length == 0) revert InvalidCMPBinding();
        ComputeEscrowFunding420 candidate = ComputeEscrowFunding420(payable(funding_));
        if (address(candidate.vault()) != boundVault || candidate.vaultId() != cmpVaultId
            || address(candidate.jobs()) == address(0)) revert InvalidCMPBinding();
        fundingAdapter = funding_;
        emit CMPFundingBound(funding_);
    }

    function bindSettlement(address settlement_) external {
        if (msg.sender != deployer || configurationSealed || settlementAdapter != address(0)
            || fundingAdapter == address(0) || settlement_.code.length == 0
            || settlement_ == fundingAdapter) revert InvalidCMPBinding();
        settlementAdapter = settlement_;
        emit CMPSettlementBound(settlement_);
    }

    /// @notice No method exists to rotate the Vault, registry, funding adapter, settlement adapter, or policy after sealing.
    function seal() external {
        if (msg.sender != deployer || configurationSealed || boundVault == address(0)
            || boundRegistry == address(0) || fundingAdapter == address(0)) revert InvalidCMPBinding();
        configurationSealed = true;
        emit CMPPolicySealed(boundVault, fundingAdapter);
    }

    /// @dev Shared registry authorization is checked only AFTER the immutable CMP restrictions.
    /// Asset-moving calls must originate from the bound Vault and use the funding adapter.
    /// Lifecycle calls must originate from the bound VaultRegistry and are limited to state
    /// transitions; a lifecycle grant cannot be repurposed into payer-credit authority.
    function isAuthorized(address principal, bytes32 vaultId, bytes32 actionId, uint256 amount)
        public view override returns (bool)
    {
        if (!configurationSealed || vaultId != cmpVaultId) return false;

        if (msg.sender == boundVault) {
            if (principal == fundingAdapter) {
                if (actionId != VaultIds420.ACTION_CREATE_OBLIGATION
                    && actionId != VaultIds420.ACTION_RELEASE_OBLIGATION
                    && actionId != VaultIds420.ACTION_CANCEL_OBLIGATION) return false;
                return super.isAuthorized(principal, vaultId, actionId, amount);
            }
            if (principal == settlementAdapter && settlementAdapter != address(0)) {
                if (actionId != VaultIds420.ACTION_RELEASE_OBLIGATION
                    && actionId != VaultIds420.ACTION_CLAIM) return false;
                return super.isAuthorized(principal, vaultId, actionId, amount);
            }
            return false;
        }

        if (msg.sender == boundRegistry) {
            if (actionId != VaultIds420.ACTION_FREEZE
                && actionId != VaultIds420.ACTION_UNFREEZE
                && actionId != VaultIds420.ACTION_BEGIN_WIND_DOWN
                && actionId != VaultIds420.ACTION_CLOSE) return false;
            return super.isAuthorized(principal, vaultId, actionId, amount);
        }

        return false;
    }

    function isRouteAuthorized(address, bytes32, bytes32, address, address, uint256)
        public pure override returns (bool)
    {
        return false;
    }
}
