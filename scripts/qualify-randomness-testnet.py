#!/usr/bin/env python3
import argparse, json, pathlib, subprocess, sys, urllib.request

def fail(msg):
    print("ERROR:", msg, file=sys.stderr)
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

def receipt_ok(url, tx, label):
    if not is_b32(tx): fail(label+" tx hash")
    r=rpc(url,"eth_getTransactionReceipt",[tx])
    if not r or r.get("status")!="0x1": fail(label+" receipt not successful")

def cast_call(url, address, signature):
    cp=subprocess.run(["cast","call",address,signature,"--rpc-url",url],capture_output=True,text=True)
    if cp.returncode != 0: fail(f"cast call {signature}: {cp.stderr.strip()}")
    return cp.stdout.strip()

def normalize_cast_address(value):
    for token in value.replace("["," ").replace("]"," ").replace(","," ").split():
        if is_addr(token): return token.lower()
    fail("cast address result malformed: "+value)

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--manifest",required=True)
    p.add_argument("--evidenceDraft",required=True)
    p.add_argument("--repositorySha",required=True)
    p.add_argument("--output",required=True)
    a=p.parse_args()
    manifest=load(a.manifest)
    ev=load(a.evidenceDraft)

    if ev.get("phase")!="RANDOM-AUDIT-5": fail("phase")
    if ev.get("status")=="DRAFT_REQUIRES_REAL_TESTNET_EVIDENCE": fail("template/draft status")
    release=ev.get("release",{})
    if release.get("repositorySha")!=a.repositorySha: fail("repository SHA mismatch")

    rpc_urls=manifest.get("rpc_urls") or manifest.get("rpc",{}).get("http",[])
    if not rpc_urls or any("REPLACE_" in str(x) or not str(x).startswith("https://") for x in rpc_urls):
        fail("official HTTPS RPC missing")
    url=rpc_urls[0]

    chain=int(rpc(url,"eth_chainId",[]),16)
    if chain!=release.get("chainId"): fail("chain id mismatch")
    genesis=rpc(url,"eth_getBlockByNumber",["0x0",False])
    if not genesis or str(genesis.get("hash","")).lower()!=str(release.get("genesisHash","")).lower():
        fail("genesis hash mismatch")
    blockn=release.get("evidenceBlock")
    if not isinstance(blockn,int) or blockn<=0: fail("evidence block")
    block=rpc(url,"eth_getBlockByNumber",[hex(blockn),False])
    if not block or str(block.get("hash","")).lower()!=str(release.get("evidenceBlockHash","")).lower():
        fail("evidence block mismatch")

    deployments=ev.get("deployments",{})
    required=["RandomnessRegistry","RandomnessRouteRegistry420","RandomnessProfileRegistry420","RandomnessRouter420"]
    for name in required:
        item=deployments.get(name,{})
        addr=item.get("address"); expected=item.get("runtimeCodeHash")
        if not is_addr(addr) or not is_b32(expected): fail(name+" deployment evidence")
        code=rpc(url,"eth_getCode",[addr,hex(blockn)])
        if not code or code=="0x": fail(name+" missing code")
        observed=subprocess.check_output(["cast","keccak",code],text=True).strip().lower()
        if observed!=str(expected).lower(): fail(name+" runtime code hash mismatch")
        item["observedRuntimeCodeHash"]=observed

    if deployments["RandomnessRegistry"]["address"].lower()!="0x0000000000000000000000000000000000000428":
        fail("RandomnessRegistry address")
    if deployments["RandomnessRegistry"]["runtimeCodeHash"].lower()!="0x0c921ab8b2282ea3ed2d7f64b5ca0f6ecb54c67d52e421a347a1449d43e8345a":
        fail("RandomnessRegistry canonical runtime hash")

    bindings=ev.get("bindings",{})
    if str(bindings.get("governanceTimelock","")).lower()!="0x0000000000000000000000000000000000000429":
        fail("governance timelock evidence")
    if str(bindings.get("protocolRegistry","")).lower()!="0x0000000000000000000000000000000000000434":
        fail("ProtocolRegistry evidence")
    for k in ["routerConstructorBindingsVerified","registryBoundRouterVerified","registryBoundRouterMatchesPublishedRouter","bindRouterOneTimeVerified"]:
        if bindings.get(k) is not True: fail("binding not proven: "+k)

    registry_addr=deployments["RandomnessRegistry"]["address"]
    routes_addr=deployments["RandomnessRouteRegistry420"]["address"]
    profiles_addr=deployments["RandomnessProfileRegistry420"]["address"]
    router_addr=deployments["RandomnessRouter420"]["address"]
    if normalize_cast_address(cast_call(url,registry_addr,"randomnessRouter()(address)"))!=router_addr.lower():
        fail("live RandomnessRegistry router binding mismatch")
    if normalize_cast_address(cast_call(url,registry_addr,"governanceTimelock()(address)"))!="0x0000000000000000000000000000000000000429":
        fail("live RandomnessRegistry GovernanceTimelock mismatch")
    if normalize_cast_address(cast_call(url,routes_addr,"governanceTimelock()(address)"))!="0x0000000000000000000000000000000000000429":
        fail("live route registry GovernanceTimelock mismatch")
    if normalize_cast_address(cast_call(url,profiles_addr,"governanceTimelock()(address)"))!="0x0000000000000000000000000000000000000429":
        fail("live profile registry GovernanceTimelock mismatch")
    if normalize_cast_address(cast_call(url,router_addr,"routeRegistry()(address)"))!=routes_addr.lower():
        fail("router routeRegistry binding mismatch")
    if normalize_cast_address(cast_call(url,router_addr,"profileRegistry()(address)"))!=profiles_addr.lower():
        fail("router profileRegistry binding mismatch")
    if normalize_cast_address(cast_call(url,router_addr,"randomnessRegistry()(address)"))!=registry_addr.lower():
        fail("router RandomnessRegistry binding mismatch")

    publication=ev.get("registryPublication",{})
    if publication.get("componentIdPreimage")!="420/APP/420RANDOM/RANDOMNESS_ROUTER": fail("component id preimage")
    if publication.get("serviceIdPreimage")!="420/service/randomness/v1": fail("service id preimage")
    if publication.get("componentVersion")!="1.0.0" or publication.get("serviceVersion")!=1: fail("Registry version evidence")
    for k in ["componentActive","serviceActive","componentRuntimeIdentityMatches","serviceRuntimeIdentityMatches"]:
        if publication.get(k) is not True: fail("Registry publication not proven: "+k)
    for k in ["componentRegistrationTx","servicePublicationTx","bindRouterTx"]:
        receipt_ok(url,publication.get(k),k)

    config=ev.get("configuration",{})
    for k in ["primaryRouteId","fallbackRouteId","profileId"]:
        if not is_b32(config.get(k)): fail("configuration "+k)
    for k in ["primaryOperator","fallbackOperator","primaryVerifier","fallbackVerifier"]:
        if not is_addr(config.get(k)): fail("configuration "+k)
    for k in ["primaryRouteActive","fallbackRouteActive","profileActive"]:
        if config.get(k) is not True: fail("configuration inactive: "+k)
    for k in ["primaryRouteRevision","fallbackRouteRevision","profileRevision"]:
        if not isinstance(config.get(k),int) or config.get(k)<=0: fail("configuration revision: "+k)

    smoke=ev.get("smoke",{})
    for kind in ["primary","fallback","void"]:
        item=smoke.get(kind,{})
        if not is_b32(item.get("requestId")): fail(kind+" request id")
        receipt_ok(url,item.get("requestTx"),kind+" request")
    receipt_ok(url,smoke.get("primary",{}).get("fulfillTx"),"primary fulfill")
    receipt_ok(url,smoke.get("fallback",{}).get("activateFallbackTx"),"fallback activate")
    receipt_ok(url,smoke.get("fallback",{}).get("fulfillTx"),"fallback fulfill")
    receipt_ok(url,smoke.get("void",{}).get("voidTx"),"void")
    for k in ["resolved","usedPrimaryRoute","registryResultMatchesRouter"]:
        if smoke["primary"].get(k) is not True: fail("primary smoke "+k)
    for k in ["resolved","usedFallbackRoute","registryResultMatchesRouter"]:
        if smoke["fallback"].get(k) is not True: fail("fallback smoke "+k)
    for k in ["voidedAfterDeadline","noResultRecorded"]:
        if smoke["void"].get(k) is not True: fail("void smoke "+k)

    for k,v in ev.get("negativeAndFailurePaths",{}).items():
        if v is not True: fail("negative/failure path missing: "+k)

    idx=ev.get("indexer",{})
    for k in ["qualified","primaryRequestProjected","primaryResolvedProjected","fallbackActivatedProjected","fallbackResolvedProjected","voidedProjected","requestObjectKeysMatch","terminalStatesMatch","canonicalBlockProvenanceRetained"]:
        if idx.get(k) is not True: fail("indexer evidence "+k)
    if idx.get("chainId")!=chain or str(idx.get("genesisHash","")).lower()!=str(release.get("genesisHash","")).lower():
        fail("indexer chain identity")
    if str(idx.get("routerAddress","")).lower()!=router_addr.lower(): fail("indexer router identity")
    if idx.get("descriptor")!="420-indexer/descriptors/randomness-v1.json": fail("indexer descriptor")
    if not is_b32(idx.get("evidenceReportDigest")): fail("indexer evidence digest")

    out={
      "schema":"420-randomness-audit-5-live-testnet-evidence-v1",
      "phase":"RANDOM-AUDIT-5",
      "status":"PASS",
      "repositorySha":a.repositorySha,
      "manifestPath":a.manifest,
      "chainId":chain,
      "genesisHash":release["genesisHash"],
      "evidenceBlock":blockn,
      "evidenceBlockHash":release["evidenceBlockHash"],
      "deployments":deployments,
      "bindings":bindings,
      "registryPublication":publication,
      "configuration":config,
      "smoke":smoke,
      "negativeAndFailurePaths":ev["negativeAndFailurePaths"],
      "indexer":idx
    }
    pathlib.Path(a.output).write_text(json.dumps(out,indent=2)+"\n")
    print("RANDOM_AUDIT_5_LIVE_QUALIFICATION=PASS")

if __name__=="__main__":
    main()
