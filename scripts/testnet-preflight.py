#!/usr/bin/env python3
import hashlib, json, pathlib, subprocess, sys

root=pathlib.Path(__file__).resolve().parents[1]
checks=[]

def add(name,status,detail):
    checks.append({"name":name,"status":status,"detail":detail})

# Formal Step 4.9 evidence.
subprocess.run(["python3","scripts/check-release-evidence.py"],cwd=root,
               stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
ep=root/"release/evidence-status.json"
if ep.exists():
    evidence=json.loads(ep.read_text())
    add("step4.9 formal evidence","PASS" if evidence.get("all_required_evidence_pass") else "BLOCKED",
        "all required production evidence must pass")
else:
    add("step4.9 formal evidence","BLOCKED","evidence-status.json missing")

# Registry count.
rp=root/"testnet/validators/registry60.json"
if rp.exists():
    reg=json.loads(rp.read_text())
    count=reg.get("count",0); active=reg.get("active_count",0)
    placeholders=sum(1 for v in reg.get("validators",[]) if v.get("identity_material_status")!="READY")
    add("60 eligible validators","PASS" if count>=60 else "FAIL",f"configured={count}")
    add("15 active seats","PASS" if active>=15 else "FAIL",f"configured={active}")
    add("validator identity ceremony","BLOCKED" if placeholders else "PASS",
        f"placeholder_or_not_ready={placeholders}")
else:
    add("validator registry","FAIL","missing registry60.json")

# Genesis checksums.
sumfile=root/"testnet/genesis/SHA256SUMS.txt"
ok=True
details=[]
if sumfile.exists():
    for line in sumfile.read_text().splitlines():
        if not line.strip():continue
        expected,name=line.split("  ",1)
        p=root/"testnet/genesis"/name
        actual=hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else "MISSING"
        if actual!=expected:ok=False
        details.append(f"{name}:{'ok' if actual==expected else 'bad'}")
else:ok=False
add("genesis bundle checksums","PASS" if ok else "FAIL",", ".join(details) if details else "missing manifest")

# Chain ID result must come from networked preflight.
cp=root/"testnet/checks/chain-id-preflight.json"
if cp.exists():
    cid=json.loads(cp.read_text())
    add("chain ID collision preflight","PASS" if cid.get("status")=="PASS_NO_REGISTRY_MATCH" else "BLOCKED",
        cid.get("status","unknown"))
else:
    add("chain ID collision preflight","BLOCKED","run scripts/check-chain-id.py on networked runner")

# Bootnodes/endpoints must be replaced.
boot=json.loads((root/"testnet/bootnodes/bootnodes.json").read_text())
boot_ready=sum(1 for b in boot["bootnodes"] if b.get("status")=="READY")
add("bootnodes","PASS" if boot_ready>=3 else "BLOCKED",f"ready={boot_ready}/3")

svc=json.loads((root/"testnet/services/endpoints.json").read_text())
rpc_ready=sum(1 for r in svc["rpc"] if r.get("status")=="READY")
add("public RPC nodes","PASS" if rpc_ready>=3 else "BLOCKED",f"ready={rpc_ready}/3")
add("explorer","PASS" if svc["explorer"].get("status")=="READY" else "BLOCKED",svc["explorer"].get("status"))
add("faucet","PASS" if svc["faucet"].get("status")=="READY" else "BLOCKED",svc["faucet"].get("status"))

ready=all(c["status"]=="PASS" for c in checks)
out={
    "schema":"420-integrated-testnet-preflight-v1",
    "public_testnet_launch_authorized":ready,
    "checks":checks
}
(root/"testnet/checks/preflight.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
sys.exit(0 if ready else 10)
