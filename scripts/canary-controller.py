#!/usr/bin/env python3
import argparse, datetime, json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[1]
statep=root/"testnet/canary/state.json"; state=json.loads(statep.read_text())
ap=argparse.ArgumentParser(); sp=ap.add_subparsers(dest="cmd",required=True)
for c in ["status","start","hold","resume","fail","complete","promote"]: sp.add_parser(c)
args=ap.parse_args()
def save(): statep.write_text(json.dumps(state,indent=2)+"\n")
def now(): return datetime.datetime.now(datetime.timezone.utc)
if args.cmd=="status":
    print(json.dumps(state,indent=2));sys.exit(0)
if args.cmd=="start":
    if state["phase"]!="S5-CANARY_PREP": raise SystemExit("canary can only start from S5-CANARY_PREP")
    p=root/"testnet/checks/canary-preflight.json"
    if not p.exists(): raise SystemExit("canary preflight missing")
    d=json.loads(p.read_text())
    if not d.get("canary_start_authorized"): raise SystemExit("canary preflight is not authorized")
    t=now();state["phase"]="S5-CANARY_RUNNING";state["started_at_utc"]=t.isoformat()
    state["minimum_end_at_utc"]=(t+datetime.timedelta(hours=24)).isoformat()
    state["completed_at_utc"]=None;state["promotion_authorized"]=False;save()
    print(json.dumps(state,indent=2));sys.exit(0)
if args.cmd=="hold":
    if state["phase"]!="S5-CANARY_RUNNING": raise SystemExit("hold requires running canary")
    state["phase"]="S5-CANARY_HOLD";save();print(json.dumps(state,indent=2));sys.exit(0)
if args.cmd=="resume":
    if state["phase"]!="S5-CANARY_HOLD": raise SystemExit("resume requires held canary")
    state["phase"]="S5-CANARY_RUNNING";save();print(json.dumps(state,indent=2));sys.exit(0)
if args.cmd=="fail":
    if state["phase"] not in ("S5-CANARY_RUNNING","S5-CANARY_HOLD"): raise SystemExit("fail requires active canary")
    state["phase"]="S5-CANARY_FAILED";state["completed_at_utc"]=now().isoformat()
    state["promotion_authorized"]=False;save();print(json.dumps(state,indent=2));sys.exit(0)
if args.cmd=="complete":
    if state["phase"]!="S5-CANARY_RUNNING": raise SystemExit("complete requires running canary")
    minimum=datetime.datetime.fromisoformat(state["minimum_end_at_utc"])
    if now()<minimum: raise SystemExit("24-hour minimum has not elapsed")
    rp=root/"testnet/canary/reports/evaluation.json"
    if not rp.exists(): raise SystemExit("canary evaluation missing")
    report=json.loads(rp.read_text())
    if not report.get("all_acceptance_criteria_pass"): raise SystemExit("acceptance criteria have not passed")
    state["phase"]="S5-CANARY_COMPLETE";state["completed_at_utc"]=now().isoformat()
    state["promotion_authorized"]=True;save();print(json.dumps(state,indent=2));sys.exit(0)
if args.cmd=="promote":
    if state["phase"]!="S5-CANARY_COMPLETE" or not state.get("promotion_authorized"):
        raise SystemExit("promotion requires completed authorized canary")
    state["phase"]="S5-OBSERVATION";save();print(json.dumps(state,indent=2));sys.exit(0)
