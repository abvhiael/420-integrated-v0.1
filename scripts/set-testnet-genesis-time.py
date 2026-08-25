#!/usr/bin/env python3
import argparse, datetime, json, pathlib, sys
ap=argparse.ArgumentParser()
ap.add_argument("--time",required=True,help="UTC RFC3339 launch time, e.g. 2026-09-01T18:00:00Z")
args=ap.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]
try:
    dt=datetime.datetime.fromisoformat(args.time.replace("Z","+00:00"))
except ValueError as e:
    raise SystemExit(str(e))
if dt.tzinfo is None:
    raise SystemExit("timezone is required")
p=root/"testnet/genesis/consensus-genesis.json"
cfg=json.loads(p.read_text())
cfg["genesis_time"]=dt.astimezone(datetime.timezone.utc).isoformat().replace("+00:00","Z")
p.write_text(json.dumps(cfg,indent=2)+"\n")
print(cfg["genesis_time"])
