#!/usr/bin/env python3
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
    errors=[]
    cfg=json.loads((ROOT/"contracts/config/compute-market/cmp-4.5-execution-environments.json").read_text())
    if cfg.get("step")!="CMP-4.5": errors.append("step drift")
    if cfg.get("canonical_definition")!="Reproducible execution environments": errors.append("definition drift")
    if cfg.get("status")!="COMPLETE": errors.append("status drift")
    if cfg.get("completion_state")!="COMPLETE": errors.append("completion state drift")
    if cfg.get("next_canonical_step")!="CMP-4.6 — Result provenance": errors.append("next step drift")
    if len(cfg.get("exit_criteria",[]))!=12: errors.append("exit criteria drift")
    required={
      "contracts/src/compute/ComputeExecutionEnvironmentRegistry420.sol":["ENVIRONMENT_DOMAIN =","420/COMPUTE/EXECUTION_ENVIRONMENT/V1","function registerEnvironment(","function reviseEnvironment(","function setActive(","function isCurrentReproducible(","projectRegistry.isCurrentAcceptable","artifactCommitment","runtimeProfileCommitment","dependencyLockCommitment","commandSpecCommitment","platformCommitment","sandboxProfileCommitment","reproducibilityPolicyCommitment"],
      "contracts/test/ComputeExecutionEnvironmentRegistry420.t.sol":["testCanonicalIdentityAndCommitmentAreReconstructable","testInvalidRegistrationRejectsWithoutConsumingIdentity","testOwnerOnlyRevisionIsAppendOnlyAndStaleSafe","testProjectRevisionDriftFailsClosedUntilExplicitEnvironmentRefresh","testProjectPauseAndEnvironmentActivationFailClosedForNewWork","testCrossEnvironmentCommitmentReplayFailsClosed","testEnvironmentCommitmentDoesNotGrantExecutionOrCorrectnessAuthority"],
      "docs/compute-market/CMP-4.5-REPRODUCIBLE-EXECUTION-ENVIRONMENTS.md":["# CMP-4.5 — Reproducible execution environments","executableContainerCommitment == exact current environment revision commitment","does not prove that execution occurred or that results are correct","CMP-4.6 — Result provenance"],
      "docs/compute-market/CMP-4.1-SCIENTIFIC-WORK-UNIT-SPECIFICATION.md":["ComputeExecutionEnvironmentRegistry420","isCurrentReproducible"],
      ".github/workflows/compute-market.yml":["verify-cmp-4-4-dataset-manifests.py","verify-cmp-4-5-execution-environments.py"]
    }
    for path,needles in required.items():
        content=(ROOT/path).read_text()
        for needle in needles:
            if needle not in content: errors.append(f"{path}: missing {needle}")
    source=(ROOT/"contracts/src/compute/ComputeExecutionEnvironmentRegistry420.sol").read_text()
    for needle in ["onlyGovernance","transferFrom(","settle(","slash(","assignWorker(","recordVerification(","execute(","http://","https://"]:
        if needle in source: errors.append(f"forbidden authority/surface: {needle}")
    print(json.dumps({"step":"CMP-4.5","qualification_level":1,"pass":not errors,"errors":errors},indent=2))
    if errors: raise SystemExit(1)
if __name__=="__main__": main()
