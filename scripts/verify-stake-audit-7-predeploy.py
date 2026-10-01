#!/usr/bin/env python3
"""Fast structural verifier for STAKE-AUDIT-7 retained predeploy materialization."""

from __future__ import annotations
import json
import pathlib
import subprocess
import sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
CONTRACTS=ROOT/"contracts"
SUMMARY=CONTRACTS/"config/predeploy/Stake420-materialization.json"
CONFIG=CONTRACTS/"config/predeploy/stake-genesis-config-v1.json"
PLAN=CONTRACTS/"config/predeploy/predeploy-plan.json"
MANIFEST=CONTRACTS/"config/deployment-manifest.json"
STORAGE_INIT=CONTRACTS/"config/predeploy/storage-init.json"
ALLOC=ROOT/"config/genesis-allocations.json"

EXPECTED={
 "RewardController":("0x0000000000000000000000000000000000000420","contracts/src/system/RewardController.sol"),
 "ValidatorRegistry":("0x0000000000000000000000000000000000000423","contracts/src/system/ValidatorRegistry.sol"),
 "CommunityValidatorReserve":("0x0000000000000000000000000000000000000425","contracts/src/system/CommunityValidatorReserve.sol"),
 "Stake420":("0x000000000000000000000000000000000000043a","contracts/src/apps/Stake420.sol"),
}
EMPTY_ROOT="0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"

def fail(message):
    print("STAKE-AUDIT-7 verifier FAILED: "+message,file=sys.stderr)
    raise SystemExit(1)

def load(path):
    try:return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:fail(str(path.relative_to(ROOT))+": "+str(exc))

def run(*args):
    try:return subprocess.check_output(args,cwd=ROOT,text=True,stderr=subprocess.STDOUT).strip()
    except subprocess.CalledProcessError as exc:fail("command failed: "+" ".join(args)+"\n"+exc.output)

def blob(path):
    return run("git","hash-object",str(path.relative_to(ROOT)))

def keccak(value):
    return run("cast","keccak",value).lower()

def require_entry(items,name,kind):
    found=[x for x in items if x.get("name")==name]
    if len(found)!=1:fail(f"{kind} entry count for {name}: {len(found)}")
    return found[0]

def main():
    summary=load(SUMMARY)
    config=load(CONFIG)
    plan=load(PLAN)
    manifest=load(MANIFEST)
    storage_init=load(STORAGE_INIT)
    alloc=load(ALLOC)

    if summary.get("schema")!="420-stake-audit-7-materialization-v1" or summary.get("status")!="STAKE_AUDIT_7_OFFLINE_PREDEPLOY_READY":
        fail("materialization summary identity/status drift")
    if summary.get("liveDeploymentVerified") is not False or summary.get("next")!="STAKE-AUDIT-8":
        fail("materialization summary overclaims live readiness")
    if config.get("schema")!="420-stake-genesis-config-v1" or config.get("authority")!="offline_genesis_configuration_not_live_deployment_evidence":
        fail("Stake genesis config identity/authority drift")

    config_hash=keccak("0x"+json.dumps(config,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode().hex())
    if summary.get("stakeGenesisConfigHash")!=config_hash or storage_init.get("stake_genesis_config_hash")!=config_hash:
        fail("Stake genesis config hash drift")

    addresses=config.get("addresses",{})
    expected_address_keys={
      "RewardController":"rewardController","ValidatorRegistry":"validatorRegistry",
      "CommunityValidatorReserve":"communityValidatorReserve","Stake420":"stake420"
    }
    artifacts={}
    states={}
    for name,(address,source_rel) in EXPECTED.items():
        if str(addresses.get(expected_address_keys[name],"")).lower()!=address:
            fail(name+" frozen config address drift")
        artifact_path=CONTRACTS/("artifacts/"+name+".json")
        state_path=CONTRACTS/("config/predeploy/"+name+"-predeploy-state.json")
        artifact=load(artifact_path); state=load(state_path)
        artifacts[name]=artifact;states[name]=state
        if artifact.get("schema")!="420-stake-predeploy-artifact-v1" or artifact.get("status")!="STAKE_AUDIT_7_ARTIFACT_READY":
            fail(name+" artifact status/schema drift")
        if artifact.get("authority")!="offline_materialized_predeploy_not_live_deployment_evidence":
            fail(name+" artifact authority overclaim")
        if state.get("schema")!="420-stake-predeploy-state-v1" or state.get("status")!="STAKE_AUDIT_7_FINAL_PREDEPLOY_STATE":
            fail(name+" state status/schema drift")
        if state.get("address","").lower()!=address or artifact.get("canonicalAddress","").lower()!=address:
            fail(name+" canonical address drift")
        source=ROOT/source_rel
        current_blob=blob(source)
        if artifact.get("sourceBlobSha1")!=current_blob or state.get("sourceBlobSha1")!=current_blob:
            fail(name+" source provenance drift")
        runtime=artifact.get("deployedBytecode")
        if not isinstance(runtime,str) or not runtime.startswith("0x") or len(runtime)<=2:
            fail(name+" materialized runtime missing")
        runtime_hash=keccak(runtime)
        if artifact.get("runtimeCodeHash")!=runtime_hash or state.get("runtimeCodeHash")!=runtime_hash:
            fail(name+" runtime code hash drift")
        if artifact.get("runtimeCodeBytes")!=(len(runtime)-2)//2 or state.get("runtimeCodeBytes")!=(len(runtime)-2)//2:
            fail(name+" runtime byte count drift")
        template=artifact.get("compilerDeployedBytecodeTemplate")
        refs=artifact.get("immutableReferences",{})
        if not isinstance(template,str) or not isinstance(refs,dict):
            fail(name+" compiler runtime/immutable provenance missing")
        raw=bytes.fromhex(template[2:]); mat=bytes.fromhex(runtime[2:])
        if len(raw)!=len(mat):fail(name+" runtime/template length drift")
        allowed=set()
        for locations in refs.values():
            if not isinstance(locations,list):fail(name+" immutable refs malformed")
            for loc in locations:
                start,length=loc.get("start"),loc.get("length")
                if not isinstance(start,int) or not isinstance(length,int):fail(name+" immutable ref malformed")
                allowed.update(range(start,start+length))
        diff={i for i,(a,b) in enumerate(zip(raw,mat)) if a!=b}
        if not diff.issubset(allowed):fail(name+" runtime differs outside compiler immutable refs")
        if refs and not diff:fail(name+" declared immutables were not materialized")
        if not refs and diff:fail(name+" runtime drift with no immutable refs")
        summary_item=summary.get("contracts",{}).get(name,{})
        for key in ("runtimeCodeHash","storageRoot","storageSlotCount","sourceBlobSha1","genesisBalanceWei"):
            if summary_item.get(key)!=state.get(key):
                fail(name+" summary/state drift for "+key)

        p=require_entry(plan.get("predeploys",[]),name,"predeploy-plan")
        if p.get("status")!="ARTIFACT_READY" or p.get("artifact_status")!="STAKE_AUDIT_7_ARTIFACT_READY":
            fail(name+" predeploy plan readiness drift")
        for key,value in {
          "address":address,"artifact":"contracts/artifacts/"+name+".json",
          "predeploy_state":"contracts/config/predeploy/"+name+"-predeploy-state.json",
          "runtime_code_hash":runtime_hash,"source_blob_sha1":current_blob,
          "constructor_strategy":"DIRECT_GENESIS_RUNTIME_AND_STORAGE_MATERIALIZATION",
        }.items():
            if str(p.get(key)).lower()!=str(value).lower():fail(name+" predeploy plan drift: "+key)

        d=require_entry(manifest.get("contracts",[]),name,"deployment-manifest")
        for key,value in {
          "address":address,"deployment":"GENESIS_SYSTEM_ADDRESS",
          "runtime_artifact":"contracts/artifacts/"+name+".json",
          "predeploy_state":"contracts/config/predeploy/"+name+"-predeploy-state.json",
          "runtime_code_hash":runtime_hash,"source_blob_sha1":current_blob,
          "artifact_status":"STAKE_AUDIT_7_ARTIFACT_READY",
        }.items():
            if str(d.get(key)).lower()!=str(value).lower():fail(name+" deployment manifest drift: "+key)

    reward=states["RewardController"]
    registry=states["ValidatorRegistry"]
    reserve=states["CommunityValidatorReserve"]
    stake=states["Stake420"]
    caller=str(addresses.get("consensusSystemCall420","")).lower()
    reserve_addr=str(addresses.get("communityValidatorReserve","")).lower()
    registry_addr=str(addresses.get("validatorRegistry","")).lower()

    def packed_address_bool(value,bound=True):
        return "0x"+("00"*11)+("01" if bound else "00")+("00"*12)+value[2:]
    if reward.get("storage",{}).get("0x"+"00"*32)!=packed_address_bool(caller):
        fail("RewardController consensus caller/bound storage drift")
    if registry.get("storage",{}).get("0x"+"00"*32)!=packed_address_bool(caller):
        fail("ValidatorRegistry consensus caller/bound storage drift")
    slot7="0x"+(7).to_bytes(32,"big").hex()
    if registry.get("storage",{}).get(slot7)!=packed_address_bool(reserve_addr):
        fail("ValidatorRegistry reserve/bound storage drift")
    if reserve.get("storage",{}).get("0x"+"00"*32)!=packed_address_bool(registry_addr):
        fail("CommunityValidatorReserve registry/bound storage drift")
    if stake.get("storage")!={} or stake.get("storageRoot")!=EMPTY_ROOT:
        fail("Stake420 must have empty mutable genesis storage")

    if registry.get("genesisConfigHash")!=config_hash or registry.get("constructorArguments",{}).get("genesisConfigHash")!=config_hash:
        fail("ValidatorRegistry genesis config immutable drift")
    if stake.get("constructorArguments",{}).get("validatorRegistry","").lower()!=registry_addr or stake.get("constructorArguments",{}).get("rewardController","").lower()!=addresses.get("rewardController","").lower():
        fail("Stake420 immutable dependency binding drift")

    reserve_alloc=[x for x in alloc.get("allocations",[]) if str(x.get("destination","")).lower()==reserve_addr]
    if len(reserve_alloc)!=1 or str(reserve_alloc[0].get("amount_kief"))!="6300000000000000000000000":
        fail("canonical CommunityValidatorReserve allocation drift")
    if reserve.get("genesisBalanceWei")!="6300000000000000000000000":
        fail("CommunityValidatorReserve retained balance drift")
    if require_entry(manifest.get("contracts",[]),"CommunityValidatorReserve","deployment-manifest").get("genesis_balance_wei")!="6300000000000000000000000":
        fail("deployment manifest reserve balance drift")

    if plan.get("status")=="FROZEN_ADDRESS_MAP_ARTIFACTS_READY":
        fail("Audit7 must not promote global predeploy readiness while unrelated entries remain SOURCE_READY")

    print("STAKE-AUDIT-7 verifier PASS: four frozen Stake predeploys have reproducible runtime/state, exact bindings and manifest readiness without live-deployment overclaim")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
