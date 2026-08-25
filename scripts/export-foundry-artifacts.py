#!/usr/bin/env python3
import json, pathlib, shutil, sys
root=pathlib.Path(__file__).resolve().parents[1]
out=root/"contracts/out"
dst=root/"contracts/artifacts"
dst.mkdir(parents=True,exist_ok=True)
plan=json.loads((root/"contracts/config/predeploy/predeploy-plan.json").read_text())
errors=[]
for e in plan["predeploys"]:
    name=e["name"]
    candidates=list(out.glob(f"**/{name}.json"))
    if not candidates:
        errors.append(f"{name}: Foundry artifact missing")
        continue
    raw=json.loads(candidates[0].read_text())
    deployed=raw.get("deployedBytecode",{}).get("object","")
    abi=raw.get("abi",[])
    storage=raw.get("storageLayout",{})
    rec={
        "contractName":name,
        "deployedBytecode":deployed,
        "abi":abi,
        "storageLayout":storage
    }
    (dst/f"{name}.json").write_text(json.dumps(rec,indent=2)+"\n")
if errors:
    print("\n".join(errors),file=sys.stderr);sys.exit(2)
print(f"exported {len(plan['predeploys'])} artifacts")
