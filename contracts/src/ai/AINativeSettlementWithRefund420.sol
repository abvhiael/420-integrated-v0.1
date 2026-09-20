// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./AINativeProviderSettlement420.sol";

/// @notice One escrow-bound adapter exposing separately authorized full provider and payer paths.
/// @dev Deploy THIS adapter in place of the provider-only adapter before binding escrow once.
/// Only governance may authorize a full refund; refund decisionRef must be independently approved.
/// Grant only exact Vault cancellation, creation, release and claim capabilities after security review.
contract AINativeSettlementWithRefund420 is AINativeProviderSettlement420 {
    mapping(bytes32 => bool) public refundedJob;
    uint256 private _refunding;

    error RefundUnauthorized();
    error RefundReplay();
    error RefundInvalidJob();
    error RefundInvalidObligation();
    error RefundFailed();
    error RefundReentrancy();

    event NativePayerRefunded(bytes32 indexed jobId, bytes32 indexed refundObligationId,
        bytes32 indexed settlementRef, bytes32 originalObligationId, bytes32 cancelOperation,
        bytes32 createOperation, bytes32 releaseOperation, bytes32 claimOperation,
        address payer, uint256 amount, bytes32 decisionRef);

    constructor(address governance_, address manager_, address payable escrow_, address funding_,
        address payable vault_, bytes32 vaultRef_)
        AINativeProviderSettlement420(governance_, manager_, escrow_, funding_, vault_, vaultRef_) {}

    /// @notice Atomic original-provider cancellation, NEW payer obligation, actual claim, then escrow closure.
    /// @dev No refund in actively disputed or verified states. A FAILED job following an upheld
    /// dispute still requires an independently approved refund decisionRef from governance.
    function refundPayer(bytes32 jobId, bytes32 decisionRef) external {
        if (msg.sender != governance) revert RefundUnauthorized();
        if (_refunding != 0) revert RefundReentrancy();
        _refunding = 1;
        if (jobId == bytes32(0) || decisionRef == bytes32(0) || refundedJob[jobId] || settledJob[jobId])
            revert RefundReplay();
        if (!escrow.settlementAdapterBound() || escrow.settlementAdapter() != address(this)
            || !funding.consumedJob(jobId)) revert RefundInvalidJob();

        AIJobManager.Job memory job = manager.getJob(jobId);
        if (job.status != AIJobManager.Status.FUNDED && job.status != AIJobManager.Status.EXPIRED
            && job.status != AIJobManager.Status.FAILED) revert RefundInvalidJob();
        if (job.requester == address(0) || job.fundingRef == bytes32(0) || job.fundedAmount == 0)
            revert RefundInvalidJob();
        (address payer, address beneficiary, bytes32 providerId, bytes32 escrowVault, bytes32 escrowFunding,
            bytes32 previousSettlement, uint256 amount, AIJobEscrow.EscrowState state) = escrow.escrows(jobId);
        if (state != AIJobEscrow.EscrowState.FUNDED || previousSettlement != bytes32(0)
            || payer != job.requester || beneficiary == address(0) || providerId == bytes32(0)
            || providerId != job.providerId || escrowVault != vaultRef || escrowFunding != job.fundingRef
            || amount != job.fundedAmount) revert RefundInvalidJob();

        bytes32 original = funding.obligationForJob(jobId);
        if (original != keccak256(abi.encode("420AI_NATIVE_OBLIGATION_V1", job.fundingRef)))
            revert RefundInvalidObligation();
        VaultAccounting420.Obligation memory o = accounting.getObligation(original);
        if (!o.exists || o.state != 1 || o.vaultId != vaultRef || o.asset != address(0)
            || o.beneficiary != beneficiary || o.amount != amount || o.sourceRef != job.fundingRef
            || o.obligationType != keccak256("420AI_NATIVE_JOB_V1")) revert RefundInvalidObligation();

        bytes32 settlementRef = keccak256(abi.encode("420AI_PAYER_FULL_REFUND_V1", block.chainid,
            address(this), jobId, job.fundingRef, original, decisionRef));
        // Align with the off-chain 6.4.3.1 deterministic refund obligation ID convention.
        bytes32 refundId = keccak256(abi.encode("420AI_REFUND_OBLIGATION_V1", job.fundingRef, jobId, settlementRef));
        bytes32 cancelOp = keccak256(abi.encode("420AI_REFUND_CANCEL_V1", settlementRef));
        bytes32 createOp = keccak256(abi.encode("420AI_REFUND_CREATE_V1", settlementRef));
        bytes32 releaseOp = keccak256(abi.encode("420AI_REFUND_RELEASE_V1", settlementRef));
        bytes32 claimOp = keccak256(abi.encode("420AI_REFUND_CLAIM_V1", settlementRef));

        refundedJob[jobId] = true;
        // Entitlement alone is NOT payment. Any failure below reverts the entire transaction.
        escrow.markRefundable(jobId, settlementRef);
        vault.cancelObligation(cancelOp, original);
        vault.createObligation(createOp, refundId, address(0), payer, amount,
            keccak256("420AI_NATIVE_PAYER_REFUND_V1"), job.fundingRef);
        VaultAccounting420.Obligation memory created = accounting.getObligation(refundId);
        if (!created.exists || created.state != 1 || created.vaultId != vaultRef
            || created.asset != address(0) || created.beneficiary != payer || created.amount != amount
            || created.sourceRef != job.fundingRef
            || created.obligationType != keccak256("420AI_NATIVE_PAYER_REFUND_V1")) revert RefundFailed();
        vault.releaseObligation(releaseOp, refundId);
        uint256 beforeBalance = payer.balance;
        vault.claim(claimOp, refundId);
        if (payer.balance != beforeBalance + amount || !vault.executedOperation(claimOp)) revert RefundFailed();
        VaultAccounting420.Obligation memory claimed = accounting.getObligation(refundId);
        VaultAccounting420.Obligation memory cancelled = accounting.getObligation(original);
        if (claimed.state != 3 || claimed.beneficiary != payer || claimed.amount != amount
            || claimed.vaultId != vaultRef || claimed.sourceRef != job.fundingRef
            || cancelled.state != 4 || cancelled.sourceRef != job.fundingRef) revert RefundFailed();
        escrow.refund(jobId);
        emit NativePayerRefunded(jobId, refundId, settlementRef, original, cancelOp, createOp,
            releaseOp, claimOp, payer, amount, decisionRef);
        _refunding = 0;
    }
}
