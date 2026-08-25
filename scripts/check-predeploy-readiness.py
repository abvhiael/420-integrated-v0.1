#!/usr/bin/env python3
import json, pathlib, shutil, sys
root=pathlib.Path(__file__).resolve().parents[1]
plan=json.loads((root/"contracts/config/predeploy/predeploy-plan.json").read_text())
checks=[]
def add(name,status,detail):checks.append({"name":name,"status":status,"detail":detail})

addresses=[e["address"].lower() for e in plan["predeploys"]]
add("address uniqueness","PASS" if len(addresses)==len(set(addresses)) else "FAIL",f"{len(addresses)} entries")
add("frozen address map","PASS" if json.loads((root/"config/system-addresses.json").read_text()).get("status")=="FROZEN_STEP6_1" else "FAIL","system-addresses v3")

missing_sources=[e["name"] for e in plan["predeploys"] if not e.get("source")]
add("source coverage","PASS" if not missing_sources else "FAIL",",".join(missing_sources) or "all mapped")

forge=shutil.which("forge")
add("Foundry compiler","PASS" if forge else "BLOCKED","installed" if forge else "forge absent in runtime")

missing_art=[e["name"] for e in plan["predeploys"] if not (root/e["artifact"]).exists()]
add("compiled artifacts","PASS" if not missing_art else "BLOCKED",f"missing={len(missing_art)}")

storage=root/"contracts/config/predeploy/generated-storage.json"
add("constructor storage materialized","PASS" if storage.exists() else "BLOCKED","generated-storage.json required")

# Critical unresolved inputs must remain blockers.
init=json.loads((root/"contracts/config/predeploy/storage-init.json").read_text())
for key in ["founder_beneficiaries","bridge_verifier"]:
    value=init.get(key)
    blocked=isinstance(value,str) and ("UNRESOLVED" in value or "FROM_" in value)
    add(key,"BLOCKED" if blocked else "PASS",str(value))

ready=all(c["status"]=="PASS" for c in checks)
out={"schema":"420-predeploy-readiness-v1","genesis_predeploy_ready":ready,"checks":checks}
(root/"contracts/config/predeploy/readiness.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
sys.exit(0 if all(c["status"] in ("PASS","BLOCKED") for c in checks) else 2)
