#!/usr/bin/env python3
import argparse, datetime, json, pathlib, sys

root=pathlib.Path(__file__).resolve().parents[1]
p=root/"testnet/observation/state.json"
state=json.loads(p.read_text())

ap=argparse.ArgumentParser()
sp=ap.add_subparsers(dest="cmd",required=True)
for c in ["status","start","hold","resume","fail","complete","promote"]:
    sp.add_parser(c)
args=ap.parse_args()

def save():
    p.write_text(json.dumps(state,indent=2)+"\n")
def now():
    return datetime.datetime.now(datetime.timezone.utc)

if args.cmd=="status":
    print(json.dumps(state,indent=2));sys.exit(0)

if args.cmd=="start":
    if state["phase"]!="S5-OBSERVATION_PREP":
        raise SystemExit("observation can only start from S5-OBSERVATION_PREP")
    canary=json.loads((root/"testnet/canary/state.json").read_text())
    if canary.get("phase")!="S5-OBSERVATION":
        raise SystemExit("canary has not promoted to S5-OBSERVATION")
    t=now()
    state["phase"]="S5-OBSERVATION_RUNNING"
    state["started_at_utc"]=t.isoformat()
    state["minimum_end_at_utc"]=(t+datetime.timedelta(hours=72)).isoformat()
    state["completed_at_utc"]=None
    state["public_promotion_authorized"]=False
    save();print(json.dumps(state,indent=2));sys.exit(0)

if args.cmd=="hold":
    if state["phase"]!="S5-OBSERVATION_RUNNING": raise SystemExit("hold requires running observation")
    state["phase"]="S5-OBSERVATION_HOLD";save();print(json.dumps(state,indent=2));sys.exit(0)

if args.cmd=="resume":
    if state["phase"]!="S5-OBSERVATION_HOLD": raise SystemExit("resume requires held observation")
    state["phase"]="S5-OBSERVATION_RUNNING";save();print(json.dumps(state,indent=2));sys.exit(0)

if args.cmd=="fail":
    if state["phase"] not in ("S5-OBSERVATION_RUNNING","S5-OBSERVATION_HOLD"):
        raise SystemExit("fail requires active observation")
    state["phase"]="S5-OBSERVATION_FAILED"
    state["completed_at_utc"]=now().isoformat()
    state["public_promotion_authorized"]=False
    save();print(json.dumps(state,indent=2));sys.exit(0)

if args.cmd=="complete":
    if state["phase"]!="S5-OBSERVATION_RUNNING": raise SystemExit("complete requires running observation")
    if now()<datetime.datetime.fromisoformat(state["minimum_end_at_utc"]):
        raise SystemExit("72-hour minimum has not elapsed")
    rp=root/"testnet/observation/reports/evaluation.json"
    if not rp.exists(): raise SystemExit("observation evaluation missing")
    report=json.loads(rp.read_text())
    if not report.get("all_observation_criteria_pass"):
        raise SystemExit("observation criteria have not passed")
    state["phase"]="S5-OBSERVATION_COMPLETE"
    state["completed_at_utc"]=now().isoformat()
    state["public_promotion_authorized"]=True
    save();print(json.dumps(state,indent=2));sys.exit(0)

if args.cmd=="promote":
    if state["phase"]!="S5-OBSERVATION_COMPLETE" or not state.get("public_promotion_authorized"):
        raise SystemExit("public promotion requires completed authorized observation")
    # Public launch preflight is a separate hard gate.
    pre=root/"testnet/checks/preflight.json"
    if not pre.exists(): raise SystemExit("public testnet preflight missing")
    d=json.loads(pre.read_text())
    if not d.get("public_testnet_launch_authorized"):
        raise SystemExit("public testnet preflight not authorized")
    state["phase"]="S5-PUBLIC"
    save();print(json.dumps(state,indent=2));sys.exit(0)
