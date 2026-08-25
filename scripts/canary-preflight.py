#!/usr/bin/env python3
import json, pathlib, subprocess, sys
root=pathlib.Path(__file__).resolve().parents[1]
checks=[]
def add(name,status,detail): checks.append({"name":name,"status":status,"detail":detail})

# Step 4.9 evidence
subprocess.run(["python3","scripts/check-release-evidence.py"],cwd=root,
               stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
esp=root/"release/evidence-status.json"
ev=json.loads(esp.read_text()) if esp.exists() else {}
add("production evidence","PASS" if ev.get("all_required_evidence_pass") else "BLOCKED",
    "Step 4.9 evidence gate")

# Validator registry
reg=json.loads((root/"testnet/validators/registry60.json").read_text())
ready=sum(v.get("identity_material_status")=="READY" for v in reg["validators"])
add("validator ceremony","PASS" if ready==60 else "BLOCKED",f"{ready}/60 READY")

# Seed/freeze
add("genesis seed ceremony","PASS" if (root/"testnet/ceremony/genesis-seed/result.json").exists() else "BLOCKED",
    "result.json")
add("genesis freeze","PASS" if (root/"testnet/ceremony/freeze/freeze-record.json").exists() else "BLOCKED",
    "freeze-record.json")

# Infra
infra=json.loads((root/"testnet/infrastructure/inventory.json").read_text())
boot=[n for n in infra["nodes"] if n["role"]=="bootnode" and n["status"]=="READY"]
domains={n["failure_domain"] for n in boot}
add("bootnode infrastructure","PASS" if len(boot)>=3 and len(domains)>=3 else "BLOCKED",
    f"ready={len(boot)}, failure_domains={len(domains)}")

authorized=all(c["status"]=="PASS" for c in checks)
out={"schema":"420-testnet-canary-preflight-v1","canary_start_authorized":authorized,"checks":checks}
(root/"testnet/checks/canary-preflight.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
sys.exit(0 if authorized else 10)
