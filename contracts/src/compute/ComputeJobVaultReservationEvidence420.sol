// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "../vault/VaultAccounting420.sol";
import "../vault/VaultRegistry420.sol";
import "../vault/VaultIds420.sol";

/// @notice Read-only proof of a live native-420 obligation in a registered
/// escrow-type 420Vault whose registered creator is the job owner.
/// @dev VaultAccounting is pooled at vault level and has no per-depositor payer
/// attribution. A real obligation does NOT prove the job's authorized payer
/// funded it. This adapter alone is NOT sufficient production funding evidence.
contract ComputeJobVaultReservationEvidence420 is IComputeJobFundingEvidence420 {
    VaultAccounting420 public immutable accounting;
    VaultRegistry420 public immutable registry;
    bytes32 public immutable vaultId;
    address public immutable custodyBeneficiary;
    uint256 public immutable minimumReservation;
    error InvalidConfiguration();

    constructor(address accounting_, address registry_, bytes32 vaultId_,
        address custodyBeneficiary_, uint256 minimumReservation_) {
        if (accounting_.code.length == 0 || registry_.code.length == 0 || vaultId_ == bytes32(0)
            || custodyBeneficiary_ == address(0) || minimumReservation_ == 0) revert InvalidConfiguration();
        accounting = VaultAccounting420(accounting_);
        registry = VaultRegistry420(registry_);
        vaultId = vaultId_;
        custodyBeneficiary = custodyBeneficiary_;
        minimumReservation = minimumReservation_;
    }

    /// @notice fundingRef is an actual VaultAccounting obligation ID.
    /// Native $420 is represented by asset address(0) in the canonical Vault.
    function funded(bytes32 jobId, address owner, bytes32 fundingRef) external view returns (bool) {
        if (jobId == bytes32(0) || owner == address(0) || fundingRef == bytes32(0)) return false;
        VaultRegistry420.Vault memory v = registry.getVault(vaultId);
        if (!v.exists || v.vaultType != VaultIds420.VAULT_ESCROW
            || v.creatorAccount != owner || v.vaultAddress == address(0)
            || v.state != VaultRegistry420.VaultState.ACTIVE) return false;
        VaultAccounting420.Obligation memory o = accounting.getObligation(fundingRef);
        if (!o.exists || o.state != 1 || o.vaultId != vaultId
            || o.asset != address(0) || o.beneficiary != custodyBeneficiary
            || o.amount < minimumReservation || o.sourceRef != jobId) return false;
        VaultAccounting420.AssetAccounting memory b = accounting.getAccounting(vaultId, address(0));
        if (b.reserved < o.amount || b.recordedBalance < b.reserved + b.claimable) return false;
        return address(accounting.registry()) == address(registry);
    }
}
