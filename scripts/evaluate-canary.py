#!/usr/bin/env python3
import json, pathlib, sys, datetime
root=pathlib.Path(__file__).resolve().parents[1]
metrics_dir=root/"testnet/canary/metrics"
files=[p for p in sorted(metrics_dir.glob("*.json")) if p.name not in ("schema.json","snapshot-template.json")]
checks=[]
def add(name,status,detail): checks.append({"name":name,"status":status,"detail":detail})
if not files:
    add("health snapshots","BLOCKED","no real canary snapshots present")
else:
    snaps=[]
    for p in files:
        try: snaps.append(json.loads(p.read_text()))
        except Exception as e: add(f"parse:{p.name}","FAIL",str(e))
    if snaps:
        ts=[]
        for s in snaps:
            try: ts.append(datetime.datetime.fromisoformat(s["timestamp_utc"].replace("Z","+00:00")))
            except: pass
        runtime=(max(ts)-min(ts)).total_seconds()/3600 if len(ts)>=2 else 0
        add("minimum 24h runtime","PASS" if runtime>=24 else "BLOCKED",f"{runtime:.2f}h")
        add("conflicting QC","PASS" if not any(s.get("conflicting_qc_detected") for s in snaps) else "FAIL","must remain false")
        add("safety halt","PASS" if not any(s.get("safety_halt") for s in snaps) else "FAIL","must remain false")
        add("active seats","PASS" if all(s.get("active_seats",0)>=15 for s in snaps) else "FAIL","minimum 15")
        add("eligible validators","PASS" if all(s.get("eligible_validators",0)>=60 for s in snaps) else "FAIL","minimum 60")
        add("Engine health","PASS" if all(s.get("engine_errors_total",0)==0 for s in snaps) else "BLOCKED","investigate errors")
        add("peer floor","PASS" if all(s.get("peer_count_min",0)>=3 for s in snaps) else "BLOCKED","minimum 3")
        fb1=sum(s.get("fallback1_proposals",0) for s in snaps); fb2=sum(s.get("fallback2_proposals",0) for s in snaps)
        add("FB1 exercised","PASS" if fb1>0 else "BLOCKED",f"count={fb1}")
        add("FB2 exercised","PASS" if fb2>0 else "BLOCKED",f"count={fb2}")
inc=[]
for p in (root/"testnet/canary/incidents").glob("*.json"):
    if p.name=="schema.json": continue
    try: inc.append(json.loads(p.read_text()))
    except: pass
critical=[i for i in inc if i.get("severity")=="CRITICAL" and i.get("state")!="CLOSED"]
add("unresolved critical incidents","PASS" if not critical else "FAIL",f"count={len(critical)}")
for name,path in [
 ("11/15 quorum edge","testnet/canary/reports/quorum11.json"),
 ("10/15 quorum loss","testnet/canary/reports/quorum10.json"),
 ("restart recovery","testnet/canary/reports/restart.json"),
 ("AI absence liveness","testnet/canary/reports/ai-absence.json")]:
    p=root/path
    if not p.exists(): add(name,"BLOCKED","report missing")
    else:
        d=json.loads(p.read_text()); add(name,"PASS" if d.get("pass") else "FAIL",d.get("summary",""))
all_pass=bool(checks) and all(c["status"]=="PASS" for c in checks)
out={"schema":"420-canary-evaluation-v1","all_acceptance_criteria_pass":all_pass,"checks":checks}
(root/"testnet/canary/reports/evaluation.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2));sys.exit(0 if all_pass else 10)
