#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "contracts/src/compute/ComputeUsefulContributionPolicy420.sol"
ACCOUNTING = ROOT / "contracts/src/compute/ComputeUsefulContributionAccounting420.sol"
TEST = ROOT / "contracts/test/ComputeUsefulContributionAccounting420.t.sol"
SPEC = ROOT / "docs/compute-market/CMP-6.3-CONTRIBUTION-ACCOUNTING.md"
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
        "METRIC_WORK_UNITS",
        "METRIC_CPU_MILLISECONDS",
        "METRIC_GPU_MILLISECONDS",
        "METRIC_PROJECT_CREDIT",
        "METRIC_CUSTOM",
        "sourceCodeHash",
        "maxAmount",
        "latestRevision",
    ):
        req(marker in policy, f"CMP-6.3 policy missing {marker}")

    for marker in (
        "ComputeUsefulContributionAccounting420",
        "recordContribution",
        "currentlyVerified",
        "sourceContributionConsumed",
        "totalByContributorMetric",
        "totalByProjectMetric",
        "totalByJobMetric",
        "totalByMetric",
        "finalMeasured",
        "e.observedAt < g.gatedAt",
    ):
        req(marker in accounting, f"CMP-6.3 accounting missing {marker}")

    for forbidden in (
        "createObligation(",
        "releaseObligation(",
        "cancelObligation(",
        ".claim(",
        ".withdraw(",
        "RewardController",
        "ComputeEscrow",
        "rewardRate",
        "beneficiary",
    ):
        req(forbidden not in accounting, f"CMP-6.3 exceeds accounting-only authority: {forbidden}")

    for marker in (
        "testVerifiedWorkUnitsRecordExactTypedAccounting",
        "testCpuGpuProjectCreditAndCustomMetricsRemainDistinct",
        "testUnverifiedGateAndPreGateMeasurementFailClosed",
        "testMetricPolicyMismatchNonFinalZeroAndOverCapFailClosed",
        "testSourceReferenceReplayFailsClosedWithoutDoubleAccounting",
        "testPolicyRevisionsAreAppendOnlyAndSourceCodeHashPinned",
    ):
        req(marker in test, f"CMP-6.3 tests missing {marker}")

    for marker in (
        "# CMP-6.3 — Contribution accounting",
        "Verified work units, CPU/GPU hours, project credit and other policy-defined metrics.",
        "ordinary **Level 1** step",
        "CMP-6.4 — Research reward pools",
        "CMP-6.8 — Phase closeout",
    ):
        req(marker in spec, f"CMP-6.3 specification missing {marker}")

    req("## CMP-6.3 — Contribution accounting" in roadmap, "canonical CMP-6.3 step missing")
    req(
        "Verified work units, CPU/GPU hours, project credit and other policy-defined metrics."
        in roadmap,
        "canonical CMP-6.3 definition drifted",
    )
    req(
        "python scripts/verify-cmp-6-3-contribution-accounting.py" in workflow,
        "Compute Market workflow does not run CMP-6.3 verifier",
    )

if errors:
    for error in errors:
        print("ERROR:", error, file=sys.stderr)
    raise SystemExit(1)

print("CMP-6.3 contribution accounting verifier: PASS")
