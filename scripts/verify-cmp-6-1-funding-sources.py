#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts/src/compute/ComputeUsefulRewardFunding420.sol"
TEST = ROOT / "contracts/test/ComputeUsefulRewardFunding420.t.sol"
SPEC = ROOT / "docs/compute-market/CMP-6.1-FUNDING-SOURCES.md"
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
        "SOURCE_RESEARCHER",
        "SOURCE_UNIVERSITY",
        "SOURCE_GRANT",
        "SOURCE_PHILANTHROPIC",
        "SOURCE_COMMUNITY",
        "SOURCE_ECOSYSTEM",
        "TARGET_JOB",
        "TARGET_POOL",
        "CONTRIBUTION_DOMAIN",
        "fundingReferenceConsumed",
        "fundedBySourceKind",
        "fundedByTarget",
        "fundedByContributor",
        "rewardVault.depositNative{value: msg.value}()",
    ):
        req(marker in contract, f"funding contract missing {marker}")

    for forbidden in (
        ".createObligation(",
        ".releaseObligation(",
        ".cancelObligation(",
        ".claim(",
        ".withdraw(",
        "RewardController",
        "ComputeEscrow",
    ):
        req(forbidden not in contract, f"CMP-6.1 exceeds funding-only authority: {forbidden}")

    for marker in (
        "testResearcherFundsJobIntoCanonicalVault",
        "testAllCanonicalFundingSourceKindsAreAccepted",
        "testMultipleFundingSourcesCanConvergeOnOnePool",
        "testReplayAndInvalidFundingFailClosed",
        "testZeroAmountAndZeroReferencesFailClosed",
        "a.reserved == 0 && a.claimable == 0",
    ):
        req(marker in test, f"CMP-6.1 tests missing {marker}")

    for marker in (
        "# CMP-6.1 — Funding sources",
        "Researcher, university, grant, philanthropic, community and ecosystem-funded jobs/pools.",
        "CMP-6.2 — Verification-gated rewards",
        "Level 1",
        "CMP-6.8 — Phase closeout",
    ):
        req(marker in spec, f"CMP-6.1 specification missing {marker}")

    req("# CMP-6 — Useful-computation rewards" in roadmap, "canonical CMP-6 phase missing")
    req("## CMP-6.1 — Funding sources" in roadmap, "canonical CMP-6.1 step missing")
    req(
        "Researcher, university, grant, philanthropic, community and ecosystem-funded jobs/pools."
        in roadmap,
        "canonical CMP-6.1 definition drifted",
    )
    req(
        "python scripts/verify-cmp-6-1-funding-sources.py" in workflow,
        "Compute Market workflow does not run CMP-6.1 verifier",
    )

if errors:
    for error in errors:
        print("ERROR:", error, file=sys.stderr)
    raise SystemExit(1)

print("CMP-6.1 funding sources verifier: PASS")
