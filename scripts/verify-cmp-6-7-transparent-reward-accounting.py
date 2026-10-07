#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "contracts/src/compute/ComputeUsefulRewardPolicy420.sol"
ACCOUNTING = ROOT / "contracts/src/compute/ComputeUsefulRewardAccounting420.sol"
TEST = ROOT / "contracts/test/ComputeUsefulRewardAccounting420.t.sol"
SPEC = ROOT / "docs/compute-market/CMP-6.7-TRANSPARENT-REWARD-ACCOUNTING.md"
ROADMAP = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
WORKFLOW = ROOT / ".github/workflows/compute-market.yml"

errors = []

def req(ok, msg):
    if not ok:
        errors.append(msg)

for path in (POLICY, ACCOUNTING, TEST, SPEC, ROADMAP, WORKFLOW):
    req(path.exists(), f"missing {path.relative_to(ROOT)}")

if not errors:
    policy = POLICY.read_text()
    accounting = ACCOUNTING.read_text()
    test = TEST.read_text()
    spec = SPEC.read_text()
    roadmap = ROADMAP.read_text()
    workflow = WORKFLOW.read_text()

    for marker in (
        "ComputeUsefulRewardPolicy420",
        "publish(",
        "numerator",
        "denominator",
        "perContributionCap",
        "latestRevision",
        "commitment(",
    ):
        req(marker in policy, f"CMP-6.7 policy missing {marker}")

    for marker in (
        "ComputeUsefulRewardAccounting420",
        "accountReward",
        "eligibleContribution",
        "contributionRewardConsumed",
        "creditedByPool",
        "creditedByBeneficiary",
        "creditedByMetric",
        "remainingAccountableFunding",
        "poolFundingSnapshot",
        "rewardPolicyCommitment",
        "type(uint256).max / p.numerator",
    ):
        req(marker in accounting, f"CMP-6.7 accounting missing {marker}")

    for forbidden in (
        "createObligation(",
        "releaseObligation(",
        "cancelObligation(",
        ".claim(",
        ".withdraw(",
        "transfer(",
        "slash(",
        "ComputeEscrow",
        "AssetVault420",
        "VaultAccounting420",
    ):
        req(forbidden not in accounting, f"CMP-6.7 exceeds transparent-accounting authority: {forbidden}")

    for marker in (
        "testTransparentRewardRecordFreezesAllArithmeticInputs",
        "testPerContributionCapIsDeterministic",
        "testAggregateCreditsAndRemainingFundingAreTransparent",
        "testPoolFundingBudgetCannotBeOvercredited",
        "testContributionCanNeverBeRewardedTwiceAcrossPolicyRevisions",
        "testIneligibleContributionFailsClosed",
        "testMetricMismatchFailsClosed",
        "testZeroAfterIntegerDivisionFailsClosed",
        "testOverflowingRewardArithmeticFailsClosed",
        "testRewardPoliciesAreAppendOnlyAndHistoricCommitmentStable",
    ):
        req(marker in test, f"CMP-6.7 tests missing {marker}")

    for marker in (
        "# CMP-6.7 — Transparent reward accounting",
        "Level 2 app integration milestone",
        "CMP-6.8 — Phase closeout",
        "one contribution cannot be rewarded twice",
        "no Vault/custody/payout/consensus authority is introduced",
    ):
        req(marker in spec, f"CMP-6.7 specification missing {marker}")

    req(
        "## CMP-6.7 — Transparent reward accounting" in roadmap,
        "canonical CMP-6.7 step missing",
    )
    req(
        "python scripts/verify-cmp-6-7-transparent-reward-accounting.py" in workflow,
        "Compute Market workflow does not run CMP-6.7 verifier",
    )

if errors:
    for error in errors:
        print("ERROR:", error, file=sys.stderr)
    raise SystemExit(1)

print("CMP-6.7 transparent reward accounting verifier: PASS")
