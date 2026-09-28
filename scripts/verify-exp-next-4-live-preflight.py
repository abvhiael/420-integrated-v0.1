#!/usr/bin/env python3
import json, os, pathlib, subprocess, sys, urllib.parse, urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"exp-next-4-live-evidence"
OUT.mkdir(exist_ok=True)

def fail(msg):
    print("ERROR:",msg,file=sys.stderr)
    raise SystemExit(1)

def env(name):
    v=os.environ.get(name,"").strip()
    if not v: fail(f"{name} is required")
    return v

def checked_url(name):
    raw=env(name)
    try: u=urllib.parse.urlparse(raw)
    except Exception as e: fail(f"{name} invalid URL: {e}")
    host=(u.hostname or "").lower()
    upper=raw.upper()
    if u.scheme!="https" or not host:
        fail(f"{name} must be a non-placeholder https URL")
    if any(x in upper for x in ("REPLACE","PLACEHOLDER")) or host.endswith(".example") or ".invalid" in host or host in ("localhost","127.0.0.1","::1"):
        fail(f"{name} is placeholder/non-production-equivalent")
    return raw.rstrip("/")

def get_json(url):
    req=urllib.request.Request(url,headers={"Accept":"application/json","User-Agent":"420Explorer-EXP-NEXT.4"})
    with urllib.request.urlopen(req,timeout=15) as r:
        if r.status<200 or r.status>=300: fail(f"GET {url} -> HTTP {r.status}")
        return json.load(r)

def rpc(url,method,params):
    body=json.dumps({"jsonrpc":"2.0","id":1,"method":method,"params":params}).encode()
    req=urllib.request.Request(url,data=body,headers={"Content-Type":"application/json","Accept":"application/json"},method="POST")
    with urllib.request.urlopen(req,timeout=15) as r:
        obj=json.load(r)
    if obj.get("error"): fail(f"{method} error: {obj['error']}")
    return obj.get("result")

release=env("EXP_NEXT_4_RELEASE_SHA")
head=subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip()
if head!=release: fail(f"checked out HEAD {head} != release candidate {release}")

explorer=checked_url("EXPLORER_LIVE_URL")
indexer=checked_url("INDEXER_LIVE_URL")
rpc_url=checked_url("CANONICAL_RPC_URL")
consensus_url=checked_url("CONSENSUS_WITNESS_URL")
recovery_url=checked_url("RECOVERY_EVIDENCE_URL")
manifest_url=checked_url("DEPLOYMENT_MANIFEST_URL")
expected_chain=int(os.environ.get("EXPECTED_CHAIN_ID","420"))
registry=env("PROTOCOL_REGISTRY_ADDRESS")
expected_code_hash=env("PROTOCOL_REGISTRY_CODE_HASH").lower()
if not (registry.startswith("0x") and len(registry)==42): fail("PROTOCOL_REGISTRY_ADDRESS must be 20-byte hex")
if not (expected_code_hash.startswith("0x") and len(expected_code_hash)==66): fail("PROTOCOL_REGISTRY_CODE_HASH must be 32-byte hex")

manifest=get_json(manifest_url)
if manifest.get("releaseCandidateSha")!=release: fail("deployment manifest releaseCandidateSha mismatch")
for key,want in (("explorerUrl",explorer),("indexerUrl",indexer),("canonicalRpcUrl",rpc_url)):
    if str(manifest.get(key,"")).rstrip("/")!=want: fail(f"deployment manifest {key} mismatch")
if manifest.get("productionEquivalent") is not True: fail("deployment manifest does not assert productionEquivalent=true")

chain_hex=rpc(rpc_url,"eth_chainId",[])
chain=int(chain_hex,16)
if chain!=expected_chain: fail(f"canonical RPC chain id {chain} != {expected_chain}")

explorer_health=get_json(explorer+"/v1/health")
indexer_health=get_json(indexer+"/v1/health")
status=get_json(explorer+"/v1/status")
if int(status.get("chainId",-1))!=expected_chain: fail("Explorer status chain mismatch")
if not status.get("ready",False): fail("Explorer status is not ready")
if status.get("wrongChain") or status.get("stale") or status.get("degraded") or status.get("consistent") is False:
    fail("Explorer status reports wrong-chain/stale/degraded/inconsistent state")

head_number=int(status.get("headHeight",-1))
if head_number<0: fail("Explorer status lacks headHeight")
block_view=get_json(explorer+f"/v1/blocks/{head_number}")
b=block_view.get("block",block_view)
indexed_hash=str(b.get("hash","")).lower()
canonical=rpc(rpc_url,"eth_getBlockByNumber",[hex(head_number),False])
if not canonical or str(canonical.get("hash","")).lower()!=indexed_hash:
    fail("canonical-vs-indexed head block hash mismatch")

code=rpc(rpc_url,"eth_getCode",[registry,"latest"])
if not code or code=="0x": fail("ProtocolRegistry has no runtime code")
proof=rpc(rpc_url,"eth_getProof",[registry,[],"latest"])
actual_code_hash=str((proof or {}).get("codeHash","")).lower()
if actual_code_hash!=expected_code_hash:
    fail(f"ProtocolRegistry code hash mismatch: {actual_code_hash} != {expected_code_hash}")

explorer_consensus=get_json(explorer+"/v1/consensus")
canonical_consensus=get_json(consensus_url)
es=int(explorer_consensus.get("currentSlot",-1))
cs=int(canonical_consensus.get("currentSlot",-1))
if es<0 or cs<0 or abs(es-cs)>1:
    fail(f"consensus witness divergence explorer={es} canonical={cs}")
if int(explorer_consensus.get("activeValidatorCount",0))<1:
    fail("Explorer consensus witness has no active validators")

recovery=get_json(recovery_url)
if recovery.get("releaseCandidateSha")!=release: fail("recovery evidence releaseCandidateSha mismatch")
required=["restart_resume","rpc_outage","stale_data","provider_unavailable","bounded_reorg","finalized_conflict","rebuild"]
scenarios=recovery.get("scenarios",{})
for name in required:
    row=scenarios.get(name,{})
    if row.get("status")!="success": fail(f"recovery scenario {name} not successful")
    if not row.get("evidence"): fail(f"recovery scenario {name} missing evidence")

report={
 "step":"EXP-NEXT.4",
 "releaseCandidateSha":release,
 "productionEquivalent":True,
 "chainId":chain,
 "endpoints":{"explorer":explorer,"indexer":indexer,"canonicalRpc":rpc_url,"consensusWitness":consensus_url},
 "witness":{"headHeight":head_number,"indexedBlockHash":indexed_hash,"registryAddress":registry,"registryCodeHash":actual_code_hash,"consensusSlotExplorer":es,"consensusSlotCanonical":cs},
 "recoveryScenarios":required,
 "status":"LIVE_PREFLIGHT_PASS"
}
(OUT/"live-preflight.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report,indent=2))
