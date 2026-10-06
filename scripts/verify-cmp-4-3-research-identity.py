#!/usr/bin/env python3
"""CMP-4.3 researcher/institution identity scope and Level 1 qualification gate."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def main():
    errors=[]
    cfg=json.loads((ROOT/"contracts/config/compute-market/cmp-4.3-research-identity.json").read_text())
    if cfg.get("step")!="CMP-4.3": errors.append("step drift")
    if cfg.get("canonical_definition")!="Researcher / institution identity": errors.append("definition drift")
    if cfg.get("status")!="IMPLEMENTED_QUALIFICATION_PENDING": errors.append("status drift")
    if cfg.get("qualification")!={"level":1,"level_2_required_now":False,"level_3_deferred_to":"CMP-4.10 — Phase closeout"}:
        errors.append("qualification boundary drift")
    if cfg.get("next_canonical_step")!="CMP-4.4 — Dataset manifests": errors.append("next step drift")
    if len(cfg.get("exit_criteria",[]))!=12: errors.append("exit criteria drift")
    if cfg["canonical_identity_source"].get("contract")!="Identity420": errors.append("Identity420 source drift")
    if cfg["canonical_identity_source"].get("compute_layer_mutates_identity420") is not False:
        errors.append("compute layer must remain read-only to Identity420")
    if cfg["identity"].get("controller_bound_into_commitment") is not False:
        errors.append("controller recovery invariant drift")

    required={
      "contracts/src/compute/ComputeResearchIdentity420.sol":[
        'BINDING_DOMAIN =','420/COMPUTE/RESEARCH_IDENTITY_BINDING/V1',
        'RESEARCHER_CREDENTIAL_TYPE','INSTITUTION_CREDENTIAL_TYPE',
        'function register(','function revise(','function setActive(',
        'function isCurrentEligible(','identity420.credentialValid',
        'c.subjectId != profileId','IdentityAssurance.ATTESTED','IdentityAssurance.CREDENTIALED',
        'controller != actor','b.revision != expectedRevision','_history[id][b.revision] = b'
      ],
      "contracts/test/ComputeResearchIdentity420.t.sol":[
        "testResearcherBindingIsCanonicalAndEligible",
        "testInstitutionRequiresCredentialedInstitutionCredential",
        "testIdentityControllerRecoveryChangesAuthorityWithoutRewritingBinding",
        "testCredentialLifecycleFailsClosed",
        "testUnauthorizedStaleAndCrossBindingReplayFailClosed",
        "testWrongCredentialTypeAndSubjectFailClosed"
      ],
      "docs/compute-market/CMP-4.3-RESEARCHER-INSTITUTION-IDENTITY.md":[
        "# CMP-4.3 — Researcher / institution identity",
        "Identity420 remains the canonical profile, issuer, credential and controller authority",
        "controller transfer",
        "CMP-4.4 — Dataset manifests"
      ],
      "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md":[
        "## CMP-4.3 — Researcher / institution identity",
        "CMP-4.4 — Dataset manifests"
      ],
      ".github/workflows/compute-market.yml":[
        "python scripts/verify-cmp-4-2-research-project-registry.py",
        "python scripts/verify-cmp-4-3-research-identity.py"
      ]
    }
    for path,needles in required.items():
        content=(ROOT/path).read_text()
        for needle in needles:
            if needle not in content: errors.append(f"{path}: missing {needle}")

    source=(ROOT/"contracts/src/compute/ComputeResearchIdentity420.sol").read_text()
    forbidden=["onlyGovernance","transferFrom(","settle(","slash(","assignWorker(","recordVerification(","issueCredential(","setIssuerTrust("]
    for needle in forbidden:
        if needle in source: errors.append(f"compute identity gained forbidden authority surface: {needle}")

    print(json.dumps({"step":"CMP-4.3","qualification_level":1,"pass":not errors,"errors":errors},indent=2))
    if errors: raise SystemExit(1)

if __name__=="__main__":
    main()
