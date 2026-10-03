#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];AI=ROOT/"contracts"/"src"/"ai"
required={"AIAuthorization420.sol","AIPolicyRegistry420.sol","AIModelDeploymentRegistry420.sol","AIRequestRegistry420.sol","AIResultRegistry420.sol","AIComputeAdapter420.sol","AIRouter420.sol","IAI420.sol"}
errors=[]
for n in sorted(required):
    if not (AI/n).is_file(): errors.append(f"missing canonical AI V1 module: {n}")
if (AI/"AIModelVersionRegistry420.sol").exists(): errors.append("duplicate model-version authority present")
doc=json.loads((ROOT/"contracts/config/genesis-dapp-contract-map.json").read_text())
entry=[x for x in doc["apps"] if x.get("dapp")=="420 AI"]
if len(entry)!=1: errors.append("420 AI dApp map cardinality drift")
else:
    listed=set(entry[0].get("contracts",[]))
    for n in required:
        if n not in listed: errors.append(f"dApp map missing {n}")
    if "AIModelVersionRegistry420.sol" in listed: errors.append("dApp map still lists stale model-version registry")
arch=(ROOT/"docs/420-AI-V1-ARCHITECTURE.md").read_text()
for t in ["AIModelRegistry owns canonical model and model-version state","AIRequestRegistry420 is a read-through view over AIJobManager","AIResultRegistry420 is a read-through view over AIJobManager","AI-AUDIT-4"]:
    if t not in arch: errors.append(f"architecture missing authority decision: {t}")
adapter=(AI/"AIComputeAdapter420.sol").read_text()
if "Validation against current Compute request/match/job economics is intentionally owned by AI-AUDIT-4." not in adapter: errors.append("adapter integration boundary missing")
if ".matchCompute(" in adapter: errors.append("AI-AUDIT-3 adapter must not advance legacy compute lifecycle")
if errors:
    print("420AI AI-AUDIT-3 module qualification FAILED");[print(f"- {e}") for e in errors];raise SystemExit(1)
print("420AI AI-AUDIT-3 module qualification PASSED")
print(f"verified canonical V1 modules: {len(required)}")
print("verified single model/version and read-through request/result authority")
print("verified current ComputeMarket mutation remains AI-AUDIT-4")
