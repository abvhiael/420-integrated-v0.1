#!/usr/bin/env python3
import json, pathlib, subprocess, sys
root=pathlib.Path(__file__).resolve().parents[1]
checks=[]
def add(name,status,detail): checks.append({"name":name,"status":status,"detail":detail})

obs=json.loads((root/"testnet/observation/state.json").read_text())
add("observation complete",
    "PASS" if obs.get("phase")=="S5-OBSERVATION_COMPLETE" and obs.get("public_promotion_authorized") else "BLOCKED",
    obs.get("phase"))

evp=root/"testnet/observation/reports/evaluation.json"
if evp.exists():
    ev=json.loads(evp.read_text())
    add("observation evaluation","PASS" if ev.get("all_observation_criteria_pass") else "BLOCKED",
        "all criteria must pass")
else:
    add("observation evaluation","BLOCKED","missing")

# Re-run global public-testnet preflight.
cp=subprocess.run(["python3","scripts/testnet-preflight.py"],cwd=root,
                  stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
pp=root/"testnet/checks/preflight.json"
p=json.loads(pp.read_text()) if pp.exists() else {}
add("global public-testnet preflight",
    "PASS" if p.get("public_testnet_launch_authorized") else "BLOCKED",
    "Step 5 global launch gate")

authorized=all(c["status"]=="PASS" for c in checks)
out={"schema":"420-public-promotion-preflight-v1","public_promotion_authorized":authorized,"checks":checks}
(root/"testnet/checks/public-promotion-preflight.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
sys.exit(0 if authorized else 10)
