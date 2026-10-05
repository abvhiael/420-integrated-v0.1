#!/usr/bin/env python3
"""CMP-4.2 Research Project Registry scope, authority and qualification gate."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def main():
    errors=[]
    cfg=json.loads((ROOT/"contracts/config/compute-market/cmp-4.2-research-project-registry.json").read_text())
    if cfg.get("step")!="CMP-4.2": errors.append("step drift")
    if cfg.get("canonical_definition")!="Research Project Registry": errors.append("definition drift")
    if cfg.get("status")!="IMPLEMENTED_QUALIFICATION_PENDING": errors.append("status drift")
    if cfg.get("qualification")!={"level":1,"level_2_required_now":False,"level_3_deferred_to":"CMP-4.10 — Phase closeout"}:
        errors.append("qualification boundary drift")
    if cfg.get("next_canonical_step")!="CMP-4.3 — Researcher / institution identity":
        errors.append("next step drift")
    if len(cfg.get("exit_criteria",[]))!=11: errors.append("exit criteria drift")
    if len(cfg.get("negative_cases",[]))<12: errors.append("negative campaign incomplete")
    if cfg["authority"].get("owner_transfer") is not False: errors.append("unexpected owner transfer")
    if cfg["authority"].get("researcher_identity_claimed") is not False: errors.append("premature identity claim")

    required={
      "contracts/src/compute/ComputeResearchProjectRegistry420.sol":[
        'PROJECT_DOMAIN = keccak256("420/COMPUTE/RESEARCH_PROJECT/V1")',
        'COMMITMENT_DOMAIN = keccak256("420/COMPUTE/RESEARCH_PROJECT_COMMITMENT/V1")',
        "function registerProject(","function reviseProject(","function setNewWorkAcceptance(",
        "function retireProject(","function commitment(","function isCurrentAcceptable(",
        "msg.sender != p.owner","p.revision != expectedRevision","p.status != Status.ACTIVE",
        "_history[projectId][p.revision] = p","p.status = Status.RETIRED"
      ],
      "contracts/test/ComputeResearchProjectRegistry420.t.sol":[
        "testCanonicalIdentityAndCommitmentAreReconstructable",
        "testInvalidCreationRejectsWithoutConsumingIdentity",
        "testOwnerOnlyRevisionAndImmutableHistory",
        "testAcceptancePauseResumeIsRevisionedAndFailClosed",
        "testRetirementIsTerminalButHistoryRemainsReadable",
        "testCrossProjectAndRevisionReplayFailAdmission"
      ],
      "docs/compute-market/CMP-4.2-RESEARCH-PROJECT-REGISTRY.md":[
        "# CMP-4.2 — Research Project Registry","owner-only","isCurrentAcceptable",
        "CMP-4.3 — Researcher / institution identity"
      ],
      "docs/compute-market/CMP-4.1-SCIENTIFIC-WORK-UNIT-SPECIFICATION.md":[
        "ComputeResearchProjectRegistry420","isCurrentAcceptable"
      ],
      "contracts/config/compute-market/cmp-4.1-scientific-work-unit.json":[
        "ComputeResearchProjectRegistry420 exact project revision commitment"
      ],
      "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md":[
        "## CMP-4.2 — Research Project Registry","CMP-4.3 — Researcher / institution identity"
      ],
      ".github/workflows/compute-market.yml":[
        "python scripts/verify-cmp-4-1-scientific-work-unit.py",
        "python scripts/verify-cmp-4-2-research-project-registry.py"
      ]
    }
    for path,needles in required.items():
        content=(ROOT/path).read_text()
        for needle in needles:
            if needle not in content: errors.append(f"{path}: missing {needle}")

    source=(ROOT/"contracts/src/compute/ComputeResearchProjectRegistry420.sol").read_text()
    forbidden=["onlyGovernance","settle(","transferFrom(","slash(","recordVerification(","assignWorker("]
    for needle in forbidden:
        if needle in source: errors.append(f"registry gained forbidden authority surface: {needle}")

    print(json.dumps({"step":"CMP-4.2","qualification_level":1,"pass":not errors,"errors":errors},indent=2))
    if errors: raise SystemExit(1)

if __name__=="__main__":
    main()
