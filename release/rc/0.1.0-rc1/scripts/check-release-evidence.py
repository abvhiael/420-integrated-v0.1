#!/usr/bin/env python3
import json, pathlib, sys, hashlib

root=pathlib.Path(__file__).resolve().parents[1]
manifest=json.loads((root/"release/rc/manifest.json").read_text())
required=manifest["required_evidence"]
results=[]
all_pass=True

for gate in required:
    p=root/"release/evidence"/f"{gate}.json"
    if not p.exists():
        results.append({"gate":gate,"status":"MISSING"})
        all_pass=False
        continue
    try:
        rec=json.loads(p.read_text())
    except Exception as e:
        results.append({"gate":gate,"status":"INVALID","error":str(e)})
        all_pass=False
        continue
    status=rec.get("status")
    if status!="PASS":
        all_pass=False
    results.append({"gate":gate,"status":status,"timestamp_utc":rec.get("timestamp_utc"),"runner":rec.get("runner")})

out={
    "schema":"420-integrated-release-evidence-status-v1",
    "release_channel":manifest["release_channel"],
    "version":manifest["version"],
    "all_required_evidence_pass":all_pass,
    "public_testnet_ready":all_pass,
    "gates":results
}
(root/"release/evidence-status.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
sys.exit(0 if all_pass else 10)
