#!/usr/bin/env python3
import argparse, hashlib, json, pathlib, re, sys

ap=argparse.ArgumentParser()
ap.add_argument("--genesis",default="execution/genesis/execution-genesis.json")
ap.add_argument("--artifacts",default="contracts/artifacts")
ap.add_argument("--storage",default="contracts/config/predeploy/generated-storage.json")
ap.add_argument("--output",default="execution/genesis/execution-genesis-with-predeploys.json")
args=ap.parse_args()

root=pathlib.Path(__file__).resolve().parents[1]
plan=json.loads((root/"contracts/config/predeploy/predeploy-plan.json").read_text())
genesis=json.loads((root/args.genesis).read_text())
storage_path=root/args.storage
if not storage_path.exists():
    raise SystemExit("generated storage map missing; constructors must be compiled/simulated into explicit storage first")
storage=json.loads(storage_path.read_text())

errors=[]
manifest=[]
alloc=genesis.setdefault("alloc",{})

for entry in plan["predeploys"]:
    name=entry["name"];addr=entry["address"].lower()
    if not entry.get("source"):
        errors.append(f"{name}: no source/artifact mapping")
        continue
    art=root/args.artifacts/f"{name}.json"
    if not art.exists():
        errors.append(f"{name}: missing compiled artifact {art.relative_to(root)}")
        continue
    obj=json.loads(art.read_text())
    bytecode=obj.get("deployedBytecode") or obj.get("deployed_bytecode")
    if isinstance(bytecode,dict): bytecode=bytecode.get("object")
    if not isinstance(bytecode,str) or not bytecode:
        errors.append(f"{name}: deployed runtime bytecode missing")
        continue
    bytecode=bytecode.removeprefix("0x")
    if not re.fullmatch(r"[0-9a-fA-F]+",bytecode):
        errors.append(f"{name}: invalid bytecode hex")
        continue
    code="0x"+bytecode.lower()
    slots=storage.get(name)
    if slots is None:
        errors.append(f"{name}: explicit storage initialization missing")
        continue
    if addr in alloc and ("code" in alloc[addr] or "storage" in alloc[addr]):
        errors.append(f"{name}: pre-existing code/storage collision at {addr}")
        continue
    acct=alloc.setdefault(addr,{})
    acct["code"]=code
    acct["storage"]=slots
    manifest.append({
        "name":name,
        "address":addr,
        "runtime_code_sha256":hashlib.sha256(bytes.fromhex(bytecode)).hexdigest(),
        "runtime_code_bytes":len(bytecode)//2,
        "storage_slots":len(slots)
    })

if errors:
    print("\n".join(errors),file=sys.stderr)
    sys.exit(2)

out=root/args.output
out.write_text(json.dumps(genesis,indent=2)+"\n")
m={
 "schema":"420-genesis-predeploy-manifest-v1",
 "genesis_file":str(out.relative_to(root)),
 "predeploy_count":len(manifest),
 "predeploys":manifest,
 "genesis_sha256":hashlib.sha256(out.read_bytes()).hexdigest()
}
(root/"contracts/config/predeploy/generated-manifest.json").write_text(json.dumps(m,indent=2)+"\n")
print(json.dumps(m,indent=2))
