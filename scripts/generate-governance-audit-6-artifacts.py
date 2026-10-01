#!/usr/bin/env python3
"""Generate/check GOV-AUDIT-6 reproducible Governance runtime artifacts and fixed-predeploy state."""
import argparse, hashlib, json, pathlib, subprocess, sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"contracts/out"
ART=ROOT/"contracts/artifacts"
PRE=ROOT/"contracts/config/predeploy"
CFG=ROOT/"contracts/config/governance-deployment-v1.json"
PLAN=PRE/"predeploy-plan.json"
DEPLOY=ROOT/"contracts/config/deployment-manifest.json"
FOUNDRY=ROOT/"contracts/foundry.toml"
TOOLCHAIN=ROOT/"contracts/config/security/toolchain.json"

TIMELOCK="0x0000000000000000000000000000000000000429"
GOV420="0x0000000000000000000000000000000000000437"

CONTRACTS=[
 ("GovernanceTimelock","governance/GovernanceTimelock.sol",GOV420),
 ("Governance420","governance/Governance420.sol",TIMELOCK),
 ("CivicConstitution420","governance/CivicConstitution420.sol",TIMELOCK),
 ("CivicProposalRegistry420","governance/CivicProposalRegistry420.sol",TIMELOCK),
 ("CivicElectorateRegistry420","governance/CivicElectorateRegistry420.sol",TIMELOCK),
 ("CivicVoting420","governance/CivicVoting420.sol",None),
 ("CivicGovernor420","governance/CivicGovernor420.sol",None),
 ("CivicMerkleElectorateSource420","governance/CivicMerkleElectorateSource420.sol",TIMELOCK),
]

def run(*args,cwd=ROOT): return subprocess.check_output(args,cwd=cwd,text=True).strip()
def fail(msg): raise ValueError(msg)
def gitsha(p): return run("git","hash-object",str(p.relative_to(ROOT)))
def keccak(h): return run("cast","keccak",h).lower()
def canon(o): return json.dumps(o,indent=2,sort_keys=True)+"\n"

def foundry_artifact(name):
 p=OUT/f"{name}.sol"/f"{name}.json"
 if not p.is_file(): fail(f"missing Foundry artifact {p.relative_to(ROOT)}")
 return json.loads(p.read_text())

def patch_runtime(raw, immutable_value):
 d=raw.get("deployedBytecode",{})
 obj=d.get("object")
 if not isinstance(obj,str): fail("missing deployed bytecode")
 if not obj.startswith("0x"): obj="0x"+obj
 refs=d.get("immutableReferences") or {}
 code=bytearray.fromhex(obj[2:])
 patched=[]
 if immutable_value is None:
  if refs: fail("unexpected constructor-dependent immutable references")
 else:
  if not refs: fail("expected immutable references")
  encoded=bytes.fromhex("00"*12+immutable_value[2:])
  for iid,locs in refs.items():
   for loc in locs:
    start,length=loc["start"],loc["length"]
    if length!=32: fail("unexpected immutable width")
    code[start:start+length]=encoded
    patched.append({"immutableId":str(iid),"start":start,"length":length,"value":immutable_value})
 return "0x"+code.hex(),refs,patched

def artifact_record(name,source,immutable_value):
 raw=foundry_artifact(name)
 runtime,refs,patched=patch_runtime(raw,immutable_value)
 source_path=ROOT/"contracts/src"/source
 metadata=raw.get("metadata")
 if isinstance(metadata,str): metadata=json.loads(metadata)
 compiler=str((metadata or {}).get("compiler",{}).get("version",""))
 if not compiler.startswith("0.8.24"): fail(name+" compiler drift")
 layout=raw.get("storageLayout",{})
 if not isinstance(layout.get("storage"),list): fail(name+" missing storage layout")
 rec={
  "schema":"420-governance-runtime-artifact-v1",
  "status":"GOV_AUDIT_6_RUNTIME_ARTIFACT",
  "contractName":name,
  "source":f"contracts/src/{source}",
  "sourceBlobSha1":gitsha(source_path),
  "compiler":{"solidity":"0.8.24","evmVersion":"cancun","optimizer":True,"optimizerRuns":200,"viaIR":True,
              "foundryConfigBlobSha1":gitsha(FOUNDRY),"toolchainConfigBlobSha1":gitsha(TOOLCHAIN)},
  "constructorIndependentRuntime": immutable_value is None,
  "materializedImmutableValue": immutable_value,
  "immutableReferences":refs,
  "materializedImmutableReferences":patched,
  "deployedBytecode":runtime,
  "runtimeCodeHash":keccak(runtime),
  "runtimeCodeBytes":len(runtime[2:])//2,
  "abi":raw.get("abi",[]),
  "storageLayout":layout,
 }
 return rec

def timelock_state(rec):
 storage=rec["storageLayout"]["storage"]
 scheduler=next((x for x in storage if x.get("label")=="scheduler"),None)
 active=next((x for x in storage if x.get("label")=="civicAuthorityActivated"),None)
 if not scheduler or not active: fail("GovernanceTimelock storage layout missing scheduler/activation")
 if scheduler["slot"]!=active["slot"]: fail("unexpected Timelock packing")
 word=int(GOV420,16) << (8*int(scheduler["offset"]))
 # bool is false, so no active bit set
 slot="0x"+int(scheduler["slot"]).to_bytes(32,"big").hex()
 val="0x"+word.to_bytes(32,"big").hex()
 return {
  "schema":"420-governance-timelock-predeploy-state-v1","status":"GOV_AUDIT_6_PREDEPLOY_READY",
  "contractName":"GovernanceTimelock","address":TIMELOCK,
  "runtimeArtifact":"contracts/artifacts/GovernanceTimelock.json","runtimeCodeHash":rec["runtimeCodeHash"],
  "constructorMaterialization":{"bootstrapGovernor":GOV420,"scheduler":GOV420,"civicAuthorityActivated":False},
  "storage":{slot:val},"storageSlotCount":1,
  "invariants":["bootstrapGovernor immutable is Governance420@0x0437","scheduler begins as Governance420@0x0437",
                "civicAuthorityActivated begins false","runtimeCodeHash equals keccak256(materialized deployed bytecode)"]
 }

def governance_state(rec):
 return {
  "schema":"420-governance420-predeploy-state-v1","status":"GOV_AUDIT_6_PREDEPLOY_READY",
  "contractName":"Governance420","address":GOV420,
  "runtimeArtifact":"contracts/artifacts/Governance420.json","runtimeCodeHash":rec["runtimeCodeHash"],
  "constructorMaterialization":{"governanceTimelock":TIMELOCK},
  "storage":{},"storageSlotCount":0,
  "invariants":["all compatibility/bootstrap mutable state begins zero/false",
                "governanceTimelock immutable is 0x0429",
                "runtimeCodeHash equals keccak256(materialized deployed bytecode)"]
 }

def update_manifest(records):
 cfg=json.loads(CFG.read_text())
 cfg["status"]="READY_FOR_REPRODUCIBLE_DEPLOYMENT"
 cfg["runtimeArtifacts"]={n:{
   "path":f"contracts/artifacts/{n}.json","runtimeCodeHash":records[n]["runtimeCodeHash"],
   "sourceBlobSha1":records[n]["sourceBlobSha1"]
 } for n,_,_ in CONTRACTS}
 cfg["fixedPredeployState"]={
  "GovernanceTimelock":"contracts/config/predeploy/GovernanceTimelock-predeploy-state.json",
  "Governance420":"contracts/config/predeploy/Governance420-predeploy-state.json"
 }
 return cfg

def update_plan(plan,records):
 for e in plan.get("predeploys",[]):
  n=e.get("name")
  if n in ("GovernanceTimelock","Governance420"):
   e["status"]="ARTIFACT_READY"
   e["constructor_strategy"]="DIRECT_GENESIS_IMMUTABLE_AND_STORAGE_MATERIALIZATION"
   e["runtime_code_hash"]=records[n]["runtimeCodeHash"]
   e["source_blob_sha1"]=records[n]["sourceBlobSha1"]
   e["predeploy_state"]=f"contracts/config/predeploy/{n}-predeploy-state.json"
   e["notes"]="GOV-AUDIT-6 exact runtime and constructor state materialized from pinned compiler outputs."
 return plan

def update_deploy(manifest,records):
 for e in manifest.get("contracts",[]):
  n=e.get("name")
  if n in ("GovernanceTimelock","Governance420"):
   e["runtime_artifact"]=f"contracts/artifacts/{n}.json"
   e["runtime_code_hash"]=records[n]["runtimeCodeHash"]
   e["predeploy_state"]=f"contracts/config/predeploy/{n}-predeploy-state.json"
   e["source_blob_sha1"]=records[n]["sourceBlobSha1"]
   e["artifact_status"]="GOV_AUDIT_6_ARTIFACT_READY"
 return manifest

def main(argv=None):
 ap=argparse.ArgumentParser(); ap.add_argument("--write",action="store_true"); ap.add_argument("--check",action="store_true"); ap.add_argument("--print",action="store_true",dest="show")
 args=ap.parse_args(argv)
 try:
  records={n:artifact_record(n,s,i) for n,s,i in CONTRACTS}
  outputs={ART/f"{n}.json":canon(records[n]) for n,_,_ in CONTRACTS}
  outputs[PRE/"GovernanceTimelock-predeploy-state.json"]=canon(timelock_state(records["GovernanceTimelock"]))
  outputs[PRE/"Governance420-predeploy-state.json"]=canon(governance_state(records["Governance420"]))
  outputs[CFG]=json.dumps(update_manifest(records),indent=2)+"\n"
  outputs[PLAN]=json.dumps(update_plan(json.loads(PLAN.read_text()),records),indent=2)+"\n"
  outputs[DEPLOY]=json.dumps(update_deploy(json.loads(DEPLOY.read_text()),records),indent=2)+"\n"
  if args.write:
   for p,t in outputs.items(): p.parent.mkdir(parents=True,exist_ok=True); p.write_text(t)
  if args.check:
   for p,t in outputs.items():
    if not p.is_file() or p.read_text()!=t: fail("artifact/config drift: "+str(p.relative_to(ROOT)))
  if args.show:
   for n,_,_ in CONTRACTS: print(n,records[n]["runtimeCodeHash"])
  print("GOV_AUDIT_6_ARTIFACTS=PASS")
  return 0
 except Exception as exc:
  print("GOV-AUDIT-6 artifact generation blocked: "+str(exc),file=sys.stderr); return 2
if __name__=="__main__": raise SystemExit(main())
