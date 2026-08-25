#!/usr/bin/env python3
import json, pathlib, time, urllib.request, urllib.error, sys

root=pathlib.Path(__file__).resolve().parents[1]
rpc=json.loads((root/"testnet/public-services/rpc/endpoints.json").read_text())
results=[]

def rpc_call(url,method,params=[]):
    body=json.dumps({"jsonrpc":"2.0","id":1,"method":method,"params":params}).encode()
    req=urllib.request.Request(url,data=body,headers={"content-type":"application/json"})
    started=time.time()
    with urllib.request.urlopen(req,timeout=5) as r:
        raw=r.read()
    latency=(time.time()-started)*1000
    obj=json.loads(raw)
    if "error" in obj: raise RuntimeError(obj["error"])
    return latency,obj.get("result")

for e in rpc["endpoints"]:
    if e.get("status")!="READY":
        results.append({"name":e["name"],"status":"SKIPPED","reason":"not READY"})
        continue
    try:
        latency,chain=rpc_call(e["http_url"],"eth_chainId")
        latency2,block=rpc_call(e["http_url"],"eth_blockNumber")
        results.append({"name":e["name"],"status":"PASS","chain_id":chain,
                        "block_number":block,"latency_ms":round(max(latency,latency2),2)})
    except Exception as ex:
        results.append({"name":e["name"],"status":"FAIL","error":str(ex)})

out={"schema":"420-public-service-probe-v1","rpc":results}
(root/"testnet/public-services/status/probe.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
sys.exit(0 if all(r["status"] in ("PASS","SKIPPED") for r in results) else 2)
