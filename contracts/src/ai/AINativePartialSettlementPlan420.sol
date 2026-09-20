// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Deterministic, non-custodial partial settlement plan. This library does NOT
/// cancel, release, claim or close an escrow; it cannot enable partial payments by itself.
/// A separate security-reviewed adapter must execute both legs atomically and prove both
/// native receipts before the escrow and manager may report a completed split.
library AINativePartialSettlementPlan420 {
    error InvalidSplit();

    struct Plan {
        bytes32 settlementRef;
        bytes32 providerObligation;
        bytes32 payerObligation;
        bytes32 cancelOperation;
        bytes32 providerCreateOperation;
        bytes32 payerCreateOperation;
        bytes32 providerReleaseOperation;
        bytes32 payerReleaseOperation;
        bytes32 providerClaimOperation;
        bytes32 payerClaimOperation;
        uint256 providerAmount;
        uint256 payerAmount;
    }

    /// @dev Provider and payer must both receive strictly positive amounts. Full payouts and
    /// full refunds must continue through their existing, separately authorized routes.
    function plan(
        uint256 chainId,
        address adapter,
        bytes32 jobId,
        bytes32 fundingRef,
        bytes32 originalObligation,
        bytes32 decisionRef,
        address payer,
        address provider,
        uint256 fundedAmount,
        uint256 providerAmount
    ) internal pure returns (Plan memory p) {
        if (chainId == 0 || adapter == address(0) || jobId == bytes32(0)
            || fundingRef == bytes32(0) || originalObligation == bytes32(0)
            || decisionRef == bytes32(0) || payer == address(0) || provider == address(0)
            || payer == provider || fundedAmount < 2 || providerAmount == 0
            || providerAmount >= fundedAmount) revert InvalidSplit();
        p.providerAmount = providerAmount;
        p.payerAmount = fundedAmount - providerAmount;
        p.settlementRef = keccak256(abi.encode("420AI_PARTIAL_SETTLEMENT_V1", chainId, adapter,
            jobId, fundingRef, originalObligation, decisionRef, payer, provider, fundedAmount,
            providerAmount));
        p.providerObligation = keccak256(abi.encode("420AI_PARTIAL_PROVIDER_OBLIGATION_V1",
            p.settlementRef, jobId, fundingRef, provider));
        p.payerObligation = keccak256(abi.encode("420AI_PARTIAL_PAYER_OBLIGATION_V1",
            p.settlementRef, jobId, fundingRef, payer));
        p.cancelOperation = keccak256(abi.encode("420AI_PARTIAL_CANCEL_V1", p.settlementRef));
        p.providerCreateOperation = keccak256(abi.encode("420AI_PARTIAL_PROVIDER_CREATE_V1", p.settlementRef));
        p.payerCreateOperation = keccak256(abi.encode("420AI_PARTIAL_PAYER_CREATE_V1", p.settlementRef));
        p.providerReleaseOperation = keccak256(abi.encode("420AI_PARTIAL_PROVIDER_RELEASE_V1", p.settlementRef));
        p.payerReleaseOperation = keccak256(abi.encode("420AI_PARTIAL_PAYER_RELEASE_V1", p.settlementRef));
        p.providerClaimOperation = keccak256(abi.encode("420AI_PARTIAL_PROVIDER_CLAIM_V1", p.settlementRef));
        p.payerClaimOperation = keccak256(abi.encode("420AI_PARTIAL_PAYER_CLAIM_V1", p.settlementRef));
    }
}
