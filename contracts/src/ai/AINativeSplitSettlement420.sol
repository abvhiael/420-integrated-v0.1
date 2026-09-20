// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./AINativeSettlementWithRefund420.sol";
import "./AINativePartialSettlementPlan420.sol";

/// @notice Single escrow-bound adapter for full provider payment, full payer refund, or a
/// separately approved partial settlement. Never bind any of the parent adapters instead.
/// @dev Deployment and Vault action-scoped authority remain subject to an independent review.
contract AINativeSplitSettlement420 is AINativeSettlementWithRefund420 {
    bytes32 private constant PROVIDER_KIND = keccak256("420AI_NATIVE_PARTIAL_PROVIDER_V1");
    bytes32 private constant PAYER_KIND = keccak256("420AI_NATIVE_PARTIAL_PAYER_V1");
    mapping(bytes32 => bool) public splitJob;
    uint256 private _splitting;

    error SplitUnauthorized();
    error SplitReplay();
    error SplitInvalidJob();
    error SplitInvalidObligation();
    error SplitTransferFailed();
    error SplitReentrancy();

    event NativeSplitPaid(bytes32 indexed jobId, bytes32 indexed settlementRef,
        bytes32 indexed originalObligation, bytes32 providerObligation, bytes32 payerObligation,
        bytes32 providerClaimOperation, bytes32 payerClaimOperation, address provider,
        address payer, uint256 providerAmount, uint256 payerAmount, bytes32 decisionRef);

    struct Context {
        address payer;
        address provider;
        bytes32 fundingRef;
        bytes32 original;
        uint256 amount;
    }

    constructor(address governance_, address manager_, address payable escrow_, address funding_,
        address payable vault_, bytes32 vaultRef_)
        AINativeSettlementWithRefund420(governance_, manager_, escrow_, funding_, vault_, vaultRef_) {}

    /// @notice A single EVM transaction either pays BOTH native recipients and closes escrow,
    /// or reverts all Vault, escrow, and native balance changes. A timeout is NOT a failed tx.
    function settleSplit(bytes32 jobId, bytes32 decisionRef, uint256 providerAmount) external {
        if (msg.sender != governance) revert SplitUnauthorized();
        if (_splitting != 0) revert SplitReentrancy();
        _splitting = 1;
        if (jobId == bytes32(0) || decisionRef == bytes32(0) || splitJob[jobId]
            || settledJob[jobId] || refundedJob[jobId]) revert SplitReplay();
        Context memory c = _context(jobId);
        AINativePartialSettlementPlan420.Plan memory p = AINativePartialSettlementPlan420.plan(
            block.chainid, address(this), jobId, c.fundingRef, c.original, decisionRef,
            c.payer, c.provider, c.amount, providerAmount
        );
        splitJob[jobId] = true;
        escrow.markSplitClaimable(jobId, p.settlementRef, p.providerObligation, p.payerObligation,
            p.providerClaimOperation, p.payerClaimOperation, p.providerAmount, p.payerAmount);
        // Never transfer to either recipient before BOTH independent reservations exist.
        vault.cancelObligation(p.cancelOperation, c.original);
        vault.createObligation(p.providerCreateOperation, p.providerObligation, address(0),
            c.provider, p.providerAmount, PROVIDER_KIND, c.fundingRef);
        vault.createObligation(p.payerCreateOperation, p.payerObligation, address(0),
            c.payer, p.payerAmount, PAYER_KIND, c.fundingRef);
        _checkObligation(p.providerObligation, c.provider, p.providerAmount, c.fundingRef, PROVIDER_KIND, 1);
        _checkObligation(p.payerObligation, c.payer, p.payerAmount, c.fundingRef, PAYER_KIND, 1);
        if (accounting.getObligation(c.original).state != 4) revert SplitInvalidObligation();
        vault.releaseObligation(p.providerReleaseOperation, p.providerObligation);
        vault.releaseObligation(p.payerReleaseOperation, p.payerObligation);
        _pay(p.providerClaimOperation, p.providerObligation, c.provider, p.providerAmount);
        _pay(p.payerClaimOperation, p.payerObligation, c.payer, p.payerAmount);
        _checkObligation(p.providerObligation, c.provider, p.providerAmount, c.fundingRef, PROVIDER_KIND, 3);
        _checkObligation(p.payerObligation, c.payer, p.payerAmount, c.fundingRef, PAYER_KIND, 3);
        if (accounting.getObligation(c.original).state != 4) revert SplitInvalidObligation();
        escrow.closeSplit(jobId, p.settlementRef);
        emit NativeSplitPaid(jobId, p.settlementRef, c.original, p.providerObligation,
            p.payerObligation, p.providerClaimOperation, p.payerClaimOperation,
            c.provider, c.payer, p.providerAmount, p.payerAmount, decisionRef);
        _splitting = 0;
    }

    function _context(bytes32 jobId) private view returns (Context memory c) {
        if (!escrow.settlementAdapterBound() || escrow.settlementAdapter() != address(this)
            || !funding.consumedJob(jobId)) revert SplitInvalidJob();
        AIJobManager.Job memory job = manager.getJob(jobId);
        if (job.status != AIJobManager.Status.VERIFIED || job.requester == address(0)
            || job.fundingRef == bytes32(0) || job.fundedAmount < 2 || job.providerId == bytes32(0))
            revert SplitInvalidJob();
        (address payer, address provider, bytes32 providerId, bytes32 escrowVault,
            bytes32 escrowFunding, bytes32 previousSettlement, uint256 amount,
            AIJobEscrow.EscrowState state) = escrow.escrows(jobId);
        if (state != AIJobEscrow.EscrowState.FUNDED || previousSettlement != bytes32(0)
            || payer != job.requester || provider == address(0) || payer == provider
            || providerId != job.providerId || escrowVault != vaultRef
            || escrowFunding != job.fundingRef || amount != job.fundedAmount) revert SplitInvalidJob();
        c = Context(payer, provider, job.fundingRef, funding.obligationForJob(jobId), amount);
        if (c.original != keccak256(abi.encode("420AI_NATIVE_OBLIGATION_V1", c.fundingRef)))
            revert SplitInvalidObligation();
        _checkObligation(c.original, provider, amount, c.fundingRef,
            keccak256("420AI_NATIVE_JOB_V1"), 1);
    }

    function _checkObligation(bytes32 id, address to, uint256 amount, bytes32 source,
        bytes32 kind, uint8 state) private view {
        VaultAccounting420.Obligation memory o = accounting.getObligation(id);
        if (!o.exists || o.state != state || o.vaultId != vaultRef || o.asset != address(0)
            || o.beneficiary != to || o.amount != amount || o.sourceRef != source
            || o.obligationType != kind) revert SplitInvalidObligation();
    }

    function _pay(bytes32 operation, bytes32 id, address recipient, uint256 amount) private {
        uint256 balanceBefore = recipient.balance;
        vault.claim(operation, id);
        if (recipient.balance != balanceBefore + amount || !vault.executedOperation(operation))
            revert SplitTransferFailed();
    }
}
