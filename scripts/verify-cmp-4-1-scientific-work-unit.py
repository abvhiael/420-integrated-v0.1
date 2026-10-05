#!/usr/bin/env python3
"""CMP-4.1 scientific work-unit specification and qualification wiring gate."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

EXPECTED_BINDINGS = [
    "research project","executable/container commitment","dataset/input commitment","parameters",
    "resource class","output schema","verification strategy","deadline","reward/funding reference",
]
EXPECTED_FIELDS = [
    ["domain","bytes32"],["schemaVersion","uint32"],["chainId","uint256"],["unitId","bytes32"],
    ["researchProjectCommitment","bytes32"],["manifestHash","bytes32"],["executableContainerCommitment","bytes32"],
    ["datasetInputCommitment","bytes32"],["parametersCommitment","bytes32"],["resourceClass","bytes32"],
    ["outputSchemaCommitment","bytes32"],["verificationStrategyCommitment","bytes32"],["deadline","uint64"],["fundingRef","bytes32"],
]

def main():
    errors=[]
    cfg=json.loads((ROOT/"contracts/config/compute-market/cmp-4.1-scientific-work-unit.json").read_text())
    if cfg.get("step")!="CMP-4.1": errors.append("step drift")
    if cfg.get("status")!="IMPLEMENTED_QUALIFICATION_PENDING": errors.append("status drift")
    if cfg.get("qualification")!={"level":1,"level_2_required_now":False,"level_3_deferred_to":"CMP-4.10 — Phase closeout"}:
        errors.append("qualification boundary drift")
    if cfg["canonical_definition"]["required_bindings"]!=EXPECTED_BINDINGS:
        errors.append("canonical nine bindings drift")
    c=cfg["commitment"]
    if c.get("domain")!="420Integrated.ComputeMarket.ScientificWorkUnit.v1" or c.get("schema_version")!=1:
        errors.append("domain/version drift")
    if c.get("encoding")!="abi.encode" or c.get("hash")!="keccak256":
        errors.append("encoding/hash drift")
    if c.get("ordered_fields")!=EXPECTED_FIELDS:
        errors.append("ordered commitment fields drift")
    sources=cfg["canonical_sources"]
    for key in ["unitId","researchProjectCommitment","manifestHash","executableContainerCommitment",
                "datasetInputCommitment","parametersCommitment","resourceClass","outputSchemaCommitment",
                "verificationStrategyCommitment","deadline","fundingRef"]:
        if not sources.get(key): errors.append(f"missing source mapping: {key}")
    if len(cfg.get("negative_cases",[]))<12: errors.append("negative campaign too small")
    if len(cfg.get("authority_boundaries",[]))<6: errors.append("authority boundaries incomplete")
    if len(cfg.get("exit_criteria",[]))!=8: errors.append("exit criteria drift")
    if cfg.get("next_canonical_step")!="CMP-4.2 — Research Project Registry": errors.append("next step drift")

    required={
      "docs/compute-market/CMP-4.1-SCIENTIFIC-WORK-UNIT-SPECIFICATION.md":[
        "# CMP-4.1 — Scientific Work Unit specification","researchProjectCommitment",
        "executableContainerCommitment","datasetInputCommitment","parametersCommitment","resourceClass",
        "outputSchemaCommitment","verificationStrategyCommitment","fundingRef",
        "SCIENTIFIC_UNIT_DOMAIN_V1","abi.encode","cross-chain replay","deadline widening",
        "CMP-1.4.8","CMP-4.2 — Research Project Registry"
      ],
      "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md":[
        "## CMP-4.1 — Scientific Work Unit specification",
        "research project;","executable/container commitment;","dataset/input commitment;","parameters;",
        "resource class;","output schema;","verification strategy;","deadline;","reward/funding reference;"
      ],
      "docs/compute-market/CMP-0.3-DETERMINISTIC-WORK-UNIT-IDENTITY.md":["unitId = keccak256","UNIT_DOMAIN_V1"],
      "docs/compute-market/CMP-0.4-SIGNED-EXECUTION-MANIFEST.md":["executableDigest","inputCommitment","outputSchemaHash"],
      "contracts/src/compute/ComputeJobRegistry420.sol":["bytes32 manifestHash","bytes32 inputCommitment","bytes32 outputSchemaCommitment","bytes32 fundingRef","bytes32 verificationPolicyCommitment","uint64 deadline"],
      "contracts/src/compute/ComputeMatch420.sol":["bytes32 computeClass","bytes32 verificationPolicyCommitment","uint64 executionDeadline"],
      "docs/compute-market/CMP-1.4.8-SCIENTIFIC-PROBABILISTIC-VERIFICATION.md":["sample-plan commitment","INCONCLUSIVE","PASS","FAIL"],
      ".github/workflows/compute-market.yml":["python scripts/verify-cmp-4-1-scientific-work-unit.py","python scripts/test-cmp-4-1-scientific-work-unit.py"],
    }
    for path,needles in required.items():
        content=(ROOT/path).read_text()
        for needle in needles:
            if needle not in content: errors.append(f"{path}: missing {needle}")
    print(json.dumps({"step":"CMP-4.1","qualification_level":1,"pass":not errors,"errors":errors},indent=2))
    if errors: raise SystemExit(1)

if __name__=="__main__":
    main()
