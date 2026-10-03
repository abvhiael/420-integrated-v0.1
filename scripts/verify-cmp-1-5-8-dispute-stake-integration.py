#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG = ROOT / "contracts/config/compute-market/cmp-1.5.8-dispute-stake-integration.json"
DISPUTES = ROOT / "contracts/src/compute/ComputeDisputeResolution420.sol"
COLLATERAL = ROOT / "contracts/src/compute/ComputeStakeVerifierCollateral420.sol"
EVIDENCE = ROOT / "contracts/src/compute/ComputeVerifierDisputeStakeEvidence420.sol"
INTEGRATION = ROOT / "contracts/src/compute/ComputeVerifierDisputeStakeIntegration420.sol"
HOLD_IFACE = ROOT / "contracts/src/interfaces/IComputeVerifierDisputeStakeHold420.sol"
TEST_EVIDENCE = ROOT / "contracts/test/ComputeVerifierDisputeStakeEvidence420.t.sol"
TEST_INTEGRATION = ROOT / "contracts/test/ComputeVerifierDisputeStakeIntegration420.t.sol"
TEST_COLLATERAL = ROOT / "contracts/test/ComputeStakeVerifierCollateral420.t.sol"
DOC = ROOT / "docs/compute-market/CMP-1.5.8-DISPUTE-STAKE-INTEGRATION.md"
ROADMAP = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"

def require_text(path, needles, errors):
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            errors.append(f"{path}: missing {needle}")

def main():
    errors = []
    cfg = json.loads(CFG.read_text(encoding="utf-8"))

    if cfg.get("step") != "CMP-1.5.8":
        errors.append("step drift")
    if cfg.get("canonical_definition") != "Dispute/stake integration":
        errors.append("canonical definition drift")
    if cfg.get("qualification", {}).get("level") != 2:
        errors.append("qualification level drift")
    if cfg.get("next_canonical_step") != "CMP-1.5.9 — WorkerRegistry stake-source integration":
        errors.append("next-step drift")

    require_text(DISPUTES, [
        "ComputeVerifierRegistry420 public verifierRegistry",
        "mapping(bytes32 => bytes32) public verifierIdForDispute",
        "mapping(address => uint256) public activeVerifierStakeHoldCount",
        "mapping(bytes32 => bool) public stakeDispositionPending",
        "function bindVerifierStakeIntegration(",
        "verifierRegistry.verifierIdForAuthority(j.verifier)",
        "activeVerifierStakeHoldCount[j.verifier] += 1",
        "OBJECTIVE_VERIFIER_ERROR_GROUND",
        "stakeDispositionPending[disputeId] = true",
        "function verifierStakeHold(address verifier)",
        "function acknowledgeStakeDisposition(",
        "_releaseVerifierStakeHold"
    ], errors)

    require_text(COLLATERAL, [
        "IComputeVerifierDisputeStakeHold420",
        "address public disputeStakeHold",
        "function bindDisputeStakeHold(",
        ".verifierStakeHold(p.authority)"
    ], errors)

    require_text(EVIDENCE, [
        "contract ComputeVerifierDisputeStakeEvidence420",
        "bytes32 public immutable stakePolicyId",
        "verifierIdForDispute(disputeId)",
        "subjectRef: verifierId",
        "subjectAccount: r.verifier",
        "stakePolicyId: stakePolicyId",
        "OBJECTIVE_VERIFIER_ERROR_GROUND",
        "finalObjective: true"
    ], errors)

    require_text(INTEGRATION, [
        "contract ComputeVerifierDisputeStakeIntegration420",
        "stakeDispositionPending(disputeId)",
        "slashAuthorizer.authorize(positionId, 2, slashPolicyRevision, disputeId)",
        "disputes.acknowledgeStakeDisposition(disputeId, authorizationRef)"
    ], errors)

    require_text(HOLD_IFACE, [
        "interface IComputeVerifierDisputeStakeHold420",
        "function verifierStakeHold(address verifier)"
    ], errors)

    require_text(TEST_EVIDENCE, [
        "testFinalObjectiveDisputeBindsCanonicalVerifierAndStakePolicy",
        "testMissingCanonicalVerifierIdFailsClosed",
        "testGenericOrNonfinalDisputeFailsClosed",
        "testIndependentAppealFinalityRemainsRequired"
    ], errors)

    require_text(TEST_INTEGRATION, [
        "testFinalDisputeAuthorizesSlashBeforeReleasingStakeDisposition",
        "testAuthorizerFailureLeavesStakeDispositionPending",
        "testNoPendingDispositionCannotAuthorize"
    ], errors)

    require_text(TEST_COLLATERAL, [
        "testActiveDisputeStakeHoldBlocksMatureVerifierWithdrawal"
    ], errors)

    require_text(DOC, [
        "A dispute by itself does not authorize punishment.",
        "canonical verifier ID",
        "no withdrawal gap",
        "CMP-1.5.9 — WorkerRegistry stake-source integration"
    ], errors)

    require_text(ROADMAP, [
        "### CMP-1.5.8 — Dispute/stake integration"
    ], errors)

    milestone = cfg.get("milestone", {})
    if milestone.get("level_2_required_now") is not True:
        errors.append("Level 2 milestone missing")

    deferred = set(cfg.get("deferred", []))
    for prefix in ("CMP-1.5.9", "CMP-1.5.10", "CMP-1.5.11", "CMP-1.5.12", "CMP-1.5.13"):
        if not any(x.startswith(prefix) for x in deferred):
            errors.append(f"missing deferred owner {prefix}")

    print(json.dumps({
        "schema": "420Integrated.ComputeMarket.CMP-1.5.8.Qualification.v1",
        "step": "CMP-1.5.8",
        "pass": not errors,
        "errors": errors,
        "level_2_milestone": True,
        "next_canonical_step": cfg.get("next_canonical_step")
    }, indent=2))
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
