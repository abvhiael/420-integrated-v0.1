#!/usr/bin/env python3
"""Negative/boundary model tests for the CMP-4.1 specification contract."""
from copy import deepcopy
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CFG=json.loads((ROOT/"contracts/config/compute-market/cmp-4.1-scientific-work-unit.json").read_text())
ZERO="0x"+"00"*32
NZ="0x"+"11"*32

REQUIRED=[
 "unitId","researchProjectCommitment","manifestHash","executableContainerCommitment","datasetInputCommitment",
 "parametersCommitment","resourceClass","outputSchemaCommitment","verificationStrategyCommitment","fundingRef"
]

def validate(r,authority):
    if r.get("schemaVersion")!=1 or not isinstance(r.get("chainId"),int) or r["chainId"]<=0:
        return False
    for k in REQUIRED:
        if r.get(k) in (None,"",ZERO): return False
    if not isinstance(r.get("deadline"),int) or r["deadline"]<=0: return False
    if r["unitId"]!=authority["unitId"]: return False
    if r["manifestHash"]!=authority["manifestHash"]: return False
    if r["datasetInputCommitment"]!=authority["datasetInputCommitment"]: return False
    if r["resourceClass"]!=authority["resourceClass"]: return False
    if r["outputSchemaCommitment"]!=authority["outputSchemaCommitment"]: return False
    if r["verificationStrategyCommitment"]!=authority["verificationStrategyCommitment"]: return False
    if r["fundingRef"]!=authority["fundingRef"]: return False
    if r["deadline"]!=authority["effectiveDeadline"] or r["deadline"]>authority["jobDeadline"]: return False
    if r["chainId"]!=authority["chainId"]: return False
    return True

def main():
    authority={
      "chainId":420,"unitId":"0x"+"01"*32,"manifestHash":"0x"+"02"*32,
      "datasetInputCommitment":"0x"+"03"*32,"resourceClass":"0x"+"04"*32,
      "outputSchemaCommitment":"0x"+"05"*32,"verificationStrategyCommitment":"0x"+"06"*32,
      "fundingRef":"0x"+"07"*32,"effectiveDeadline":1700000000,"jobDeadline":1700000100,
    }
    good={
      "schemaVersion":1,"chainId":420,"unitId":authority["unitId"],
      "researchProjectCommitment":"0x"+"08"*32,"manifestHash":authority["manifestHash"],
      "executableContainerCommitment":"0x"+"09"*32,"datasetInputCommitment":authority["datasetInputCommitment"],
      "parametersCommitment":"0x"+"0a"*32,"resourceClass":authority["resourceClass"],
      "outputSchemaCommitment":authority["outputSchemaCommitment"],
      "verificationStrategyCommitment":authority["verificationStrategyCommitment"],
      "deadline":authority["effectiveDeadline"],"fundingRef":authority["fundingRef"],
    }
    assert validate(good,authority)
    mutations=[]
    for k in REQUIRED:
        m=deepcopy(good); m[k]=ZERO; mutations.append((f"zero {k}",m))
    for k,v in [
      ("schemaVersion",2),("chainId",421),("unitId","0x"+"aa"*32),("manifestHash","0x"+"ab"*32),
      ("datasetInputCommitment","0x"+"ac"*32),("resourceClass","0x"+"ad"*32),
      ("outputSchemaCommitment","0x"+"ae"*32),("verificationStrategyCommitment","0x"+"af"*32),
      ("fundingRef","0x"+"ba"*32),("deadline",1700000200)
    ]:
        m=deepcopy(good); m[k]=v; mutations.append((f"mutated {k}",m))
    for name,m in mutations:
        assert not validate(m,authority), name
    assert CFG["commitment"]["ordered_fields"][3]==["unitId","bytes32"]
    assert CFG["commitment"]["ordered_fields"][-1]==["fundingRef","bytes32"]
    print(json.dumps({"step":"CMP-4.1","pass":True,"positive_cases":1,"negative_cases":len(mutations)},indent=2))

if __name__=="__main__":
    main()
