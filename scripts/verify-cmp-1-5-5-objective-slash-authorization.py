#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG = ROOT / "contracts/config/compute-market/cmp-1.5.5-objective-slash-authorization.json"
POLICY = ROOT / "contracts/src/compute/ComputeStakeSlashPolicy420.sol"
AUTH = ROOT / "contracts/src/compute/ComputeStakeSlashAuthorization420.sol"
WORKER_EVIDENCE = ROOT / "contracts/src/compute/ComputeWorkerConflictingResultSlashEvidence420.sol"
VERIFIER_EVIDENCE = ROOT / "contracts/src/compute/ComputeVerifierDisputeSlashEvidence420.sol"
WORKER = ROOT / "contracts/src/compute/ComputeStakeWorkerCollateral420.sol"
VERIFIER = ROOT / "contracts/src/compute/ComputeStakeVerifierCollateral420.sol"
AUTH_TEST = ROOT / "contracts/test/ComputeStakeSlashAuthorization420.t.sol"
POLICY_TEST = ROOT / "contracts/test/ComputeStakeSlashPolicy420.t.sol"
WORKER_EVIDENCE_TEST = ROOT / "contracts/test/ComputeWorkerConflictingResultSlashEvidence420.t.sol"
VERIFIER_EVIDENCE_TEST = ROOT / "contracts/test/ComputeVerifierDisputeSlashEvidence420.t.sol"
WORKER_TEST = ROOT / "contracts/test/ComputeStakeWorkerCollateral420.t.sol"
VERIFIER_TEST = ROOT / "contracts/test/ComputeStakeVerifierCollateral420.t.sol"
DOC = ROOT / "docs/compute-market/CMP-1.5.5-OBJECTIVE-SLASH-AUTHORIZATION.md"
ROADMAP = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"

def require_text(path, needles, errors):
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            errors.append(f"{path}: missing {needle}")

def forbid_text(path, needles, errors):
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle in text:
            errors.append(f"{path}: forbidden {needle}")

def main():
    errors = []
    cfg = json.loads(CFG.read_text(encoding="utf-8"))

    if cfg.get("step") != "CMP-1.5.5":
        errors.append("step drift")
    if cfg.get("canonical_definition") != "Objective slash authorization":
        errors.append("canonical definition drift")
    if cfg.get("qualification", {}).get("level") != 2:
        errors.append("qualification level drift")
    if cfg.get("next_canonical_step") != "CMP-1.5.6 — Slash distribution":
        errors.append("next step drift")

    require_text(ROADMAP, ["### CMP-1.5.5 — Objective slash authorization"], errors)

    require_text(POLICY, [
        "contract ComputeStakeSlashPolicy420",
        "evidenceAdapterCodeHash",
        "requiredVerificationPolicyCommitment",
        "slashBps",
        "maxSlashAmount",
        "function commitment("
    ], errors)

    require_text(AUTH, [
        "contract ComputeStakeSlashAuthorization420",
        "function authorize(",
        "misconductConsumed",
        "outstandingSlash",
        "slashPolicyRevision != frozenSlashPolicyRevision",
        "exactPolicyCommitment != frozenSlashPolicyCommitment",
        "p.evidenceAdapter.codehash != p.evidenceAdapterCodeHash",
        "e.subjectRef != subjectRef",
        "e.subjectAccount != beneficiary",
        "e.violationCode != p.violationCode",
        "evidenceAt < openedAt",
        "outstandingSlash[positionId] = already + amount"
    ], errors)
    forbid_text(AUTH, [
        "vault.releaseObligation(",
        "vault.claim(",
        "vault.withdraw("
    ], errors)

    require_text(WORKER_EVIDENCE, [
        "contract ComputeWorkerConflictingResultSlashEvidence420",
        "resultExecutionDigest",
        "ECDSA420.tryRecover(firstDigest, firstSignature)",
        "ECDSA420.tryRecover(secondDigest, secondSignature)",
        "a.admission.stakePolicyId",
        "a.admission.stakeReference",
        "evidenceForMisconduct",
        "VIOLATION_CODE"
    ], errors)
    forbid_text(WORKER_EVIDENCE, [
        "Status.FAILED",
        "provider suspension",
        "trust"
    ], errors)

    require_text(VERIFIER_EVIDENCE, [
        "OBJECTIVE_VERIFIER_ERROR_GROUND",
        "r.status == CASE_FINAL",
        "r.finalDisposition",
        "r.adverseToOriginalVerification",
        "!r.providerWins",
        "r.initialAdjudicator != address(0)",
        "r.appealAdjudicator == r.initialAdjudicator",
        "VIOLATION_CODE"
    ], errors)

    for path, kind in ((WORKER, "1"), (VERIFIER, "2")):
        require_text(path, [
            "slashPolicyRevision",
            "slashPolicyCommitment",
            "slashPolicies.latestRevision",
            "slashPolicies.commitment",
            "function bindSlashAuthorization(",
            "IComputeSlashHold420(slashAuthorization).outstandingSlash(id)",
            "function slashSnapshot(bytes32 id)"
        ], errors)

    require_text(POLICY_TEST, [
        "testOnlyGovernanceCanPublishAndPolicyMustBeWellFormed",
        "testRevisionsAndCommitmentsAreAppendOnly",
        "testPolicyFreezesEvidenceAdapterCodeHash"
    ], errors)
    require_text(AUTH_TEST, [
        "testWorkerObjectiveEvidenceAuthorizesBoundedAmountAndReplayFails",
        "testVerifierAuthorizationRequiresExactVerificationPolicyAndCapsAmount",
        "testVerificationPolicyMismatchFailsClosed",
        "testSubjectOrStakePolicyMismatchFailsClosed",
        "testLaterSlashPolicyRevisionCannotApplyRetroactively",
        "testMultipleDistinctMisconductCannotReserveBeyondSlashable",
        "testNonFinalEvidenceCannotAuthorize"
    ], errors)
    require_text(WORKER_EVIDENCE_TEST, [
        "testTwoConflictingSignedResultsProduceOneObjectiveMisconductRecord",
        "testIdenticalResultDoesNotCreateMisconduct",
        "testWrongExecutionSignatureFailsClosed",
        "testSwappedPairCannotCreateSecondSlashEvent",
        "testMissingStakeBindingCannotBecomeSlashEvidence"
    ], errors)
    require_text(VERIFIER_EVIDENCE_TEST, [
        "testFinalIndependentObjectiveVerifierErrorProducesEvidence",
        "testTimeoutOrNonFinalDispositionCannotBeSlashEvidence",
        "testGenericAdverseDisputeGroundDoesNotProveVerifierFault",
        "testUnresolvedOrNonIndependentAppealCannotAuthorize",
        "testProviderWinOrNonAdverseDispositionCannotAuthorize"
    ], errors)
    require_text(WORKER_TEST, ["testOutstandingObjectiveSlashBlocksMatureWithdrawal"], errors)
    require_text(VERIFIER_TEST, ["testOutstandingObjectiveSlashBlocksMatureVerifierWithdrawal"], errors)

    require_text(DOC, [
        "cryptographically conflicting signed results",
        "generic adverse dispute disposition",
        "later policy revision cannot apply retroactively",
        "CMP-1.5.6 — Slash distribution"
    ], errors)

    milestone = cfg.get("milestone", {})
    if milestone.get("level_2_required_now") is not True:
        errors.append("Level 2 milestone missing")

    deferred = set(cfg.get("deferred", []))
    for prefix in (
        "CMP-1.5.6","CMP-1.5.7","CMP-1.5.8","CMP-1.5.9",
        "CMP-1.5.10","CMP-1.5.11","CMP-1.5.12","CMP-1.5.13"
    ):
        if not any(x.startswith(prefix) for x in deferred):
            errors.append(f"missing deferred owner {prefix}")

    print(json.dumps({
        "schema":"420Integrated.ComputeMarket.CMP-1.5.5.Qualification.v1",
        "step":"CMP-1.5.5",
        "pass":not errors,
        "errors":errors,
        "level_2_milestone":True,
        "next_canonical_step":cfg.get("next_canonical_step")
    }, indent=2))
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
