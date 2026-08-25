#!/usr/bin/env python3
"""
Networked launch preflight. Queries the public chainid.network chain registry for the candidate ID.
Absence from the registry is evidence for launch review, not mathematical proof that no private or
unregistered network uses the same ID.
"""
import argparse, json, pathlib, sys, urllib.request, urllib.error

ap=argparse.ArgumentParser()
ap.add_argument("--chain-id",type=int,default=420)
ap.add_argument("--allow-registered-self",action="store_true")
args=ap.parse_args()

root=pathlib.Path(__file__).resolve().parents[1]
url=f"https://chainid.network/chains.json"
result={"chain_id":args.chain_id,"registry":"chainid.network","status":"UNKNOWN","matches":[]}

try:
    with urllib.request.urlopen(url,timeout=15) as r:
        chains=json.load(r)
    matches=[c for c in chains if c.get("chainId")==args.chain_id]
    result["matches"]=[{
        "name":c.get("name"),"chain":c.get("chain"),
        "networkId":c.get("networkId"),"infoURL":c.get("infoURL")
    } for c in matches]
    if matches:
        result["status"]="COLLISION_REVIEW_REQUIRED"
    else:
        result["status"]="PASS_NO_REGISTRY_MATCH"
except Exception as e:
    result["status"]="ERROR"
    result["error"]=str(e)

out=root/"testnet/checks/chain-id-preflight.json"
out.write_text(json.dumps(result,indent=2)+"\n")
print(json.dumps(result,indent=2))
sys.exit(0 if result["status"]=="PASS_NO_REGISTRY_MATCH" else 2)
