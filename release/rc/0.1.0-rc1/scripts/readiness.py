#!/usr/bin/env python3
import json, pathlib, shutil, subprocess, sys
root=pathlib.Path(__file__).resolve().parents[1]
checks=[]

def add(name,status,detail): checks.append({"name":name,"status":status,"detail":detail)
def need(rel):
    p=root/rel
    add(rel,"PASS" if p.exists() else "FAIL","present" if p.exists() else "missing")

for rel in [
 "config/protocol.json","config/genesis-allocations.json","config/ai-genesis.json",
 "execution/genesis/execution-genesis.json","devnet/config/nodes15.json",
 "consensus/p2p/libp2p/transport.go","consensus/crypto/bls/backend_blst.go",
 "release/rc/manifest.json","release/evidence/schema.json"
]: need(rel)

go=shutil.which("go")
if go:
    cp=subprocess.run([go,"test","./..."],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    add("default source test suite","PASS" if cp.returncode==0 else "FAIL","go test ./...")
else:add("go compiler","FAIL","not installed")

# Evaluate formal evidence.
cp=subprocess.run(["python3","scripts/check-release-evidence.py"],cwd=root,
                  stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
status_path=root/"release/evidence-status.json"
if status_path.exists():
    es=json.loads(status_path.read_text())
    for g in es.get("gates",[]):
        status=g["status"]
        add("evidence:"+g["gate"], "PASS" if status=="PASS" else "BLOCKED",
            f"formal release evidence status={status}")
    ready=bool(es.get("public_testnet_ready"))
else:
    add("release evidence","BLOCKED","release/evidence-status.json missing")
    ready=False

# A public testnet can only be ready if evidence and source checks pass.
if any(c["status"]=="FAIL" for c in checks): ready=False
result={"public_testnet_ready":ready,"release_channel":"TESTNET_RC","checks":checks}
(root/"release/readiness.json").write_text(json.dumps(result,indent=2)+"\n")
print(json.dumps(result,indent=2))
sys.exit(0 if all(c["status"] in ("PASS","BLOCKED") for c in checks) else 2)
