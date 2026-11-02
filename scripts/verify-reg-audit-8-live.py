#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, os, pathlib, subprocess, sys, urllib.parse, urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"reg-audit-8-live-evidence"; OUT.mkdir(exist_ok=True)
REGISTRY="0x0000000000000000000000000000000000000434"
GOV="0x0000000000000000000000000000000000000429"
CODE_HASH="0x9f9e5f794296cf9faf5f8c8d17cd815f3c19c004a158c15cb61b5a29eaacb330"
SOURCE_BLOB="9ab3d53a68b6533978f41e0202e5268f1d615c19"
EMPTY_STORAGE="0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
TOPIC_VERSION="0x19aa152c2c4c6794d89883e0808ea2365e3f6d5267840423debc9b08db5b3608"
TOPIC_PROFILE="0x19af5a8b78ed7364ffacb8ddf22ac42f4bb67c6d9532cb2b7504781867c550d9"
TOPIC_DEPRECATED="0x63e20a29800a0d1cec5ae14b6dfceb2bc5cbfd523b7225bc649d3819c0f8780a"

def fail(msg):
    print("ERROR:",msg,file=sys.stderr); raise SystemExit(1)
def env(name):
    v=os.environ.get(name,"").strip()
    if not v: fail(name+" is required")
    return v
def checked_url(raw,label):
    try: u=urllib.parse.urlparse(raw)
    except Exception as e: fail(f"{label} invalid URL: {e}")
    host=(u.hostname or "").lower(); up=raw.upper()
    if u.scheme!="https" or not host: fail(label+" must be https")
    if any(x in up for x in ("REPLACE","PLACEHOLDER")) or host.endswith(".example") or ".invalid" in host or host in ("localhost","127.0.0.1","::1"):
        fail(label+" is placeholder/non-production-equivalent")
    return raw.rstrip("/")
def get_json(url):
    req=urllib.request.Request(url,headers={"Accept":"application/json","User-Agent":"420Registry-REG-AUDIT-8"})
    with urllib.request.urlopen(req,timeout=20) as r:
        if r.status<200 or r.status>=300: fail(f"GET {url} -> HTTP {r.status}")
        return json.load(r)
def rpc(url,method,params):
    body=json.dumps({"jsonrpc":"2.0","id":1,"method":method,"params":params}).encode()
    req=urllib.request.Request(url,data=body,headers={"Content-Type":"application/json","Accept":"application/json"},method="POST")
    with urllib.request.urlopen(req,timeout=20) as r: obj=json.load(r)
    if obj.get("error"): fail(f"{method} error: {obj['error']}")
    return obj.get("result")
def hex32(v,label,allow_zero=False):
    if not isinstance(v,str) or not v.startswith("0x") or len(v)!=66: fail(label+" must be bytes32")
    if not allow_zero and int(v,16)==0: fail(label+" must be nonzero")
def receipt(rpc_url,tx,label):
    if not isinstance(tx,str) or not tx.startswith("0x") or len(tx)!=66: fail(label+" transaction hash invalid")
    rec=rpc(rpc_url,"eth_getTransactionReceipt",[tx])
    if not rec or int(rec.get("status","0x0"),16)!=1: fail(label+" transaction not successful")
    return rec
def has_topics(rec,required):
    seen=set()
    for log in rec.get("logs",[]):
        if str(log.get("address","")).lower()!=REGISTRY: continue
        topics=log.get("topics",[])
        if topics: seen.add(str(topics[0]).lower())
    return required.issubset(seen)

release=env("REG_AUDIT_8_RELEASE_SHA")
head=subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip()
if head!=release: fail(f"checked out HEAD {head} != release candidate {release}")
rpc_url=checked_url(env("REG_AUDIT_8_RPC_URL"),"REG_AUDIT_8_RPC_URL")
evidence_url=checked_url(env("REG_AUDIT_8_EVIDENCE_URL"),"REG_AUDIT_8_EVIDENCE_URL")
e=get_json(evidence_url)
if e.get("schema")!="420-registry-reg-audit-8-live-evidence-v1": fail("unexpected evidence schema")
if e.get("status")!="LIVE_EVIDENCE_COMPLETE": fail("evidence status is not LIVE_EVIDENCE_COMPLETE")
if e.get("releaseCandidateSha")!=release: fail("release candidate SHA mismatch")
if e.get("environment")!="testnet" or e.get("chainId")!=420: fail("testnet chain identity mismatch")

reg=e.get("registry",{})
for k,w in (("address",REGISTRY),("sourceBlobSha1",SOURCE_BLOB),("runtimeCodeHash",CODE_HASH),("governanceTimelock",GOV),("deploymentMode","GENESIS_PREDEPLOY")):
    if str(reg.get(k,"")).lower()!=w.lower(): fail("Registry evidence mismatch: "+k)

claim=e.get("evidenceSha256","")
obj=dict(e); obj.pop("evidenceSha256",None)
digest=hashlib.sha256(json.dumps(obj,sort_keys=True,separators=(",",":")).encode()).hexdigest()
if claim!=digest: fail("evidenceSha256 mismatch")

if int(rpc(rpc_url,"eth_chainId",[]),16)!=420: fail("canonical RPC is not chain 420")
genesis=rpc(rpc_url,"eth_getBlockByNumber",["0x0",False])
if not genesis or str(genesis.get("hash","")).lower()!=str(e.get("deploymentProof",{}).get("genesisBlockHash","")).lower(): fail("genesis block proof mismatch")
if rpc(rpc_url,"eth_getCode",[REGISTRY,"0x0"]) in (None,"0x"): fail("Registry missing from genesis state")
proof0=rpc(rpc_url,"eth_getProof",[REGISTRY,[],"0x0"]) or {}
if str(proof0.get("codeHash","")).lower()!=CODE_HASH: fail("genesis Registry code hash mismatch")
if str(proof0.get("storageHash","")).lower()!=EMPTY_STORAGE: fail("genesis Registry storage root mismatch")
latest=rpc(rpc_url,"eth_getProof",[REGISTRY,[],"latest"]) or {}
if str(latest.get("codeHash","")).lower()!=CODE_HASH: fail("latest Registry code hash mismatch")

required_reads={"governanceTimelock","systemName","protocolVersion","currentVersionAfterPublication","registrationProfileAfterPublication","historicalVersionAfterDeprecation","currentInactiveAfterDeprecation"}
seen=set()
for row in e.get("readAssertions",[]):
    name=row.get("name")
    if name not in required_reads: continue
    data=row.get("callData"); want=str(row.get("expectedResult","")).lower()
    if str(row.get("to","")).lower()!=REGISTRY or not isinstance(data,str) or not data.startswith("0x") or "REPLACE" in data.upper(): fail("invalid read assertion "+str(name))
    got=str(rpc(rpc_url,"eth_call",[{"to":REGISTRY,"data":data},"latest"]) or "").lower()
    if got!=want: fail(f"read assertion {name} mismatch")
    seen.add(name)
if seen!=required_reads: fail("missing required smoke/history read assertions")

pub=e.get("strictPublication",{})
for key in ("serviceId","metadataHash","manifestHash","dependencyRoot","interfaceHash"): hex32(pub.get(key),"strictPublication."+key,allow_zero=(key=="dependencyRoot"))
if not isinstance(pub.get("implementation"),str) or len(pub["implementation"])!=42: fail("strictPublication.implementation invalid")
if int(pub.get("version",0))<1: fail("strictPublication.version invalid")
pubrec=receipt(rpc_url,pub.get("transactionHash"),"strict publication")
if not has_topics(pubrec,{TOPIC_VERSION,TOPIC_PROFILE}): fail("strict publication receipt lacks required Registry events")

dep=e.get("deprecation",{})
if str(dep.get("serviceId","")).lower()!=str(pub.get("serviceId","")).lower() or dep.get("version")!=pub.get("version"): fail("deprecation target mismatch")
deprec=receipt(rpc_url,dep.get("transactionHash"),"deprecation")
if not has_topics(deprec,{TOPIC_DEPRECATED}): fail("deprecation receipt lacks ServiceDeprecated")

derived=e.get("derivedConsumers",{})
indexer=checked_url(derived.get("indexerUrl",""),"derivedConsumers.indexerUrl")
explorer=checked_url(derived.get("explorerUrl",""),"derivedConsumers.explorerUrl")
recovery_url=checked_url(derived.get("recoveryEvidenceUrl",""),"derivedConsumers.recoveryEvidenceUrl")
idxh=get_json(indexer+"/v1/health"); exph=get_json(explorer+"/v1/health")
if idxh.get("canonicalAuthority") is True or exph.get("canonicalAuthority") is True: fail("derived consumer improperly claims canonical authority")
recovery=get_json(recovery_url)
if recovery.get("releaseCandidateSha")!=release: fail("recovery evidence releaseCandidateSha mismatch")
for name in ("restart_resume","rpc_outage","provider_unavailable","bounded_reorg","finalized_conflict","rebuild"):
    row=recovery.get("scenarios",{}).get(name,{})
    if row.get("status")!="success" or not row.get("evidence"): fail("recovery scenario incomplete: "+name)

report={"step":"REG-AUDIT-8","releaseCandidateSha":release,"chainId":420,"environment":"testnet","registryAddress":REGISTRY,"runtimeCodeHash":CODE_HASH,"evidenceSha256":digest,"status":"LIVE_QUALIFICATION_PASS"}
(OUT/"live-verification.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report,indent=2))
