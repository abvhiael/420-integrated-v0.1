#!/usr/bin/env python3
import argparse, json, pathlib, subprocess, sys, urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]

def fail(msg):
    print("ERROR:",msg,file=sys.stderr)
    raise SystemExit(1)

def load(path):
    return json.loads(pathlib.Path(path).read_text())

def rpc(url, method, params):
    body=json.dumps({"jsonrpc":"2.0","id":1,"method":method,"params":params}).encode()
    req=urllib.request.Request(url,data=body,headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=20) as resp:
        out=json.loads(resp.read().decode())
    if "error" in out: fail(f"{method} failed: {out['error']}")
    return out.get("result")

def is_addr(v):
    return isinstance(v,str) and v.startswith("0x") and len(v)==42 and all(c in "0123456789abcdefABCDEF" for c in v[2:])

def is_b32(v):
    return isinstance(v,str) and v.startswith("0x") and len(v)==66 and all(c in "0123456789abcdefABCDEF" for c in v[2:])

def is_tx(v):
    return is_b32(v)

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--manifest",required=True)
    p.add_argument("--evidenceDraft",required=True)
    p.add_argument("--repositorySha",required=True)
    p.add_argument("--output",required=True)
    a=p.parse_args()
    manifest=load(a.manifest); ev=load(a.evidenceDraft)
    if ev.get("phase")!="PAY-AUDIT-7": fail("phase")
    if ev.get("release",{}).get("repositorySha")!=a.repositorySha: fail("repository SHA mismatch")
    rpc_urls=manifest.get("rpc_urls") or manifest.get("rpc",{}).get("http",[])
    if not rpc_urls or any("REPLACE_" in str(x) or not str(x).startswith("https://") for x in rpc_urls): fail("official HTTPS RPC missing")
    url=rpc_urls[0]
    chain=int(rpc(url,"eth_chainId",[]),16)
    if chain!=ev["release"]["chainId"]: fail("chain id mismatch")
    g=rpc(url,"eth_getBlockByNumber",["0x0",False])
    if not g or str(g.get("hash","")).lower()!=str(ev["release"]["genesisHash"]).lower(): fail("genesis hash mismatch")
    blockn=ev["release"]["evidenceBlock"]
    b=rpc(url,"eth_getBlockByNumber",[hex(blockn),False])
    if not b or str(b.get("hash","")).lower()!=str(ev["release"]["evidenceBlockHash"]).lower(): fail("evidence block mismatch")
    for name,item in ev.get("deployments",{}).items():
        addr=item.get("address"); expected=item.get("runtimeCodeHash")
        if not is_addr(addr) or not is_b32(expected): fail(f"{name} deployment evidence")
        code=rpc(url,"eth_getCode",[addr,hex(blockn)])
        if not code or code=="0x": fail(f"{name} missing code")
        observed=subprocess.check_output(["cast","keccak",code],text=True).strip().lower()
        if observed!=str(expected).lower(): fail(f"{name} runtime code hash mismatch")
        item["observedRuntimeCodeHash"]=observed
    for name,tx in ev.get("transactions",{}).items():
        if not is_tx(tx): fail(f"{name} tx hash")
        receipt=rpc(url,"eth_getTransactionReceipt",[tx])
        if not receipt or receipt.get("status")!="0x1": fail(f"{name} receipt not successful")
    for k,v in ev.get("bindings",{}).items():
        if k=="governanceTimelock":
            if str(v).lower()!="0x0000000000000000000000000000000000000429": fail("governance timelock")
        elif v is not True: fail(f"binding not proven: {k}")
    for k,v in ev.get("negativeAndFailurePaths",{}).items():
        if v is not True: fail(f"negative/failure path missing: {k}")
    ae=ev.get("accountingExport",{})
    if ae.get("qualified") is not True or ae.get("refundTotalReconciled") is not True or not is_b32(ae.get("exportDigest")): fail("accounting export evidence")
    idx=ev.get("indexer",{})
    for k in ["qualified","paymentLifecycleReconstructed","restartQualified","repeatedRestartProcessedZero","boundedReorgRecovered","deepReorgRejectedWithoutMutation"]:
        if idx.get(k) is not True: fail("indexer evidence "+k)
    if idx.get("chainId")!=chain or str(idx.get("genesisHash","")).lower()!=str(ev["release"]["genesisHash"]).lower(): fail("indexer chain identity")
    if not is_b32(idx.get("evidenceReportDigest")): fail("indexer report digest")
    out={
      "schema":"420pay-audit-7-live-testnet-evidence-v1",
      "phase":"PAY-AUDIT-7","status":"PASS",
      "repositorySha":a.repositorySha,
      "manifestPath":a.manifest,
      "chainId":chain,
      "genesisHash":ev["release"]["genesisHash"],
      "evidenceBlock":blockn,
      "evidenceBlockHash":ev["release"]["evidenceBlockHash"],
      "deployments":ev["deployments"],
      "transactions":ev["transactions"],
      "bindings":ev["bindings"],
      "negativeAndFailurePaths":ev["negativeAndFailurePaths"],
      "accountingExport":ae,
      "indexer":idx
    }
    pathlib.Path(a.output).write_text(json.dumps(out,indent=2)+"\n")
    print("PAY_AUDIT_7_LIVE_QUALIFICATION=PASS")

if __name__=="__main__":
    main()
