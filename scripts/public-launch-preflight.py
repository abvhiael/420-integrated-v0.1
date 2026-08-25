#!/usr/bin/env python3
import json, pathlib, subprocess, sys
root=pathlib.Path(__file__).resolve().parents[1]
checks=[]
def add(name,status,detail):checks.append({"name":name,"status":status,"detail":detail})

# Observation-to-public gate
subprocess.run(["python3","scripts/public-promotion-preflight.py"],cwd=root,
               stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
p=root/"testnet/checks/public-promotion-preflight.json"
d=json.loads(p.read_text()) if p.exists() else {}
add("public promotion preflight","PASS" if d.get("public_promotion_authorized") else "BLOCKED",
    "Step 5.3 promotion gate")

# Public metadata should have no placeholders.
metadata=json.loads((root/"testnet/public/metadata/chain.json").read_text())
raw=json.dumps(metadata)
add("public chain metadata","PASS" if "REPLACE" not in raw and metadata.get("chain_id_status")=="FROZEN_FOR_PUBLIC_TESTNET" else "BLOCKED",
    metadata.get("chain_id_status"))

wallet=json.loads((root/"testnet/public/metadata/wallet-network.json").read_text())
add("wallet network config","PASS" if wallet.get("status")=="READY" and "REPLACE" not in json.dumps(wallet) else "BLOCKED",
    wallet.get("status"))

# Release publication
rel=json.loads((root/"testnet/public/releases/release.json").read_text())
release_ready=all(a.get("status")=="READY" for a in rel["artifacts"]) and rel["signature_policy"].get("status")=="READY"
add("release publication/signature","PASS" if release_ready else "BLOCKED","all artifacts and signature required")

# Publication checklist
pc=json.loads((root/"testnet/public/publication-checklist.json").read_text())
ready_items=sum(x.get("status")=="READY" for x in pc["required"])
add("publication checklist","PASS" if ready_items==len(pc["required"]) else "BLOCKED",
    f"{ready_items}/{len(pc['required'])} READY")

authorized=all(c["status"]=="PASS" for c in checks)
out={"schema":"420-public-launch-preflight-v1","public_launch_authorized":authorized,"checks":checks}
(root/"testnet/checks/public-launch-preflight.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2));sys.exit(0 if authorized else 10)
