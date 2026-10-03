#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG = ROOT / "contracts/config/compute-market/cmp-1.5.3-policy-minimum-collateral.json"
SRC = ROOT / "contracts/src/compute/ComputeStakeCollateralPolicy420.sol"
TEST = ROOT / "contracts/test/ComputeStakeCollateralPolicy420.t.sol"
DOC = ROOT / "docs/compute-market/CMP-1.5.3-POLICY-SPECIFIC-MINIMUM-COLLATERAL.md"
ROADMAP = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"

def require_text(path, needles, errors):
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            errors.append(f"{path}: missing {needle}")

def main():
    errors = []
    cfg = json.loads(CFG.read_text(encoding="utf-8"))

    if cfg.get("step") != "CMP-1.5.3":
        errors.append("step drift")
    if cfg.get("canonical_definition") != "Policy-specific minimum collateral":
        errors.append("canonical definition drift")
    if cfg.get("qualification", {}).get("level") != 2:
        errors.append("milestone qualification drift")
    if cfg.get("next_canonical_step") != "CMP-1.5.4 — Exit queue / withdrawal delay":
        errors.append("next-step drift")

    require_text(ROADMAP, ["### CMP-1.5.3 — Policy-specific minimum collateral"], errors)

    require_text(SRC, [
        "contract ComputeStakeCollateralPolicy420",
        "mapping(bytes32 => uint32) public latestRevision",
        "mapping(bytes32 => bool) public acceptingNew",
        "function publish(",
        "minimumWorkerActiveAmount",
        "minimumWorkerSlashableAmount",
        "minimumVerifierActiveAmount",
        "minimumVerifierSlashableAmount",
        "function commitment(",
        "function isCurrentAcceptable(",
        "function workerPositionPasses(",
        "function verifierPositionPasses(",
        "if (!p.workerRequired) return true;",
        "if (!p.verifierRequired) return true;",
        "minimumSlashableAmount > minimumActiveAmount"
    ], errors)

    require_text(TEST, [
        "testOnlyGovernanceCanPublishAndToggleAcceptance",
        "testInvalidMinimumShapesFailClosed",
        "testPolicyRevisionsAreImmutableAndCommitmentBound",
        "testWorkerMinimumsEnforceExactBoundaryAndExitPolicy",
        "testVerifierMinimumsEnforceExactBoundaryAndExitPolicy",
        "testOptionalRoleDoesNotInventCollateralRequirement",
        "testWorkerAndVerifierMinimumsAreIndependent"
    ], errors)

    require_text(DOC, [
        "ComputeStakeCollateralPolicy420",
        "canonical minimum-collateral policy authority",
        "CMP-1.5.9 — WorkerRegistry stake-source integration",
        "first sensible **Level 2 CMP-1.5 integration milestone**",
        "CMP-1.5.4 — Exit queue / withdrawal delay"
    ], errors)

    milestone = cfg.get("milestone", {})
    if milestone.get("level_2_required_now") is not True:
        errors.append("Level 2 milestone not recorded")
    if "retained Compute*.t.sol suite" not in milestone.get("retained_app_suite", ""):
        errors.append("retained app suite missing")

    authority = cfg.get("authority", {})
    if authority.get("canonical_minimum_collateral_policy") != "ComputeStakeCollateralPolicy420":
        errors.append("canonical policy authority drift")

    deferred = set(cfg.get("deferred", []))
    for prefix in (
        "CMP-1.5.4","CMP-1.5.5","CMP-1.5.6","CMP-1.5.7","CMP-1.5.8",
        "CMP-1.5.9","CMP-1.5.10","CMP-1.5.11","CMP-1.5.12","CMP-1.5.13"
    ):
        if not any(x.startswith(prefix) for x in deferred):
            errors.append(f"missing deferred owner {prefix}")

    print(json.dumps({
        "schema":"420Integrated.ComputeMarket.CMP-1.5.3.Qualification.v1",
        "step":"CMP-1.5.3",
        "pass":not errors,
        "errors":errors,
        "level_2_milestone":True,
        "next_canonical_step":cfg.get("next_canonical_step")
    }, indent=2))
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
