#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
AI=ROOT/"contracts"/"src"/"ai"
MAP=ROOT/"contracts"/"config"/"genesis-dapp-contract-map.json"
REPORT=ROOT/"docs"/"audit"/"420AI-COMPLETE-AUDIT-20261002.md"
ROADMAP=ROOT/"docs"/"audit"/"420AI-AUDIT-REMEDIATION-ROADMAP.md"
present={"AIProviderRegistry.sol","AIModelRegistry.sol","AIJobManager.sol","AIJobEscrow.sol","AIReputationRegistry.sol","AIIds420.sol","AIAuthorization420.sol","AIPolicyRegistry420.sol","AIModelDeploymentRegistry420.sol","AIRequestRegistry420.sol","AIResultRegistry420.sol","AIComputeAdapter420.sol","AIRouter420.sol","IAI420.sol"}
stale="AIModelVersionRegistry420.sol"
errors=[]
for n in sorted(present):
    if not (AI/n).is_file(): errors.append(f"expected AI source missing: {n}")
if (AI/stale).exists(): errors.append("standalone AIModelVersionRegistry420.sol duplicates model-version authority")
doc=json.loads(MAP.read_text())
entries=[x for x in doc.get("apps",[]) if x.get("dapp")=="420 AI"]
if len(entries)!=1: errors.append(f"expected one 420 AI dApp entry, found {len(entries)}")
else:
    listed=set(entries[0].get("contracts",[]))
    for n in sorted(present):
        if n not in listed: errors.append(f"420 AI dApp map missing: {n}")
    if stale in listed: errors.append("420 AI dApp map still lists stale model-version registry")
report=REPORT.read_text();roadmap=ROADMAP.read_text()
for t in ["TESTNET READY: NO","GENESIS READY: NO","PRODUCTION READY: NO","AI-INV-027","3969 behind"]:
    if t not in report: errors.append(f"audit report missing durable finding: {t}")
for i in range(1,13):
    if f"AI-AUDIT-{i}" not in roadmap: errors.append(f"roadmap missing AI-AUDIT-{i}")
if errors:
    print("420AI audit-state qualification FAILED")
    [print(f"- {e}") for e in errors]
    raise SystemExit(1)
print("420AI audit-state qualification PASSED")
print(f"verified current AI source set: {len(present)}")
print("verified mature V1 modules and single model-version authority")
