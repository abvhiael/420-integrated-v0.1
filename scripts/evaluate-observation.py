#!/usr/bin/env python3
import json, pathlib, sys, datetime

root=pathlib.Path(__file__).resolve().parents[1]
slo=json.loads((root/"testnet/observation/slo.json").read_text())
files=[p for p in sorted((root/"testnet/observation/metrics").glob("*.json"))
       if p.name!="snapshot-template.json"]
checks=[]
def add(name,status,detail): checks.append({"name":name,"status":status,"detail":detail})

if not files:
    add("observation snapshots","BLOCKED","no real observation snapshots")
else:
    snaps=[]
    for p in files:
        try: snaps.append(json.loads(p.read_text()))
        except Exception as e: add(f"parse:{p.name}","FAIL",str(e))
    ts=[]
    for s in snaps:
        try: ts.append(datetime.datetime.fromisoformat(s["timestamp_utc"].replace("Z","+00:00")))
        except: pass
    runtime=(max(ts)-min(ts)).total_seconds()/3600 if len(ts)>=2 else 0
    add("minimum 72h runtime","PASS" if runtime>=72 else "BLOCKED",f"{runtime:.2f}h")

    add("3 healthy RPC endpoints",
        "PASS" if all(s.get("rpc_healthy",0)>=3 for s in snaps) else "FAIL",
        "minimum 3")
    add("RPC availability",
        "PASS" if all(s.get("rpc_availability_pct",0)>=slo["rpc"]["availability_pct_min"] for s in snaps) else "FAIL",
        f'>={slo["rpc"]["availability_pct_min"]}%')
    add("RPC p95 latency",
        "PASS" if all(s.get("rpc_p95_latency_ms",10**9)<=slo["rpc"]["p95_latency_ms_max"] for s in snaps) else "FAIL",
        f'<={slo["rpc"]["p95_latency_ms_max"]}ms')
    add("RPC error rate",
        "PASS" if all(s.get("rpc_error_rate_pct",100)<=slo["rpc"]["error_rate_pct_max"] for s in snaps) else "FAIL",
        f'<={slo["rpc"]["error_rate_pct_max"]}%')

    add("explorer availability",
        "PASS" if all(s.get("explorer_available") for s in snaps) else "FAIL","must remain available")
    add("explorer indexing lag",
        "PASS" if all(s.get("explorer_indexing_lag_blocks",10**9)<=slo["explorer"]["indexing_lag_blocks_max"] for s in snaps) else "FAIL",
        f'<={slo["explorer"]["indexing_lag_blocks_max"]} blocks')

    add("faucet availability",
        "PASS" if all(s.get("faucet_available") for s in snaps) else "FAIL","must remain available")
    add("faucet abuse incidents",
        "PASS" if all(s.get("faucet_abuse_incidents_unresolved",1)==0 for s in snaps) else "FAIL","must be zero")

    add("active seats",
        "PASS" if all(s.get("active_seats",0)>=15 for s in snaps) else "FAIL","minimum 15")
    add("eligible validators",
        "PASS" if all(s.get("eligible_validators",0)>=60 for s in snaps) else "FAIL","minimum 60")
    add("conflicting QC",
        "PASS" if not any(s.get("conflicting_qc_detected") for s in snaps) else "FAIL","must be zero")
    add("unexplained safety halt",
        "PASS" if not any(s.get("safety_halt") for s in snaps) else "FAIL","must be zero")
    add("finality stalls >42 slots",
        "PASS" if not any(s.get("finality_stall_over_42_slots") for s in snaps) else "FAIL","must be zero unexplained")

    onboarded=max([s.get("external_validators_onboarded",0) for s in snaps] or [0])
    add("external validators onboarded",
        "PASS" if onboarded>=slo["onboarding"]["external_validators_successfully_onboarded_min"] else "BLOCKED",
        f"{onboarded}/{slo['onboarding']['external_validators_successfully_onboarded_min']}")

# Public-service readiness docs must be explicitly READY.
rpc=json.loads((root/"testnet/public-services/rpc/endpoints.json").read_text())
add("RPC endpoint config",
    "PASS" if sum(e.get("status")=="READY" for e in rpc["endpoints"])>=3 else "BLOCKED",
    f"ready={sum(e.get('status')=='READY' for e in rpc['endpoints'])}/3")
ex=json.loads((root/"testnet/public-services/explorer/readiness.json").read_text())
add("explorer config",
    "PASS" if ex["backend"].get("status")=="READY" and ex["frontend"].get("status")=="READY" else "BLOCKED",
    f"backend={ex['backend'].get('status')} frontend={ex['frontend'].get('status')}")
fa=json.loads((root/"testnet/public-services/faucet/operations.json").read_text())
add("faucet config","PASS" if fa.get("status")=="READY" else "BLOCKED",fa.get("status"))

# Incidents
inc=[]
for p in (root/"testnet/observation/incidents").glob("*.json"):
    try: inc.append(json.loads(p.read_text()))
    except: pass
bad=[i for i in inc if i.get("severity") in ("MAJOR","CRITICAL") and i.get("state")!="CLOSED"]
add("unresolved major/critical incidents","PASS" if not bad else "FAIL",f"count={len(bad)}")

all_pass=bool(checks) and all(c["status"]=="PASS" for c in checks)
out={"schema":"420-observation-evaluation-v1","all_observation_criteria_pass":all_pass,"checks":checks}
(root/"testnet/observation/reports/evaluation.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2));sys.exit(0 if all_pass else 10)
