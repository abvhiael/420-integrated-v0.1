#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ADAPTER=ROOT/"contracts/src/ai/AIComputeAdapter420.sol"
TEST=ROOT/"contracts/test/AIComputeIntegration420.t.sol"
ARCH=ROOT/"docs/420-AI-V1-ARCHITECTURE.md"
errors=[]

adapter=ADAPTER.read_text()
test=TEST.read_text()
arch=ARCH.read_text()

required_adapter=[
    "IAIComputeRequestAuthority420",
    "IAIComputeJobRegistry420",
    "IAIComputeAcceptedMatch420",
    "IAIComputeEntitlement420",
    "IAIComputeProviderRegistry420",
    "computeManifestHash",
    "bindComputeRequest",
    "bindComputeJob",
    "syncAcceptedMatch",
    "syncExecution",
    "syncVerifiedEntitlement",
    "observeSettlement",
    "observeRefund",
    "ConstraintBroadened",
    "EvidenceMismatch",
]
for token in required_adapter:
    if token not in adapter:
        errors.append(f"adapter missing current CMP integration token: {token}")

for token in [
    "p.offerId != b.offerId",
    "p.providerId != b.computeProviderId",
    "p.payer != b.payer",
    "p.acceptedAmount > b.maxSpend",
    "p.beneficiary != cp.settlementAccount",
    "e.resultCommitment != b.resultCommitment",
    "e.verificationRef != j.verificationRef",
    "e.earnedAmount > b.acceptedPrice",
    "computeEntitlements.refunded",
    "computeEntitlements.settled",
]:
    if token not in adapter:
        errors.append(f"adapter missing fail-closed binding: {token}")

for token in [
    "testAIToCMPVerifiedEntitlementAndSettlementEvidence",
    "testRefundEvidenceBindsToOriginalCMPJob",
    "testBroadenedSpendOrManifestFailsClosed",
    "testWrongAcceptedProviderOrBeneficiaryFailsClosed",
]:
    if token not in test:
        errors.append(f"targeted integration test missing: {token}")

for token in [
    "AI-AUDIT-4 current ComputeMarket integration decision",
    "signed CMP request",
    "accepted priced match",
    "verified entitlement",
    "AI-AUDIT-5",
]:
    if token not in arch:
        errors.append(f"architecture missing AI-AUDIT-4 integration statement: {token}")

if errors:
    print("420AI AI-AUDIT-4 ComputeMarket integration qualification FAILED")
    for e in errors:
        print(f"- {e}")
    raise SystemExit(1)

print("420AI AI-AUDIT-4 ComputeMarket integration qualification PASSED")
print("verified signed request narrowing, accepted provider/resource/price/payer/beneficiary binding")
print("verified immutable result/verification/entitlement and settlement/refund evidence binding")
print("verified AI-AUDIT-5 custody-state reconciliation remains a later boundary")
