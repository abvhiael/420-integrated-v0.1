#!/usr/bin/env python3
"""CMP-4.4 dataset manifests scope and Level 1 qualification gate."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def main():
    errors=[]
    cfg=json.loads((ROOT/"contracts/config/compute-market/cmp-4.4-dataset-manifests.json").read_text())
    if cfg.get("step")!="CMP-4.4": errors.append("step drift")
    if cfg.get("canonical_definition")!="Dataset manifests": errors.append("definition drift")
    if cfg.get("status")!="IMPLEMENTED_QUALIFICATION_PENDING": errors.append("status drift")
    if cfg.get("qualification")!={"level":1,"level_2_required_now":False,"level_3_deferred_to":"CMP-4.10 — Phase closeout"}:
        errors.append("qualification boundary drift")
    if cfg.get("next_canonical_step")!="CMP-4.5 — Reproducible execution environments":
        errors.append("next step drift")
    if len(cfg.get("exit_criteria",[]))!=12: errors.append("exit criteria drift")
    if cfg["project_binding"].get("source")!="ComputeResearchProjectRegistry420":
        errors.append("project source drift")
    if cfg["cmp_4_1_integration"].get("rule")!="datasetInputCommitment remains the canonical accepted job/request input commitment":
        errors.append("CMP-4.1 input binding drift")

    required={
      "contracts/src/compute/ComputeDatasetManifestRegistry420.sol":[
        'DATASET_DOMAIN =','420/COMPUTE/DATASET_MANIFEST/V1',
        'COMMITMENT_DOMAIN =','function registerDataset(','function reviseDataset(',
        'function setActive(','function isCurrentUsable(',
        'expectedInputCommitment != d.contentCommitment',
        'projectRegistry.isCurrentAcceptable','_history[datasetId][d.revision] = d'
      ],
      "contracts/test/ComputeDatasetManifestRegistry420.t.sol":[
        "testCanonicalIdentityCommitmentAndInputBindingAreReconstructable",
        "testInvalidRegistrationRejectsWithoutConsumingIdentity",
        "testOwnerOnlyRevisionIsAppendOnlyAndStaleSafe",
        "testProjectRevisionDriftFailsClosedUntilExplicitManifestRefresh",
        "testProjectPauseAndDatasetActivationFailClosedForNewWork",
        "testCrossDatasetAndCommitmentReplayFailsClosed",
        "testManifestDoesNotGrantAccessOrProtocolAuthority"
      ],
      "docs/compute-market/CMP-4.4-DATASET-MANIFESTS.md":[
        "# CMP-4.4 — Dataset manifests",
        "datasetInputCommitment == accepted canonical job/request input commitment",
        "does **not** grant anyone permission to retrieve or decrypt the bytes",
        "CMP-4.5 — Reproducible execution environments"
      ],
      "docs/compute-market/CMP-4.1-SCIENTIFIC-WORK-UNIT-SPECIFICATION.md":[
        "ComputeDatasetManifestRegistry420",
        "isCurrentUsable"
      ],
      "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md":[
        "## CMP-4.4 — Dataset manifests",
        "CMP-4.5 — Reproducible execution environments"
      ],
      ".github/workflows/compute-market.yml":[
        "python scripts/verify-cmp-4-3-research-identity.py",
        "python scripts/verify-cmp-4-4-dataset-manifests.py"
      ]
    }
    for path,needles in required.items():
        content=(ROOT/path).read_text()
        for needle in needles:
            if needle not in content: errors.append(f"{path}: missing {needle}")

    source=(ROOT/"contracts/src/compute/ComputeDatasetManifestRegistry420.sol").read_text()
    forbidden=[
      "onlyGovernance","transferFrom(","settle(","slash(","assignWorker(",
      "recordVerification(","issueCredential(","setIssuerTrust(","http://","https://"
    ]
    for needle in forbidden:
        if needle in source:
            errors.append(f"dataset manifest gained forbidden authority/data surface: {needle}")

    print(json.dumps({"step":"CMP-4.4","qualification_level":1,"pass":not errors,"errors":errors},indent=2))
    if errors: raise SystemExit(1)

if __name__=="__main__":
    main()
