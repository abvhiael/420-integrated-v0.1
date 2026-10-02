#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG = ROOT / "contracts/config/compute-market/cmp-1.5.4-exit-queue-withdrawal-delay.json"
POLICY = ROOT / "contracts/src/compute/ComputeStakeExitPolicy420.sol"
WORKER = ROOT / "contracts/src/compute/ComputeStakeWorkerCollateral420.sol"
VERIFIER = ROOT / "contracts/src/compute/ComputeStakeVerifierCollateral420.sol"
POLICY_TEST = ROOT / "contracts/test/ComputeStakeExitPolicy420.t.sol"
WORKER_TEST = ROOT / "contracts/test/ComputeStakeWorkerCollateral420.t.sol"
VERIFIER_TEST = ROOT / "contracts/test/ComputeStakeVerifierCollateral420.t.sol"
DOC = ROOT / "docs/compute-market/CMP-1.5.4-EXIT-QUEUE-WITHDRAWAL-DELAY.md"
ROADMAP = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"

def require_text(path, needles, errors):
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            errors.append(f"{path}: missing {needle}")

def main():
    errors = []
    cfg = json.loads(CFG.read_text(encoding="utf-8"))

    if cfg.get("step") != "CMP-1.5.4":
        errors.append("step drift")
    if cfg.get("canonical_definition") != "Exit queue / withdrawal delay":
        errors.append("canonical definition drift")
    if cfg.get("qualification", {}).get("level") != 2:
        errors.append("qualification level drift")
    if cfg.get("next_canonical_step") != "CMP-1.5.5 — Objective slash authorization":
        errors.append("next step drift")

    require_text(ROADMAP, ["### CMP-1.5.4 — Exit queue / withdrawal delay"], errors)

    require_text(POLICY, [
        "contract ComputeStakeExitPolicy420",
        "withdrawalDelaySeconds",
        "mapping(bytes32 => uint32) public latestRevision",
        "function currentPolicy",
        "function commitment"
    ], errors)

    for path, label, collateral_type in (
        (WORKER, "worker", "WORKER_COLLATERAL_TYPE"),
        (VERIFIER, "verifier", "VERIFIER_COLLATERAL_TYPE"),
    ):
        require_text(path, [
            "function requestExit(bytes32 id)",
            "function withdraw(bytes32 id, uint64 maxTranches)",
            "exitPolicyRevision",
            "exitPolicyCommitment",
            "withdrawalCursor",
            "p.exiting = true",
            "block.timestamp < p.withdrawableAt",
            "vault.releaseObligation(",
            "vault.claim(",
            collateral_type,
            "p.activeAmount -= t.amount",
            "p.slashableAmount -= t.amount",
            "p.active = false",
            "p.exiting = false"
        ], errors)

    require_text(POLICY_TEST, [
        "testOnlyGovernanceCanPublishNonzeroDelay",
        "testRevisionsAreAppendOnlyAndCommitmentBound",
        "testCurrentPolicyReturnsExactRevisionAndCommitment"
    ], errors)

    require_text(WORKER_TEST, [
        "testExitRequestSnapshotsDelayAndKeepsCollateralSlashable",
        "testWithdrawalBeforeMaturityFailsAndTopUpAfterExitFails",
        "testExitDelayRevisionCannotRewritePendingExit",
        "testBatchedWithdrawalReleasesAndClaimsExactTranches",
        "testOnlyPositionOwnerCanRequestOrWithdrawExit"
    ], errors)

    require_text(VERIFIER_TEST, [
        "testVerifierExitSnapshotsDelayAndKeepsCollateralSlashable",
        "testOldAuthorityCanExitHistoricalPositionAfterRotation",
        "testVerifierWithdrawalBeforeMaturityFailsAndTopUpDuringExitFails",
        "testVerifierExitDelayRevisionCannotRewritePendingExit",
        "testVerifierBatchedWithdrawalPreservesRemainingSlashableCollateral",
        "testOnlyStoredVerifierAuthorityCanRequestAndWithdrawExit"
    ], errors)

    require_text(DOC, [
        "batched",
        "Later policy revisions cannot accelerate or extend an already-requested exit.",
        "historical verifier authority retains its own exit right",
        "CMP-1.5.5 — Objective slash authorization"
    ], errors)

    milestone = cfg.get("milestone", {})
    if milestone.get("level_2_required_now") is not True:
        errors.append("Level 2 lifecycle milestone missing")
    if "retained Compute*.t.sol suite" not in milestone.get("retained_app_suite", ""):
        errors.append("retained app suite missing")

    deferred = set(cfg.get("deferred", []))
    for prefix in (
        "CMP-1.5.5","CMP-1.5.6","CMP-1.5.7","CMP-1.5.8",
        "CMP-1.5.9","CMP-1.5.10","CMP-1.5.11","CMP-1.5.12","CMP-1.5.13"
    ):
        if not any(x.startswith(prefix) for x in deferred):
            errors.append(f"missing deferred owner {prefix}")

    print(json.dumps({
        "schema":"420Integrated.ComputeMarket.CMP-1.5.4.Qualification.v1",
        "step":"CMP-1.5.4",
        "pass":not errors,
        "errors":errors,
        "level_2_milestone":True,
        "next_canonical_step":cfg.get("next_canonical_step")
    }, indent=2))
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
