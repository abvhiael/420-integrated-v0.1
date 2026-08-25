#!/usr/bin/env python3
import argparse, hashlib, json, pathlib, sys, datetime

ap=argparse.ArgumentParser()
ap.add_argument("--genesis-time",required=True,help="RFC3339 UTC")
args=ap.parse_args()

root=pathlib.Path(__file__).resolve().parents[1]
seedp=root/"testnet/ceremony/genesis-seed/result.json"
regp=root/"testnet/validators/registry60.json"
if not seedp.exists(): raise SystemExit("genesis seed result missing")
if not regp.exists(): raise SystemExit("validator registry missing")

seed=json.loads(seedp.read_text())
reg=json.loads(regp.read_text())
if reg.get("count")!=60 or reg.get("active_count")!=15:
    raise SystemExit("validator registry invariant failed")
if any(v.get("identity_material_status")!="READY" for v in reg["validators"]):
    raise SystemExit("validator registry contains non-ready identities")

try:
    dt=datetime.datetime.fromisoformat(args.genesis_time.replace("Z","+00:00"))
except ValueError as e:
    raise SystemExit(str(e))
if dt.tzinfo is None: raise SystemExit("timezone required")
gt=dt.astimezone(datetime.timezone.utc).isoformat().replace("+00:00","Z")

cpath=root/"testnet/genesis/consensus-genesis.json"
cg=json.loads(cpath.read_text())
cg["genesis_time"]=gt
cg["rotation_seed"]["value"]="0x"+seed["genesis_seed"]
cg["rotation_seed"]["status"]="FROZEN_BY_GENESIS_SEED_CEREMONY"
cg["validator_registry_root"]=reg["ceremony_root"]
cg["status"]="FROZEN_TESTNET_GENESIS"
cpath.write_text(json.dumps(cg,indent=2)+"\n")

files=[
 root/"testnet/genesis/execution-genesis.json",
 root/"testnet/genesis/consensus-genesis.json",
 root/"testnet/genesis/ai-genesis.json",
 root/"testnet/genesis/genesis-allocations.json",
 root/"testnet/validators/registry60.json",
 root/"testnet/ceremony/genesis-seed/result.json",
]
lines=[]
for p in files:
    lines.append(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(root)}")
manifest=root/"testnet/ceremony/freeze/FROZEN-SHA256SUMS.txt"
manifest.write_text("\n".join(lines)+"\n")

bundle={
 "schema":"420-testnet-genesis-freeze-v1",
 "genesis_time":gt,
 "genesis_seed":"0x"+seed["genesis_seed"],
 "validator_registry_root":reg["ceremony_root"],
 "files":[{"path":str(p.relative_to(root)),"sha256":hashlib.sha256(p.read_bytes()).hexdigest()} for p in files],
 "status":"FROZEN"
}
(root/"testnet/ceremony/freeze/freeze-record.json").write_text(json.dumps(bundle,indent=2)+"\n")
print(json.dumps(bundle,indent=2))
