#!/usr/bin/env python3
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
    errors=[]
    cfg=json.loads((ROOT/"contracts/config/compute-market/cmp-4.6-result-provenance.json").read_text())
    if cfg.get("step")!="CMP-4.6": errors.append("step drift")
    if cfg.get("canonical_definition")!="Result provenance": errors.append("definition drift")
    if cfg.get("status")!="COMPLETE": errors.append("status drift")\n    if cfg.get("completion_state")!="COMPLETE": errors.append("completion state drift")
    q=cfg.get("qualification",{})
    if q.get("level")!=1 or q.get("level_2_required_now") is not True: errors.append("qualification milestone drift")
    if cfg.get("next_canonical_step")!="CMP-4.7 — Scientific metadata and lineage": errors.append("next step drift")
    if len(cfg.get("exit_criteria",[]))!=12: errors.append("exit criteria drift")
    required={
      "contracts/src/compute/ComputeScientificResultProvenance420.sol":[
        "contract ComputeScientificResultSource420","contract ComputeScientificResultProvenance420",
        "function verdictContext","SCIENTIFIC_UNIT_DOMAIN_V1","PROVENANCE_DOMAIN",
        "function recordProvenance(","verificationRecorded","executionEvidenceCommitment",
        "function isCanonical("
      ],
      "contracts/test/ComputeScientificResultProvenance420.t.sol":[
        "testCanonicalProvenanceIsReconstructableAndCanonical",
        "testRejectsUnverifiedAndZeroScientificBindings",
        "testCrossUnitScientificCommitmentReplayFailsClosed",
        "testDuplicateIsIdempotentAndConflictingCanonicalResultFails",
        "testAttemptReceiptEvidenceAndVerificationAreBoundIntoIdentity",
        "testProvenanceCreatesNoCorrectnessOrEconomicAuthority"
      ],
      "docs/compute-market/CMP-4.6-RESULT-PROVENANCE.md":[
        "# CMP-4.6 — Result provenance","first CMP-4 Level 2 integration milestone",
        "CMP-4.7 — Scientific metadata and lineage"
      ],
      "docs/compute-market/CMP-4.1-SCIENTIFIC-WORK-UNIT-SPECIFICATION.md":[
        "ComputeScientificResultProvenance420"
      ],
      ".github/workflows/compute-market.yml":[
        "verify-cmp-4-5-execution-environments.py","verify-cmp-4-6-result-provenance.py"
      ]
    }
    for path,needles in required.items():
        content=(ROOT/path).read_text()
        for n in needles:
            if n not in content: errors.append(f"{path}: missing {n}")
    source=(ROOT/"contracts/src/compute/ComputeScientificResultProvenance420.sol").read_text()
    for n in ["onlyGovernance","transferFrom(","settle(","slash(","assignWorker(","recordVerification(","release("]:
        if n in source: errors.append(f"forbidden authority: {n}")
    print(json.dumps({"step":"CMP-4.6","level_1":True,"level_2_milestone":True,"pass":not errors,"errors":errors},indent=2))
    if errors: raise SystemExit(1)
if __name__=="__main__": main()
