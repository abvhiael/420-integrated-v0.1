#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG = ROOT / "contracts/config/compute-market/cmp-1.5.11-hostile-economic-qualification.json"
WORKER = ROOT / "contracts/test/ComputeStakeWorkerCollateral420.t.sol"
VERIFIER = ROOT / "contracts/test/ComputeStakeVerifierCollateral420.t.sol"
AUTH = ROOT / "contracts/test/ComputeStakeSlashAuthorization420.t.sol"
DIST = ROOT / "contracts/test/ComputeStakeSlashDistribution420.t.sol"
REWARD = ROOT / "contracts/test/ComputeStakeRewardAccounting420.t.sol"
DISPUTE = ROOT / "contracts/test/ComputeVerifierDisputeStakeIntegration420.t.sol"
DOC = ROOT / "docs/compute-market/CMP-1.5.11-HOSTILE-ECONOMIC-QUALIFICATION.md"
ROADMAP = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"

def require_text(path, needles, errors):
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            errors.append(f"{path}: missing {needle}")

def main():
    errors = []
    cfg = json.loads(CFG.read_text(encoding="utf-8"))
    if cfg.get("step") != "CMP-1.5.11": errors.append("step drift")
    if cfg.get("canonical_definition") != "Hostile economic qualification": errors.append("definition drift")
    if cfg.get("qualification", {}).get("level") != 2: errors.append("qualification level drift")
    if cfg.get("next_canonical_step") != "CMP-1.5.12 — Release candidate": errors.append("next-step drift")

    expected = {"solvency","isolation","exit races","slash finality","replay","duplicate withdrawal","duplicate slash","duplicate reward","hostile authorization","reentrancy","failure atomicity"}
    if set(cfg.get("required_campaigns", [])) != expected: errors.append("hostile campaign inventory drift")

    require_text(WORKER, [
        "testDuplicateFullWithdrawalFailsWithoutChangingBacking",
        "testHostileReentrantSlashRecipientCannotMutateStakeLifecycle",
        "testMixedSlashExitWithdrawSequenceRemainsExactlySolvent",
        "testOutstandingObjectiveSlashBlocksMatureWithdrawal",
        "testMissingVaultCreateGrantRevertsAtomically",
        "testPolicyPositionsRemainIsolated"
    ], errors)
    require_text(VERIFIER, [
        "testActiveDisputeStakeHoldBlocksMatureVerifierWithdrawal",
        "testPolicyPositionsRemainIsolated"
    ], errors)
    require_text(AUTH, [
        "testWorkerObjectiveEvidenceAuthorizesBoundedAmountAndReplayFails",
        "testMultipleDistinctMisconductCannotReserveBeyondSlashable",
        "testNonFinalEvidenceCannotAuthorize",
        "testSubjectOrStakePolicyMismatchFailsClosed"
    ], errors)
    require_text(DIST, [
        "testCompletedDistributionCannotReplay",
        "testResolverStateChangeCannotRedirectFrozenAuthorization"
    ], errors)
    require_text(REWARD, [
        "testRewardReplayFailsClosed",
        "testNonFinalAndOverCapRewardsFailClosed",
        "testWrongBeneficiarySubjectAndStakePolicyFailClosed",
        "testInsufficientBackingRevertsWithoutConsumingReward"
    ], errors)
    require_text(DISPUTE, [
        "testAuthorizerFailureLeavesStakeDispositionPending"
    ], errors)
    require_text(DOC, [
        "duplicate withdrawal",
        "Reentrant slash recipient",
        "Mixed-path solvency",
        "Level 2 Compute app milestone",
        "CMP-1.5.12 — Release candidate"
    ], errors)
    require_text(ROADMAP, [
        "### CMP-1.5.11 — Hostile economic qualification"
    ], errors)

    milestone = cfg.get("milestone", {})
    if milestone.get("level_2_required_now") is not True: errors.append("Level 2 milestone missing")

    print(json.dumps({
        "schema": "420Integrated.ComputeMarket.CMP-1.5.11.Qualification.v1",
        "step": "CMP-1.5.11",
        "pass": not errors,
        "errors": errors,
        "required_campaigns": sorted(expected),
        "level_2_milestone": True,
        "next_canonical_step": cfg.get("next_canonical_step")
    }, indent=2))
    if errors: raise SystemExit(1)

if __name__ == "__main__":
    main()
