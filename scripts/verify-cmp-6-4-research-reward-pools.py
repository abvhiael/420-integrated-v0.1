#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts/src/compute/ComputeResearchRewardPool420.sol"
TEST = ROOT / "contracts/test/ComputeResearchRewardPool420.t.sol"
SPEC = ROOT / "docs/compute-market/CMP-6.4-RESEARCH-REWARD-POOLS.md"
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
        "ComputeResearchRewardPool420",
        "createPool",
        "setAcceptance",
        "fundedAmount",
        "eligibleContribution",
        "isCurrentAcceptable",
        "TARGET_POOL",
        "projectCommitment",
        "policyCommitment",
        "metricKind",
        "metricId",
    ):
        req(marker in contract, f"CMP-6.4 contract missing {marker}")

    for forbidden in (
        "createObligation(",
        "releaseObligation(",
        "cancelObligation(",
        ".claim(",
        ".withdraw(",
        "transfer(",
        "RewardController",
        "ComputeEscrow",
        "sponsorMatch",
        "rewardRate",
        "rewardAmount",
    ):
        req(forbidden not in contract, f"CMP-6.4 exceeds pool-classification authority: {forbidden}")

    for marker in (
        "testCanonicalResearchDomainsCanCreateDistinctPools",
        "testPoolFreezesExactProjectAndMetricPolicy",
        "testPoolFundingIsReportedButNotConsumed",
        "testCompatibleVerifiedContributionIsEligibleOnlyWhenFundedAndOpen",
        "testProjectPolicyAndMetricMismatchFailClosed",
        "testStaleProjectRevisionCannotCreatePool",
        "testPoolIdentityIsReplaySafeAndOwnerControlsAcceptance",
    ):
        req(marker in test, f"CMP-6.4 tests missing {marker}")

    for marker in (
        "# CMP-6.4 — Research reward pools",
        "cancer research",
        "protein folding",
        "climate simulation",
        "astronomy",
        "drug discovery",
        "ordinary **Level 1** step",
        "CMP-6.5 — Sponsor matching",
        "CMP-6.8 — Phase closeout",
    ):
        req(marker in spec, f"CMP-6.4 specification missing {marker}")

    req("## CMP-6.4 — Research reward pools" in roadmap, "canonical CMP-6.4 step missing")
    req(
        "Examples: cancer research, protein folding, climate simulation, astronomy, drug discovery."
        in roadmap,
        "canonical CMP-6.4 examples drifted",
    )
    req(
        "python scripts/verify-cmp-6-4-research-reward-pools.py" in workflow,
        "Compute Market workflow does not run CMP-6.4 verifier",
    )

if errors:
    for error in errors:
        print("ERROR:", error, file=sys.stderr)
    raise SystemExit(1)

print("CMP-6.4 research reward pools verifier: PASS")
