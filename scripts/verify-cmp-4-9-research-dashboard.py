#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def main():
    errors=[]
    cfg=json.loads((ROOT/"contracts/config/compute-market/cmp-4.9-research-dashboard.json").read_text())
    if cfg.get("step")!="CMP-4.9": errors.append("step drift")
    if cfg.get("canonical_definition")!="Research dashboard": errors.append("definition drift")
    if cfg.get("status")!="COMPLETE" or cfg.get("completion_state")!="COMPLETE":
        errors.append("completion state drift")
    q=cfg.get("qualification",{})
    if q.get("level")!=1 or q.get("level_2_required_now") is not True:
        errors.append("qualification drift")
    if cfg.get("next_canonical_step")!="CMP-4.10 — Phase closeout":
        errors.append("next step drift")
    if len(cfg.get("exit_criteria",[]))!=12:
        errors.append("exit criteria drift")

    required={
      "contracts/src/compute/ComputeResearchDashboard420.sol":[
        "contract ComputeResearchDashboard420",
        "DASHBOARD_SCHEMA_V1",
        "SCIENTIFIC_UNIT_DOMAIN_V1",
        "function components()",
        "function currentProject(",
        "function projectRevision(",
        "function researchResult(",
        "function parentProvenanceIds(",
        "provenance.isCanonical",
        "lineage.isCanonical",
        "publication.policyForLineage",
        "publication.isCurrentPolicy",
        "publication.isPublicationAuthorized"
      ],
      "contracts/test/ComputeResearchDashboard420.t.sol":[
        "testProjectViewsExposeCanonicalCurrentAndHistoricalState",
        "testResearchResultComposesCanonicalScientificGraphWithoutPolicy",
        "testResearchResultExposesCurrentPublicationPolicy",
        "testProjectBindingSubstitutionFailsClosed",
        "testScientificWitnessSubstitutionFailsClosed",
        "testNonCanonicalProvenanceOrLineageFailsClosed",
        "testParentViewRequiresCanonicalLineage",
        "testDashboardIsReadOnlyAndAuthorityFree"
      ],
      "docs/compute-market/CMP-4.9-RESEARCH-DASHBOARD.md":[
        "# CMP-4.9 — Research dashboard",
        "read model",
        "CMP-4.10 — Phase closeout"
      ],
      "docs/compute-market/CMP-4.8-PUBLICATION-RETENTION-POLICY.md":[
        "CMP-4.9 now owns the research dashboard"
      ],
      ".github/workflows/compute-market.yml":[
        "verify-cmp-4-8-publication-retention.py",
        "verify-cmp-4-9-research-dashboard.py"
      ]
    }
    for path,needles in required.items():
        content=(ROOT/path).read_text()
        for needle in needles:
            if needle not in content:
                errors.append(f"{path}: missing {needle}")

    source=(ROOT/"contracts/src/compute/ComputeResearchDashboard420.sol").read_text()
    for needle in [
        "onlyGovernance","transferFrom(","settle(","slash(","assignWorker(",
        "recordVerification(","registerProject(","reviseProject(","setActive("
    ]:
        if needle in source:
            errors.append(f"forbidden authority/surface: {needle}")

    print(json.dumps({
      "step":"CMP-4.9",
      "qualification_level":1,
      "level_2_required_now":True,
      "pass":not errors,
      "errors":errors
    },indent=2))
    if errors:
        raise SystemExit(1)

if __name__=="__main__":
    main()
