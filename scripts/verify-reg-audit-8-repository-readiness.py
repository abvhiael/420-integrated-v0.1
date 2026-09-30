#!/usr/bin/env python3
import json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
errors=[]
def read(p): return (ROOT/p).read_text(encoding="utf-8")
def load(p): return json.loads(read(p))
road=read("docs/audit/420REGISTRY-COMPLETE-AUDIT-20260928.md")
for token in [
"### REG-AUDIT-8 — production-equivalent testnet deployment",
"chain ID/environment","exact source/release SHA","final Registry address","deployment/predeploy proof",
"runtime code hash","initialized governance authority","smoke reads and strict publication",
"deprecation/history behavior","recovery/restart observations for derived consumers",
"Exit: testnet evidence is immutable and reproducible."
]:
    if token not in road: errors.append("canonical REG-AUDIT-8 roadmap drift: "+token)
audit=load("docs/audit/REG-AUDIT-8-TESTNET-DEPLOYMENT-QUALIFICATION.json")
if audit.get("status")!="NOT_YET_COMPLETE": errors.append("REG-AUDIT-8 must remain NOT_YET_COMPLETE without live evidence")
endpoints=load("testnet/services/endpoints.json"); infra=load("testnet/infrastructure/inventory.json")
if infra.get("status")!="PLANNED" or not all(x.get("status")=="UNPROVISIONED" for x in infra.get("nodes",[])):
    errors.append("testnet infrastructure changed; perform live qualification instead of blocker readiness")
raw=json.dumps(endpoints).upper()
if "PLACEHOLDER" not in raw and "REPLACE_WITH" not in raw: errors.append("testnet endpoints are no longer placeholders; live qualification is now required")
if (ROOT/"developer-hub/manifests/testnet.json").exists(): errors.append("official testnet manifest now exists; live qualification must replace blocker-only state")
for p in [
"docs/audit/templates/REG-AUDIT-8-live-evidence.template.json",
"docs/operators/REG-AUDIT-8-TESTNET-RUNBOOK.md",
"scripts/verify-reg-audit-8-live.py",
".github/workflows/registry-reg-audit-8-live.yml"
]:
    if not (ROOT/p).exists(): errors.append("missing REG-AUDIT-8 live qualification asset: "+p)
live=read("scripts/verify-reg-audit-8-live.py")
for token in ["eth_chainId","eth_getCode","eth_getProof","eth_getTransactionReceipt","LIVE_EVIDENCE_COMPLETE","strict publication","deprecation","restart_resume","bounded_reorg","finalized_conflict","evidenceSha256 mismatch"]:
    if token not in live: errors.append("live verifier missing "+token)
wf=read(".github/workflows/registry-reg-audit-8-live.yml")
for token in ["release_candidate_sha","Verify exact release candidate checkout","verify-reg-audit-8-live.py"]:
    if token not in wf: errors.append("live workflow missing "+token)
blockers=load("docs/audit/420REGISTRY-COMPLETE-AUDIT-20260928.json").get("blockers",[])
b=next((x for x in blockers if x.get("id")=="REG-BLK-003"),None)
if not b or b.get("status")!="OPEN": errors.append("REG-BLK-003 must remain OPEN until live REG-AUDIT-8 evidence passes")
if errors:
    print("\n".join("ERROR: "+e for e in errors)); sys.exit(1)
print("REG-AUDIT-8 repository readiness PASS; production-equivalent live qualification remains externally blocked")
