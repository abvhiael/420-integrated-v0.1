// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "../vault/VaultAccounting420.sol";
import "../vault/VaultRegistry420.sol";
import "../vault/VaultIds420.sol";

/// @notice Read-only evidence that a registered, owner-created escrow vault has
/// a live obligation covering the specified job in the canonical 420 asset.
/// @dev This is NOT a payer attribution oracle: the existing Vault accounting
/// aggregates deposits at vault level. CMP-1.2 must prove payer-isolated funding
/// and prevent third-party deposits from being credited as the owner's payment.
/// Do not publish this as a production ComputeMarket funding authority alone.
contract ComputeJobVaultReservationEvidence420 is IComputeJobFundingEvidence420 {
    VaultAccounting420 public immutable accounting;
    VaultRegistry420 public immutable registry;
    bytes32 public immutable vaultId;
    address public immutable token420;
    address public immutable custodyBeneficiary;
    uint256 public immutable minimumReservation;

    error InvalidConfiguration();

    constructor(address accounting_, address registry_, bytes32 vaultId_, address token420_,
        address custodyBeneficiary_, uint256 minimumReservation_) {
        if (accounting_.code.length == 0 || registry_.code.length == 0 || vaultId_ == bytes32(0)
            || token420_.code.length == 0 || custodyBeneficiary_ == address(0)
            || minimumReservation_ == 0) revert InvalidConfiguration();
        accounting = VaultAccounting420(accounting_);
        registry = VaultRegistry420(registry_);
        vaultId = vaultId_;
        token420 = token420_;
        custodyBeneficiary = custodyBeneficiary_;
        minimumReservation = minimumReservation_;
    }

    /// @notice fundingRef is the canonical VaultAccounting obligation ID.
    /// All supplied job identifiers and owners must agree with the immutable
    /// live Vault obligation. This checks locked custody, not payer provenance.
    function funded(bytes32 jobId, address owner, bytes32 fundingRef) external view returns (bool) {
        if (jobId == bytes32(0) || owner == address(0) || fundingRef == bytes32(0)) return false;
        VaultRegistry420.Vault memory vault = registry.getVault(vaultId);
        if (!vault.exists || vault.vaultType != VaultIds420.VAULT_ESCROW
            || vault.creatorAccount != owner || vault.vaultAddress == address(0)
            || vault.state != VaultRegistry420.VaultState.ACTIVE) return false;
        VaultAccounting420.Obligation memory obligation = accounting.getObligation(fundingRef);
        if (!obligation.exists || obligation.state != 1 || obligation.vaultId != vaultId
            || obligation.asset != token420 || obligation.beneficiary != custodyBeneficiary
            || obligation.amount < minimumReservation || obligation.sourceRef != jobId) return false;
        VaultAccounting420.AssetAccounting memory balances = accounting.getAccounting(vaultId, token420);
        if (balances.reserved < obligation.amount || balances.recordedBalance < balances.reserved + balances.claimable)
            return false;
        // The configured registry must be the one used by the canonical accounting contract.
        return address(accounting.registry()) == address(registry);
    }
}
