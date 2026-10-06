#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def main():
    errors=[]
    cfg=json.loads((ROOT/"contracts/config/compute-market/cmp-4.8-publication-retention.json").read_text())
    if cfg.get("step")!="CMP-4.8": errors.append("step drift")
    if cfg.get("canonical_definition")!="Publication / retention policy": errors.append("definition drift")
    if cfg.get("status")!="COMPLETE" or cfg.get("completion_state")!="COMPLETE":
        errors.append("completion state drift")
    q=cfg.get("qualification",{})
    if q.get("level")!=1 or q.get("level_2_required_now") is not False:
        errors.append("qualification drift")
    if cfg.get("next_canonical_step")!="CMP-4.9 — Research dashboard":
        errors.append("next step drift")
    if len(cfg.get("exit_criteria",[]))!=12:
        errors.append("exit criteria drift")

    required={
      "contracts/src/compute/ComputeScientificPublicationRetention420.sol":[
        "contract ComputeScientificPublicationRetention420",
        "POLICY_ID_DOMAIN",
        "POLICY_COMMITMENT_DOMAIN",
        "enum Visibility { NONE, PRIVATE, RESTRICTED, PUBLIC }",
        "function registerPolicy(",
        "function revisePolicy(",
        "function setActive(",
        "function isCurrentPolicy(",
        "function isPublicationAuthorized(",
        "lineageRegistry.isCanonical",
        "publicationManifestCommitment",
        "retentionPolicyCommitment"
      ],
      "contracts/test/ComputeScientificPublicationRetention420.t.sol":[
        "testPrivatePolicyIsCanonicalButNotPubliclyAuthorized",
        "testPublicAndRestrictedPolicyRequirePublicationManifest",
        "testOutsiderCannotCreatePolicyForCanonicalLineage",
        "testRevisionIsAppendOnlyStaleSafeAndNoOpRejected",
        "testEmbargoAndRetentionBoundsFailClosed",
        "testLineageDriftAndDeactivationFailClosed",
        "testPolicyCreatesNoStorageDeletionCorrectnessOrEconomicAuthority"
      ],
      "docs/compute-market/CMP-4.8-PUBLICATION-RETENTION-POLICY.md":[
        "# CMP-4.8 — Publication / retention policy",
        "public copies can be recalled",
        "CMP-4.9 — Research dashboard"
      ],
      "docs/compute-market/CMP-4.7-SCIENTIFIC-METADATA-LINEAGE.md":[
        "CMP-4.8 now owns publication and retention policy"
      ],
      ".github/workflows/compute-market.yml":[
        "verify-cmp-4-7-scientific-metadata-lineage.py",
        "verify-cmp-4-8-publication-retention.py"
      ]
    }

    for path,needles in required.items():
        content=(ROOT/path).read_text()
        for needle in needles:
            if needle not in content:
                errors.append(f"{path}: missing {needle}")

    source=(ROOT/"contracts/src/compute/ComputeScientificPublicationRetention420.sol").read_text()
    for needle in [
        "onlyGovernance","transferFrom(","settle(","slash(","assignWorker(",
        "recordVerification(","http://","https://","delete "
    ]:
        if needle in source:
            errors.append(f"forbidden authority/surface: {needle}")

    print(json.dumps({
        "step":"CMP-4.8",
        "qualification_level":1,
        "level_2_required_now":False,
        "pass":not errors,
        "errors":errors
    },indent=2))
    if errors:
        raise SystemExit(1)

if __name__=="__main__":
    main()
