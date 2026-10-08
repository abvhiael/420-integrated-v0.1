#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts/src/compute/ComputeUsefulAntiFarming420.sol"
TEST = ROOT / "contracts/test/ComputeUsefulAntiFarming420.t.sol"
SPEC = ROOT / "docs/compute-market/CMP-6.6-ANTI-SYBIL-ANTI-FARMING-ECONOMICS.md"
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
        "ComputeUsefulAntiFarming420",
        "publishPolicy",
        "setPrincipalOverride",
        "principalKey",
        "admit(",
        "epochSeconds",
        "cooldownSeconds",
        "maxMatchesPerPrincipalPerEpoch",
        "minContributionAmount",
        "maxMatchedPerPrincipalPerEpoch",
        "matchConsumed",
        "matchCountByPoolPrincipalEpoch",
        "matchedByPoolPrincipalEpoch",
        "lastAdmissionAt",
    ):
        req(marker in contract, f"CMP-6.6 contract missing {marker}")

    for forbidden in (
        "createObligation(",
        "releaseObligation(",
        "cancelObligation(",
        ".claim(",
        ".withdraw(",
        "transfer(",
        "slash(",
        "RewardController",
        "ComputeEscrow",
        "rewardRate",
        "beneficiary;",
    ):
        req(forbidden not in contract, f"CMP-6.6 exceeds anti-farming admission authority: {forbidden}")

    for marker in (
        "testAdmitsMatchUnderFrozenEconomicLimits",
        "testMinimumContributionFailsClosed",
        "testPerPrincipalCountCapRejectsFarmingBurst",
        "testPerPrincipalMatchedAmountCapRejectsSplitFunding",
        "testCooldownRejectsRapidRepeat",
        "testGovernanceClusterKeyMakesTwoAddressesShareLimits",
        "testPoolScopedLimitsDoNotCrossContaminateIndependentResearchPools",
        "testNewEpochRestoresCapsButReplayNeverResets",
        "testPolicyRevisionsAreAppendOnlyAndExact",
        "testOnlyGovernanceCanClusterPrincipalKeys",
    ):
        req(marker in test, f"CMP-6.6 tests missing {marker}")

    for marker in (
        "# CMP-6.6 — Anti-Sybil / anti-farming economics",
        "ordinary **Level 1** step",
        "CMP-6.7 — Transparent reward accounting",
        "CMP-6.8 — Phase closeout",
        "cannot prove that unrelated addresses belong to the same real-world person",
    ):
        req(marker in spec, f"CMP-6.6 specification missing {marker}")

    req(
        "## CMP-6.6 — Anti-Sybil / anti-farming economics" in roadmap,
        "canonical CMP-6.6 step missing",
    )
    req(
        "python scripts/verify-cmp-6-6-anti-farming-economics.py" in workflow,
        "Compute Market workflow does not run CMP-6.6 verifier",
    )

if errors:
    for error in errors:
        print("ERROR:", error, file=sys.stderr)
    raise SystemExit(1)

print("CMP-6.6 anti-Sybil / anti-farming economics verifier: PASS")
