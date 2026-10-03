#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG = ROOT / "contracts/config/compute-market/cmp-1.5.7-reward-accounting.json"
POLICY = ROOT / "contracts/src/compute/ComputeStakeRewardPolicy420.sol"
ACCOUNTING = ROOT / "contracts/src/compute/ComputeStakeRewardAccounting420.sol"
SOURCE = ROOT / "contracts/src/interfaces/IComputeStakeRewardSource420.sol"
TEST_POLICY = ROOT / "contracts/test/ComputeStakeRewardPolicy420.t.sol"
TEST_ACCOUNTING = ROOT / "contracts/test/ComputeStakeRewardAccounting420.t.sol"
DOC = ROOT / "docs/compute-market/CMP-1.5.7-REWARD-ACCOUNTING.md"
ROADMAP = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"

def require_text(path, needles, errors):
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            errors.append(f"{path}: missing {needle}")

def main():
    errors = []
    cfg = json.loads(CFG.read_text(encoding="utf-8"))

    if cfg.get("step") != "CMP-1.5.7":
        errors.append("step drift")
    if cfg.get("canonical_definition") != "Reward accounting":
        errors.append("canonical definition drift")
    if cfg.get("qualification", {}).get("level") != 2:
        errors.append("qualification level drift")
    if cfg.get("next_canonical_step") != "CMP-1.5.8 — Dispute/stake integration":
        errors.append("next-step drift")

    require_text(ROADMAP, [
        "### CMP-1.5.7 — Reward accounting"
    ], errors)

    require_text(POLICY, [
        "contract ComputeStakeRewardPolicy420",
        "rewardSourceCodeHash",
        "maxRewardAmount",
        "onlyGovernance",
        "subjectKind != SUBJECT_WORKER",
        "subjectKind != SUBJECT_VERIFIER",
        "rewardSource.codehash",
        "function commitment("
    ], errors)

    require_text(SOURCE, [
        "interface IComputeStakeRewardSource420",
        "struct RewardEvidence",
        "positionId",
        "subjectKind",
        "beneficiary",
        "stakePolicyId",
        "amount",
        "earnedAt",
        "evidenceCommitment",
        "finalEarned",
        "function rewardEvidence("
    ], errors)

    require_text(ACCOUNTING, [
        "contract ComputeStakeRewardAccounting420",
        "function reward(",
        "sourceRewardConsumed",
        "creditedByBeneficiary",
        "creditedByPosition",
        "p.rewardSource.codehash != p.rewardSourceCodeHash",
        "!e.finalEarned",
        "e.amount > p.maxRewardAmount",
        "e.earnedAt < openedAt",
        "rewardVault.createObligation(",
        "rewardVault.releaseObligation(",
        "REWARD_OBLIGATION_TYPE",
        "address(0)",
        "IComputeSlashableCollateral420(collateral).slashSnapshot"
    ], errors)

    # The reward accounting implementation must not import or call payer escrow or consensus
    # issuance authority. Exact prohibition keeps economic domains separated.
    accounting_text = ACCOUNTING.read_text(encoding="utf-8")
    for forbidden in ("ComputeEscrow", "RewardController", "mint("):
        if forbidden in accounting_text:
            errors.append(f"{ACCOUNTING}: forbidden economic authority {forbidden}")

    require_text(TEST_POLICY, [
        "testOnlyGovernanceCanPublishAndShapeIsBounded",
        "testRevisionsAndCommitmentsAreAppendOnly",
        "testWorkerAndVerifierPoliciesAreIndependent"
    ], errors)

    require_text(TEST_ACCOUNTING, [
        "testWorkerRewardCreatesExactClaimableVaultObligationAndClaim",
        "testRewardReplayFailsClosed",
        "testNonFinalAndOverCapRewardsFailClosed",
        "testWrongBeneficiarySubjectAndStakePolicyFailClosed",
        "testVerifierRewardUsesVerifierCollateralIdentity",
        "testHistoricalEarnedRewardSurvivesLaterInactivePosition",
        "testRewardBeforeCollateralOpenedFailsClosed",
        "testInsufficientBackingRevertsWithoutConsumingReward"
    ], errors)

    require_text(DOC, [
        "separately authorized reward source",
        "cannot mint",
        "payer escrow",
        "historical",
        "insufficient backing",
        "CMP-1.5.8 — Dispute/stake integration"
    ], errors)

    milestone = cfg.get("milestone", {})
    if milestone.get("level_2_required_now") is not True:
        errors.append("Level 2 milestone missing")
    if "retained Compute*.t.sol suite" not in milestone.get("retained_app_suite", ""):
        errors.append("retained app suite missing")

    deferred = set(cfg.get("deferred", []))
    for prefix in (
        "CMP-1.5.8","CMP-1.5.9","CMP-1.5.10",
        "CMP-1.5.11","CMP-1.5.12","CMP-1.5.13"
    ):
        if not any(x.startswith(prefix) for x in deferred):
            errors.append(f"missing deferred owner {prefix}")

    print(json.dumps({
        "schema":"420Integrated.ComputeMarket.CMP-1.5.7.Qualification.v1",
        "step":"CMP-1.5.7",
        "pass":not errors,
        "errors":errors,
        "level_2_milestone":True,
        "next_canonical_step":cfg.get("next_canonical_step")
    }, indent=2))
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
