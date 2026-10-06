#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def main():
    errors=[]
    cfg=json.loads((ROOT/"contracts/config/compute-market/cmp-4.7-scientific-metadata-lineage.json").read_text())
    if cfg.get("step")!="CMP-4.7": errors.append("step drift")
    if cfg.get("canonical_definition")!="Scientific metadata and lineage": errors.append("definition drift")
    if cfg.get("status")!="COMPLETE" or cfg.get("completion_state")!="COMPLETE":
        errors.append("completion state drift")
    q=cfg.get("qualification",{})
    if q.get("level")!=1 or q.get("level_2_required_now") is not False:
        errors.append("qualification drift")
    if cfg.get("next_canonical_step")!="CMP-4.8 — Publication / retention policy":
        errors.append("next step drift")
    if len(cfg.get("exit_criteria",[]))!=12: errors.append("exit criteria drift")

    required={
      "contracts/src/compute/ComputeScientificMetadataLineage420.sol":[
        "contract ComputeScientificMetadataLineage420",
        "SCIENTIFIC_UNIT_DOMAIN_V1",
        "PARENT_SET_DOMAIN",
        "LINEAGE_DOMAIN",
        "MAX_PARENTS = 32",
        "function recordMetadataLineage(",
        "projectRegistry.commitment",
        "project.owner != msg.sender",
        "provenanceRegistry.isCanonical",
        "lineageForProvenance[parent]",
        "function isCanonical("
      ],
      "contracts/test/ComputeScientificMetadataLineage420.t.sol":[
        "testProjectOwnerCanRecordCanonicalRootMetadata",
        "testDerivedLineageRequiresExistingCanonicalParentsAndBindsThem",
        "testUnauthorizedProjectPublisherFailsClosed",
        "testScientificWitnessSubstitutionFailsClosed",
        "testParentOrderingDuplicationMissingAndRelationRulesFailClosed",
        "testCanonicalSourceDriftInvalidatesLineage",
        "testLineageIdentityIsRegistryAndPublisherBoundWithoutExtraAuthority"
      ],
      "docs/compute-market/CMP-4.7-SCIENTIFIC-METADATA-LINEAGE.md":[
        "# CMP-4.7 — Scientific metadata and lineage",
        "parent-first",
        "CMP-4.8 — Publication / retention policy"
      ],
      "docs/compute-market/CMP-4.6-RESULT-PROVENANCE.md":[
        "CMP-4.7 now owns scientific metadata and lineage"
      ],
      ".github/workflows/compute-market.yml":[
        "verify-cmp-4-6-result-provenance.py",
        "verify-cmp-4-7-scientific-metadata-lineage.py"
      ]
    }
    for path,needles in required.items():
        content=(ROOT/path).read_text()
        for needle in needles:
            if needle not in content:
                errors.append(f"{path}: missing {needle}")

    source=(ROOT/"contracts/src/compute/ComputeScientificMetadataLineage420.sol").read_text()
    for needle in [
        "onlyGovernance","transferFrom(","settle(","slash(","assignWorker(",
        "recordVerification(","release(","http://","https://"
    ]:
        if needle in source:
            errors.append(f"forbidden authority/surface: {needle}")

    print(json.dumps({
        "step":"CMP-4.7",
        "qualification_level":1,
        "level_2_required_now":False,
        "pass":not errors,
        "errors":errors
    },indent=2))
    if errors:
        raise SystemExit(1)

if __name__=="__main__":
    main()
