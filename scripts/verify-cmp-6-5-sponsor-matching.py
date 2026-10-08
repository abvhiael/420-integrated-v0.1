#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts/src/compute/ComputeSponsorMatching420.sol"
TEST = ROOT / "contracts/test/ComputeSponsorMatching420.t.sol"
SPEC = ROOT / "docs/compute-market/CMP-6.5-SPONSOR-MATCHING.md"
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
        "ComputeSponsorMatching420",
        "createProgram",
        "recordMatch",
        "remainingCapacity",
        "sponsorFundingContributionId",
        "perContributionCap",
        "matchForContribution",
        "TARGET_POOL",
        "c.contributor == p.sponsor",
        "c.fundedAt < p.createdAt",
    ):
        req(marker in contract, f"CMP-6.5 contract missing {marker}")

    for forbidden in (
        "createObligation(",
        "releaseObligation(",
        "cancelObligation(",
        ".claim(",
        ".withdraw(",
        "transfer(",
        "RewardController",
        "ComputeEscrow",
        "beneficiary;",
        "rewardRate",
    ):
        req(forbidden not in contract, f"CMP-6.5 exceeds matching-accounting authority: {forbidden}")

    for marker in (
        "testSponsorFundingBacksFiniteOneToOneProgram",
        "testThirdPartyPoolFundingConsumesMatchCapacityAtFrozenRatio",
        "testRatioAndPerContributionCapAreAppliedDeterministically",
        "testRemainingCapacityCapsFinalMatch",
        "testSponsorCannotSelfMatchOrReplaySameFundingContribution",
        "testWrongPoolPreProgramFundingAndClosedPoolFailClosed",
        "testOnlySponsorControlsProgramActivation",
        "testInvalidRatioAndUnbackedSponsorFailClosed",
    ):
        req(marker in test, f"CMP-6.5 tests missing {marker}")

    for marker in (
        "# CMP-6.5 — Sponsor matching",
        "Level 2 app integration milestone",
        "CMP-6.6 — Anti-Sybil / anti-farming economics",
        "CMP-6.8 — Phase closeout",
    ):
        req(marker in spec, f"CMP-6.5 specification missing {marker}")

    req("## CMP-6.5 — Sponsor matching" in roadmap, "canonical CMP-6.5 step missing")
    req(
        "python scripts/verify-cmp-6-5-sponsor-matching.py" in workflow,
        "Compute Market workflow does not run CMP-6.5 verifier",
    )

if errors:
    for error in errors:
        print("ERROR:", error, file=sys.stderr)
    raise SystemExit(1)

print("CMP-6.5 sponsor matching verifier: PASS")
