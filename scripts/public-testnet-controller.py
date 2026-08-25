#!/usr/bin/env python3
import argparse, datetime, json, pathlib, sys

root=pathlib.Path(__file__).resolve().parents[1]
p=root/"testnet/public/state.json"
state=json.loads(p.read_text())

ap=argparse.ArgumentParser()
sp=ap.add_subparsers(dest="cmd",required=True)
for c in ["status","launch","degrade","restore","maintenance","resume"]:
    sp.add_parser(c)
args=ap.parse_args()

def save():
    p.write_text(json.dumps(state,indent=2)+"\n")

if args.cmd=="status":
    print(json.dumps(state,indent=2));sys.exit(0)

if args.cmd=="launch":
    if state["phase"]!="S5-PUBLIC_PREP":
        raise SystemExit("launch requires S5-PUBLIC_PREP")
    # Observation controller must have reached S5-PUBLIC.
    obs=json.loads((root/"testnet/observation/state.json").read_text())
    if obs.get("phase")!="S5-PUBLIC":
        raise SystemExit("observation phase has not promoted to S5-PUBLIC")
    # Final public-promotion preflight must pass.
    pf=root/"testnet/checks/public-promotion-preflight.json"
    if not pf.exists():
        raise SystemExit("public promotion preflight missing")
    d=json.loads(pf.read_text())
    if not d.get("public_promotion_authorized"):
        raise SystemExit("public promotion preflight is not authorized")
    # Publication checklist must be fully ready.
    checklist=json.loads((root/"testnet/public/publication-checklist.json").read_text())
    not_ready=[x["item"] for x in checklist["required"] if x.get("status")!="READY"]
    if not_ready:
        raise SystemExit("publication checklist incomplete: "+", ".join(not_ready))
    now=datetime.datetime.now(datetime.timezone.utc).isoformat()
    state["phase"]="S5-PUBLIC_LIVE"
    state["launched_at_utc"]=now
    state["public_launch_authorized"]=True
    state["public_launch_record"]="testnet/public/launch-record.json"
    record={
        "schema":"420-public-launch-record-v1",
        "launched_at_utc":now,
        "chain_metadata":"testnet/public/metadata/chain.json",
        "publication_checklist":"testnet/public/publication-checklist.json",
        "status":"LIVE"
    }
    (root/"testnet/public/launch-record.json").write_text(json.dumps(record,indent=2)+"\n")
    save();print(json.dumps(state,indent=2));sys.exit(0)

if args.cmd=="degrade":
    if state["phase"]!="S5-PUBLIC_LIVE":raise SystemExit("degrade requires live")
    state["phase"]="S5-PUBLIC_DEGRADED";save();print(json.dumps(state,indent=2));sys.exit(0)
if args.cmd=="restore":
    if state["phase"]!="S5-PUBLIC_DEGRADED":raise SystemExit("restore requires degraded")
    state["phase"]="S5-PUBLIC_LIVE";save();print(json.dumps(state,indent=2));sys.exit(0)
if args.cmd=="maintenance":
    if state["phase"] not in ("S5-PUBLIC_LIVE","S5-PUBLIC_DEGRADED"):
        raise SystemExit("maintenance requires live/degraded")
    state["phase"]="S5-PUBLIC_MAINTENANCE";save();print(json.dumps(state,indent=2));sys.exit(0)
if args.cmd=="resume":
    if state["phase"]!="S5-PUBLIC_MAINTENANCE":raise SystemExit("resume requires maintenance")
    state["phase"]="S5-PUBLIC_LIVE";save();print(json.dumps(state,indent=2));sys.exit(0)
