#!/usr/bin/env python3
"""Generate/verify RANDOM-AUDIT-3 deterministic RandomnessRegistry Genesis materialization."""
import argparse, hashlib, json, pathlib, subprocess, sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
CONTRACT="RandomnessRegistry"
SOURCE_REL="contracts/src/randomness/RandomnessRegistry.sol"
SOURCE=ROOT/SOURCE_REL
RAW=ROOT/"contracts/out/RandomnessRegistry.sol/RandomnessRegistry.json"
ARTIFACT=ROOT/"contracts/artifacts/RandomnessRegistry.json"
STATE=ROOT/"contracts/config/predeploy/RandomnessRegistry-predeploy-state.json"
PLAN=ROOT/"contracts/config/predeploy/predeploy-plan.json"
MANIFEST=ROOT/"contracts/config/deployment-manifest.json"
STORAGE_INIT=ROOT/"contracts/config/predeploy/storage-init.json"
FOUNDRY=ROOT/"contracts/foundry.toml"
TOOLCHAIN=ROOT/"contracts/config/security/toolchain.json"
ADDRESS="0x0000000000000000000000000000000000000428"
TIMELOCK="0x0000000000000000000000000000000000000429"
EMPTY_ROOT="0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"

def fail(m): raise ValueError(m)
def run(*args,cwd=ROOT): return subprocess.check_output(args,cwd=cwd,text=True).strip()
def blob(p): return run("git","hash-object",str(p.relative_to(ROOT)))
def norm(v):
    if not isinstance(v,str) or not v.startswith("0x"): fail("expected 0x hex")
    h=v[2:]
    if len(h)%2 or any(c not in "0123456789abcdefABCDEF" for c in h): fail("invalid hex")
    return "0x"+h.lower()
def canonical(v): return json.dumps(v,indent=2,sort_keys=True)+"\n"
def cast_keccak(v):
    x=run("cast","keccak",v).lower()
    if len(x)!=66 or not x.startswith("0x"): fail("malformed keccak")
    return x

def validate_inputs(raw):
    cfg=FOUNDRY.read_text()
    for x in ['solc_version = "0.8.24"','evm_version = "cancun"',"optimizer = true","optimizer_runs = 200","via_ir = true"]:
        if x not in cfg: fail("foundry setting drift: "+x)
    tc=json.loads(TOOLCHAIN.read_text())
    expected={"solidity_version":"0.8.24","evm_version":"cancun","optimizer":True,"optimizer_runs":200}
    for k,v in expected.items():
        if tc.get(k)!=v: fail("toolchain drift "+k)
    md=raw.get("metadata")
    if isinstance(md,str): md=json.loads(md)
    if not isinstance(md,dict) or not str(md.get("compiler",{}).get("version","")).startswith("0.8.24"):
        fail("compiler metadata drift")
    si=json.loads(STORAGE_INIT.read_text())
    if si.get("schema")!="420-predeploy-storage-init-v2": fail("storage-init schema")
    if si.get("governance_timelock","").lower()!=TIMELOCK: fail("timelock drift")
    item=si.get("entries",{}).get(CONTRACT)
    if not isinstance(item,dict) or item.get("constructor")!=["governance_timelock"]:
        fail("RandomnessRegistry storage-init constructor drift")

def patch_runtime(raw):
    dep=raw.get("deployedBytecode")
    if not isinstance(dep,dict): fail("missing deployedBytecode")
    runtime=norm(dep.get("object"))
    refs=dep.get("immutableReferences")
    if not isinstance(refs,dict) or len(refs)!=1: fail("expected one immutable identifier")
    encoded=bytes.fromhex("00"*12+TIMELOCK[2:])
    code=bytearray.fromhex(runtime[2:]); patched=[]
    for iid,locs in refs.items():
        if not isinstance(locs,list) or not locs: fail("empty immutable refs")
        for loc in locs:
            start,length=loc.get("start"),loc.get("length")
            if not isinstance(start,int) or length!=32 or start<0 or start+length>len(code): fail("invalid immutable ref")
            original=bytes(code[start:start+length])
            code[start:start+length]=encoded
            patched.append({"immutableId":str(iid),"start":start,"length":length,"originalCompilerBytes":"0x"+original.hex(),"materializedValue":"0x"+encoded.hex()})
    return "0x"+code.hex(),refs,patched

def storage_layout(raw):
    layout=raw.get("storageLayout")
    if not isinstance(layout,dict):
        layout=json.loads(run("forge","inspect","src/randomness/RandomnessRegistry.sol:RandomnessRegistry","storage-layout","--json",cwd=ROOT/"contracts"))
    storage=layout.get("storage")
    if not isinstance(storage,list): fail("missing storage layout")
    roots={e.get("label"):e.get("slot") for e in storage if isinstance(e,dict)}
    if roots.get("randomnessRouter")!="0" or roots.get("_records")!="1":
        fail("RandomnessRegistry storage roots drift: %r"%roots)
    if "governanceTimelock" in roots: fail("immutable governance unexpectedly in storage")
    return layout,roots

def records(raw):
    validate_inputs(raw)
    runtime,refs,patched=patch_runtime(raw)
    layout,roots=storage_layout(raw)
    runtime_hash=cast_keccak(runtime)
    if cast_keccak("0x80")!=EMPTY_ROOT: fail("empty storage root mismatch")
    source_blob=blob(SOURCE)
    creation=raw.get("bytecode")
    creation_obj=norm(creation.get("object")) if isinstance(creation,dict) else fail("missing creation bytecode")
    compiler_template=norm(raw["deployedBytecode"]["object"])
    compiler_template_sha=hashlib.sha256(bytes.fromhex(compiler_template[2:])).hexdigest()
    artifact={
      "schema":"420-randomness-predeploy-artifact-v1",
      "status":"RANDOM_AUDIT_3_ARTIFACT_READY",
      "contractName":CONTRACT,
      "source":SOURCE_REL,
      "sourceBlobSha1":source_blob,
      "compiler":{"solidity":"0.8.24","evmVersion":"cancun","optimizer":True,"optimizerRuns":200,"viaIR":True,
                  "foundryConfigBlobSha1":blob(FOUNDRY),"toolchainConfigBlobSha1":blob(TOOLCHAIN)},
      "predeployAddress":ADDRESS,
      "constructor":{"arguments":{"timelock_":TIMELOCK},"strategy":"DIRECT_GENESIS_PREDEPLOY_IMMUTABLE_MATERIALIZATION","mutableStorageWrites":0},
      "abi":raw.get("abi",[]),
      "creationBytecode":creation_obj,
      "compilerDeployedBytecode":compiler_template,
      "compilerRuntimeTemplateSha256":compiler_template_sha,
      "immutableReferences":refs,
      "materializedImmutableReferences":patched,
      "deployedBytecode":runtime,
      "runtimeCodeBytes":(len(runtime)-2)//2,
      "runtimeCodeHash":runtime_hash,
      "storageLayout":layout
    }
    state={
      "schema":"420-randomness-predeploy-state-v1",
      "status":"RANDOM_AUDIT_3_FINAL_PREDEPLOY_STATE",
      "contractName":CONTRACT,"address":ADDRESS,"sourceBlobSha1":source_blob,
      "runtimeArtifact":"contracts/artifacts/RandomnessRegistry.json","runtimeCodeHash":runtime_hash,
      "constructorMaterialization":{"governanceTimelock":TIMELOCK,"immutableReferenceCount":len(patched),
        "method":"compiler-emitted immutableReferences patched with ABI-encoded constructor address"},
      "declaredStorageRoots":roots,"storage":{},"storageSlotCount":0,"storageRoot":EMPTY_ROOT,
      "storageRootBasis":"Ethereum empty Merkle-Patricia storage trie root = keccak256(0x80)",
      "invariants":[
        "genesis alloc.code uses materialized deployed runtime bytecode, never creation bytecode",
        "governanceTimelock is embedded as a Solidity immutable and is not written to storage",
        "RandomnessRegistry constructor performs no mutable storage writes",
        "randomnessRouter begins address(0) and must be bound exactly once only after qualified router deployment",
        "_records begins empty",
        "runtimeCodeHash equals keccak256(materialized deployed runtime bytecode)"
      ],
      "limitations":[
        "This is deterministic offline Genesis materialization, not live-chain deployment evidence.",
        "RANDOM-AUDIT-4 retains deployment/binding instructions; RANDOM-AUDIT-5 retains production-equivalent testnet evidence."
      ]
    }
    return artifact,state

def update_authorities(artifact,state):
    plan=json.loads(PLAN.read_text())
    ps=[e for e in plan.get("predeploys",[]) if e.get("name")==CONTRACT]
    if len(ps)!=1: fail("predeploy plan RandomnessRegistry multiplicity")
    p=ps[0]
    if p.get("address","").lower()!=ADDRESS or p.get("source")!="randomness/RandomnessRegistry.sol": fail("predeploy identity drift")
    p.update({
      "artifact":"contracts/artifacts/RandomnessRegistry.json",
      "constructor_strategy":"DIRECT_GENESIS_IMMUTABLE_MATERIALIZATION",
      "status":"RANDOM_AUDIT_3_ARTIFACT_READY",
      "source_blob_sha1":artifact["sourceBlobSha1"],
      "runtime_code_hash":artifact["runtimeCodeHash"],
      "compiler_runtime_template_sha256":artifact["compilerRuntimeTemplateSha256"],
      "predeploy_state":"contracts/config/predeploy/RandomnessRegistry-predeploy-state.json",
      "notes":"RANDOM-AUDIT-3: canonical generalized 420Random registry; governanceTimelock immutable materialized to 0x0429 from compiler-reported references; constructor has no mutable storage writes; randomnessRouter begins zero and _records empty. Live deployment/binding remains later audit work."
    })
    manifest=json.loads(MANIFEST.read_text())
    ms=[e for e in manifest.get("contracts",[]) if e.get("name")==CONTRACT]
    if len(ms)!=1: fail("deployment manifest RandomnessRegistry multiplicity")
    ms[0].update({
      "artifact_status":"RANDOM_AUDIT_3_ARTIFACT_READY",
      "runtime_artifact":"contracts/artifacts/RandomnessRegistry.json",
      "predeploy_state":"contracts/config/predeploy/RandomnessRegistry-predeploy-state.json",
      "runtime_code_hash":artifact["runtimeCodeHash"],
      "source_blob_sha1":artifact["sourceBlobSha1"]
    })
    return plan,manifest

def main(argv=None):
    ap=argparse.ArgumentParser(); ap.add_argument("--write",action="store_true"); ap.add_argument("--check",action="store_true"); ap.add_argument("--print",action="store_true",dest="printout"); args=ap.parse_args(argv)
    if not RAW.is_file():
        print("RANDOM-AUDIT-3 blocked: build RandomnessRegistry first",file=sys.stderr); return 2
    try:
        raw=json.loads(RAW.read_text()); artifact,state=records(raw); plan,manifest=update_authorities(artifact,state)
        outputs={ARTIFACT:canonical(artifact),STATE:canonical(state),PLAN:canonical(plan),MANIFEST:canonical(manifest)}
        if args.write:
            for p,v in outputs.items(): p.parent.mkdir(parents=True,exist_ok=True); p.write_text(v)
        if args.check:
            for p,v in outputs.items():
                if not p.is_file(): fail("missing committed "+str(p.relative_to(ROOT)))
                if p.read_text()!=v: fail("stale/non-reproducible "+str(p.relative_to(ROOT)))
        if args.printout:
            print("runtimeCodeHash="+artifact["runtimeCodeHash"]); print("sourceBlobSha1="+artifact["sourceBlobSha1"])
            print("compilerRuntimeTemplateSha256="+artifact["compilerRuntimeTemplateSha256"]); print("immutableReferenceCount="+str(len(artifact["materializedImmutableReferences"])))
            print("storageRoot="+state["storageRoot"])
        print("RANDOM_AUDIT_3_MATERIALIZATION=PASS"); return 0
    except (OSError,ValueError,KeyError,subprocess.CalledProcessError,json.JSONDecodeError) as e:
        print("RANDOM-AUDIT-3 blocked: "+str(e),file=sys.stderr); return 2
if __name__=="__main__": sys.exit(main())
