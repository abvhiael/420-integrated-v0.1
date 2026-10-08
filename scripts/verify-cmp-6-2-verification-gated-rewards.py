#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts/src/compute/ComputeUsefulRewardVerification420.sol"
TEST = ROOT / "contracts/test/ComputeUsefulRewardVerification420.t.sol"
SPEC = ROOT / "docs/compute-market/CMP-6.2-VERIFICATION-GATED-REWARDS.md"
ROADMAP = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
WORKFLOW = ROOT / ".github/workflows/compute-market.yml"

errors = []

def req(ok, msg):
    if not ok:
        errors.append(msg)

for path in (CONTRACT, TEST, SPEC, ROADMAP, WORKFLOW):
    req(path.exists(), f"missing {path.relative_to(ROOT)}")

if not errors:
    contract = CONTRACT.read_text()
    test = TEST.read_text()
    spec = SPEC.read_text()
    roadmap = ROADMAP.read_text()
    workflow = WORKFLOW.read_text()

    for marker in (
        "ComputeUsefulRewardVerification420",
        "GATE_DOMAIN",
        "gateJobReward",
        "currentlyVerified",
        "ComputeJobRegistry420.Status.VERIFIED",
        "verificationEvidence.verified",
        "fundedByTarget",
        "fundedSnapshot",
        "gateForJob",
    ):
        req(marker in contract, f"CMP-6.2 contract missing {marker}")

    for forbidden in (
        "createObligation(",
        "releaseObligation(",
        "cancelObligation(",
        ".claim(",
        ".withdraw(",
        "RewardController",
        "ComputeEscrow",
        "beneficiary;",
        "rewardAmount",
    ):
        req(forbidden not in contract, f"CMP-6.2 exceeds verification-only authority: {forbidden}")

    for marker in (
        "testFundedVerifiedJobCreatesImmutableGate",
        "testUnfundedJobCannotCreateRewardGate",
        "testNonVerifiedRejectedAndStaleRevisionFailClosed",
        "testGateReplayFailsClosed",
        "testCurrentEligibilityFailsClosedOnDisputeOrEvidenceRevocation",
        "testVerificationIdentityDriftFailsCurrentEligibility",
    ):
        req(marker in test, f"CMP-6.2 tests missing {marker}")

    for marker in (
        "# CMP-6.2 — Verification-gated rewards",
        "first CMP-6 Level 2 integration milestone",
        "CMP-6.3 — Contribution accounting",
        "CMP-6.8 — Phase closeout",
    ):
        req(marker in spec, f"CMP-6.2 specification missing {marker}")

    req("## CMP-6.2 — Verification-gated rewards" in roadmap, "canonical CMP-6.2 step missing")
    req(
        "python scripts/verify-cmp-6-2-verification-gated-rewards.py" in workflow,
        "Compute Market workflow does not run CMP-6.2 verifier",
    )

if errors:
    for error in errors:
        print("ERROR:", error, file=sys.stderr)
    raise SystemExit(1)

print("CMP-6.2 verification-gated rewards verifier: PASS")
