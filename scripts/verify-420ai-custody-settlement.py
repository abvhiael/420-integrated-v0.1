#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read(path: str) -> str:
    p = ROOT / path
    if not p.exists():
        raise SystemExit(f"missing required file: {path}")
    return p.read_text(encoding="utf-8")

def require(path: str, *tokens: str) -> None:
    text = read(path)
    missing = [t for t in tokens if t not in text]
    if missing:
        raise SystemExit(f"{path}: missing required AI-AUDIT-5 boundary tokens: {missing}")

def forbid(path: str, *tokens: str) -> None:
    text = read(path)
    bad = [t for t in tokens if t in text]
    if bad:
        raise SystemExit(f"{path}: forbidden custody/authority primitive present: {bad}")

require(
    "contracts/src/ai/AIJobManager.sol",
    "confirmCanonicalFunding",
    "confirmCanonicalSettlement",
    "confirmCanonicalRefund",
    "onlyComputeAdapter",
    "FundingExceedsMaximum",
)
require(
    "contracts/src/ai/AIJobEscrow.sol",
    "DirectCustodyDisabled",
    "confirmCanonicalVaultFunding",
    "bindSettlementBeneficiary",
    "InvalidRecipient",
    "receive() external payable { revert DirectCustodyDisabled(); }",
)
forbid(
    "contracts/src/ai/AIJobEscrow.sol",
    "selfdestruct",
    "delegatecall",
    ".call{value:",
    ".transfer(",
    ".send(",
)
require(
    "contracts/src/ai/AIComputeAdapter420.sol",
    "computeFunding.credit",
    "computeFunding.funded",
    "c.payer != b.payer",
    "c.deposited > b.maxSpend",
    "c.maximumSpend > b.maxSpend",
    "jobs.confirmCanonicalFunding",
    "computeEntitlements.settled",
    "jobs.confirmCanonicalSettlement",
    "computeEntitlements.refunded",
    "jobs.confirmCanonicalRefund",
)
require(
    "contracts/src/compute/ComputeEscrowFunding420.sol",
    "PAYER_SAFETY_TYPE",
    "PAYER_RESIDUAL_TYPE",
    "PAYER_DISPUTE_REFUND_TYPE",
    "allocateVerifiedEarning",
    "prepareTerminalRefund",
    "reallocateDisputedToPayer",
    "c.deposited - earnedAmount",
)
require(
    "contracts/src/compute/ComputeVerifiedEntitlement420.sol",
    "providerReleaseAllowed",
    "createSettledResidualRefundClaim",
    "claimPayerRefund",
    "applyDisputeResolution",
    "settled(bytes32 jobId",
    "refunded(bytes32 jobId",
)
require(
    "contracts/src/compute/ComputeDisputeResolution420.sol",
    "activeHold",
    "providerReleaseAllowed",
    "Fail-closed timeout",
    "verificationHoldForJob",
)
require(
    "contracts/src/compute/ComputeVerifierDisputeSlashEvidence420.sol",
    "finalObjective: true",
    "OBJECTIVE_VERIFIER_ERROR_GROUND",
    "adverseToOriginalVerification",
)
require(
    "docs/420-AI-V1-ARCHITECTURE.md",
    "420AI must not maintain an unrestricted standalone escrow",
    "A provider may never settle above that ceiling",
    "Subjective model quality",
    "It may not:",
    "redirect user funds",
    "redirect provider earnings",
)
print("AI-AUDIT-5 custody / settlement / dispute boundaries: PASS")
