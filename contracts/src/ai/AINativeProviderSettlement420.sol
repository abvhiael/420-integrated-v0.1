// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./AIJobManager.sol";
import "./AIJobEscrow.sol";
import "./AINativeVaultFundingAdapter420.sol";
import "../vault/AssetVault420.sol";
import "../vault/VaultAccounting420.sol";

/// @notice Full-amount, native-only provider payout. Explicit governance decision required.
/// @dev Deployment must authenticate the canonical manager, escrow, funding adapter, Vault and
/// accounting code/registry independently. Grant this adapter ONLY RELEASE_OBLIGATION and CLAIM
/// capabilities for this Vault. CLAIM can pay only the immutable obligation beneficiary.
/// Never bind or activate this adapter before independent authority/security review.
contract AINativeProviderSettlement420 {
    AIJobManager public immutable manager;
    AIJobEscrow public immutable escrow;
    AINativeVaultFundingAdapter420 public immutable funding;
    AssetVault420 public immutable vault;
    VaultAccounting420 public immutable accounting;
    address public immutable governance;
    bytes32 public immutable vaultRef;

    mapping(bytes32 => bool) public settledJob;
    uint256 private _entered;

    error InvalidConfiguration();
    error Unauthorized();
    error InvalidSettlement();
    error InvalidObligation();
    error Replay();
    error Reentrancy();

    event NativeProviderPaid(bytes32 indexed jobId, bytes32 indexed obligationId, bytes32 indexed settlementRef,
        bytes32 releaseOperation, bytes32 claimOperation, address beneficiary, uint256 amount, bytes32 decisionRef);

    constructor(address governance_, address manager_, address payable escrow_, address funding_,
        address payable vault_, bytes32 vaultRef_) {
        if (governance_ == address(0) || manager_ == address(0) || escrow_ == address(0)
            || funding_ == address(0) || vault_ == address(0) || vaultRef_ == bytes32(0)) revert InvalidConfiguration();
        governance = governance_;
        manager = AIJobManager(manager_);
        escrow = AIJobEscrow(escrow_);
        funding = AINativeVaultFundingAdapter420(payable(funding_));
        vault = AssetVault420(vault_);
        accounting = vault.accounting();
        vaultRef = vaultRef_;
        if (address(accounting) == address(0) || escrow.AI_JOB_MANAGER() != manager_
            || address(funding.manager()) != manager_ || address(funding.escrow()) != escrow_
            || address(funding.vault()) != vault_ || funding.vaultRef() != vaultRef_
            || vault.vaultId() != vaultRef_) revert InvalidConfiguration();
    }

    /// @notice One governance-authorized all-or-nothing release, native claim and escrow closure.
    /// @dev decisionRef must identify an independently authorized, undisputed FULL payout decision.
    /// This reference is not itself proof of 420Trust verification or a substitute for governance review.
    function payProvider(bytes32 jobId, bytes32 decisionRef) external {
        if (msg.sender != governance) revert Unauthorized();
        if (_entered != 0) revert Reentrancy();
        _entered = 1;
        if (jobId == bytes32(0) || decisionRef == bytes32(0) || settledJob[jobId]) revert Replay();
        if (!escrow.settlementAdapterBound() || escrow.settlementAdapter() != address(this)
            || !funding.consumedJob(jobId)) revert InvalidConfiguration();

        AIJobManager.Job memory job = manager.getJob(jobId);
        if (job.status != AIJobManager.Status.VERIFIED || job.fundingRef == bytes32(0)
            || job.fundedAmount == 0 || job.requester == address(0)) revert InvalidSettlement();
        (address payer, address beneficiary, bytes32 providerId, bytes32 escrowVault, bytes32 escrowFunding,
            bytes32 previousSettlement, uint256 amount, AIJobEscrow.EscrowState state) = escrow.escrows(jobId);
        if (state != AIJobEscrow.EscrowState.FUNDED || previousSettlement != bytes32(0)
            || payer != job.requester || providerId != job.providerId || providerId == bytes32(0)
            || escrowVault != vaultRef || escrowFunding != job.fundingRef
            || beneficiary == address(0) || amount != job.fundedAmount) revert InvalidSettlement();

        bytes32 obligationId = funding.obligationForJob(jobId);
        if (obligationId != keccak256(abi.encode("420AI_NATIVE_OBLIGATION_V1", job.fundingRef))) revert InvalidObligation();
        VaultAccounting420.Obligation memory o = accounting.getObligation(obligationId);
        if (!o.exists || o.state != 1 || o.vaultId != vaultRef || o.asset != address(0)
            || o.beneficiary != beneficiary || o.amount != amount || o.sourceRef != job.fundingRef
            || o.obligationType != keccak256("420AI_NATIVE_JOB_V1")) revert InvalidObligation();

        bytes32 settlementRef = keccak256(abi.encode("420AI_PROVIDER_FULL_V1", block.chainid,
            address(this), jobId, job.fundingRef, obligationId, decisionRef));
        bytes32 releaseOperation = keccak256(abi.encode("420AI_PROVIDER_RELEASE_V1", settlementRef));
        bytes32 claimOperation = keccak256(abi.encode("420AI_PROVIDER_CLAIM_V1", settlementRef));
        settledJob[jobId] = true;
        escrow.markClaimable(jobId, settlementRef);
        vault.releaseObligation(releaseOperation, obligationId);
        uint256 balanceBefore = beneficiary.balance;
        vault.claim(claimOperation, obligationId);
        if (beneficiary.balance != balanceBefore + amount || !vault.executedOperation(claimOperation)) revert InvalidSettlement();
        VaultAccounting420.Obligation memory claimed = accounting.getObligation(obligationId);
        if (claimed.state != 3 || claimed.beneficiary != beneficiary || claimed.amount != amount
            || claimed.vaultId != vaultRef || claimed.sourceRef != job.fundingRef) revert InvalidSettlement();
        escrow.release(jobId, payable(beneficiary));
        emit NativeProviderPaid(jobId, obligationId, settlementRef, releaseOperation, claimOperation,
            beneficiary, amount, decisionRef);
        _entered = 0;
    }
}
