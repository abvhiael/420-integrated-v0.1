#!/usr/bin/env python3
"""Independent SWAP-AUDIT-6 verification of retained compiler/predeploy evidence."""
from __future__ import annotations
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "contracts/artifacts"
PRE = ROOT / "contracts/config/predeploy"
PLAN = PRE / "predeploy-plan.json"
STORAGE_INIT = PRE / "storage-init.json"
DEPLOYMENT = ROOT / "contracts/config/deployment-manifest.json"
NAMESPACE = ROOT / "contracts/config/genesis-address-namespace.json"

TIMELOCK = "0x0000000000000000000000000000000000000429"
REGISTRY = "0x0000000000000000000000000000000000000434"
EMPTY_ROOT = "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"

FROZEN = {
    "GenesisDEXFactory": ("contracts/src/swap/GenesisDEXFactory.sol", "0x000000000000000000000000000000000000042b"),
    "PublicBatchAuction": ("contracts/src/swap/PublicBatchAuction.sol", "0x000000000000000000000000000000000000042c"),
    "TWAPOracle": ("contracts/src/swap/TWAPOracle.sol", "0x000000000000000000000000000000000000042d"),
    "ApprovedQuoteAssetRegistry": ("contracts/src/swap/ApprovedQuoteAssetRegistry.sol", "0x0000000000000000000000000000000000000439"),
}
DEPLOYMENT_COMPONENTS = {
    **FROZEN,
    "CanonicalSwapExecutor420": ("contracts/src/swap/CanonicalSwapExecutor420.sol", None),
    "CanonicalConstantProductPool420": ("contracts/src/swap/CanonicalConstantProductPool420.sol", None),
}
errors=[]

def fail(msg): errors.append(msg)
def load(path):
    try: return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"{path.relative_to(ROOT)} unreadable: {exc}"); return {}
def blob(path):
    try:
        return subprocess.check_output(["git","hash-object",str(path.relative_to(ROOT))],cwd=ROOT,text=True).strip()
    except Exception as exc:
        fail(f"git hash-object failed for {path}: {exc}"); return ""

storage=load(STORAGE_INIT)
plan=load(PLAN)
deployment=load(DEPLOYMENT)
namespace=load(NAMESPACE)

if storage.get("governance_timelock","").lower()!=TIMELOCK: fail("governance timelock drift")
if storage.get("protocol_registry","").lower()!=REGISTRY: fail("ProtocolRegistry authority drift")
genesis_hash=storage.get("genesis_config_hash")
resolved=isinstance(genesis_hash,str) and genesis_hash.startswith("0x") and len(genesis_hash)==66
expected_ctor={"constructor":["governance_timelock","protocol_registry","genesis_config_hash"]}
for name in FROZEN:
    if storage.get("entries",{}).get(name)!=expected_ctor: fail(f"{name} storage-init constructor drift")

fixed=namespace.get("fixedAssignments",[])
for name,(source,address) in FROZEN.items():
    owners=[x for x in fixed if str(x.get("address","")).lower()==address]
    named=[x for x in fixed if x.get("name")==name]
    if len(owners)!=1 or owners[0].get("name")!=name or len(named)!=1 or named[0].get("address","").lower()!=address:
        fail(f"{name} frozen namespace authority drift")

for name,(source,address) in DEPLOYMENT_COMPONENTS.items():
    artifact=load(ARTIFACTS/f"{name}.json")
    if artifact.get("schema")!="420-swap-audit-6-compiler-artifact-v1": fail(f"{name} artifact schema drift")
    if artifact.get("status")!="SWAP_AUDIT_6_COMPILER_ARTIFACT_FROZEN": fail(f"{name} artifact status drift")
    if artifact.get("contractName")!=name: fail(f"{name} artifact contractName drift")
    if artifact.get("source")!=source: fail(f"{name} artifact source drift")
    if artifact.get("sourceBlobSha1")!=blob(ROOT/source): fail(f"{name} source provenance drift")
    compiler=artifact.get("compiler",{})
    expected={"solidity":"0.8.24","evmVersion":"cancun","optimizer":True,"optimizerRuns":200,"viaIR":True}
    for k,v in expected.items():
        if compiler.get(k)!=v: fail(f"{name} compiler provenance drift: {k}")
    runtime=artifact.get("deployedBytecodeTemplate")
    if not isinstance(runtime,str) or not runtime.startswith("0x") or len(runtime)<=2: fail(f"{name} runtime template missing")
    if not isinstance(artifact.get("storageLayout"),dict): fail(f"{name} storage layout missing")
    if address and artifact.get("canonicalAddress","").lower()!=address: fail(f"{name} canonical address drift")

for name,(source,address) in FROZEN.items():
    state=load(PRE/f"{name}-predeploy-state.json")
    if state.get("schema")!="420-swap-audit-6-predeploy-state-v1": fail(f"{name} state schema drift")
    if state.get("contractName")!=name or state.get("address","").lower()!=address: fail(f"{name} state identity drift")
    if state.get("sourceBlobSha1")!=blob(ROOT/source): fail(f"{name} state source provenance drift")
    if state.get("storage")!={} or state.get("storageSlotCount")!=0 or state.get("storageRoot")!=EMPTY_ROOT:
        fail(f"{name} mutable Genesis storage is not explicitly empty")
    ctor=state.get("constructorMaterialization",{})
    if ctor.get("governanceTimelock","").lower()!=TIMELOCK: fail(f"{name} timelock materialization drift")
    if ctor.get("protocolRegistry","").lower()!=REGISTRY: fail(f"{name} registry materialization drift")
    if ctor.get("genesisConfigHash")!=genesis_hash: fail(f"{name} genesis config commitment drift")

    plan_entries=[x for x in plan.get("predeploys",[]) if x.get("name")==name]
    dep_entries=[x for x in deployment.get("contracts",[]) if x.get("name")==name]
    if len(plan_entries)!=1: fail(f"{name} predeploy plan cardinality")
    if len(dep_entries)!=1: fail(f"{name} deployment manifest cardinality")
    if plan_entries:
        p=plan_entries[0]
        if p.get("address","").lower()!=address: fail(f"{name} predeploy plan address drift")
        if p.get("artifact")!=f"contracts/artifacts/{name}.json": fail(f"{name} artifact path drift")
        if p.get("predeploy_state")!=f"contracts/config/predeploy/{name}-predeploy-state.json": fail(f"{name} state path drift")
    if dep_entries:
        d=dep_entries[0]
        if d.get("address","").lower()!=address: fail(f"{name} deployment address drift")
        if d.get("runtime_artifact")!=f"contracts/artifacts/{name}.json": fail(f"{name} deployment artifact path drift")
        if d.get("predeploy_state")!=f"contracts/config/predeploy/{name}-predeploy-state.json": fail(f"{name} deployment state path drift")

    if resolved:
        if state.get("status")!="SWAP_AUDIT_6_FINAL_PREDEPLOY_STATE" or not state.get("runtimeMaterialized"):
            fail(f"{name} should be fully materialized")
        if not isinstance(state.get("runtimeCodeHash"),str) or len(state.get("runtimeCodeHash",""))!=66:
            fail(f"{name} final runtime hash missing")
        if plan_entries and plan_entries[0].get("status")!="ARTIFACT_READY": fail(f"{name} plan not ARTIFACT_READY")
        if dep_entries and dep_entries[0].get("artifact_status")!="SWAP_AUDIT_6_ARTIFACT_READY": fail(f"{name} deployment not artifact ready")
    else:
        if state.get("status")!="SWAP_AUDIT_6_BLOCKED_GLOBAL_GENESIS_CONFIG_HASH" or state.get("runtimeMaterialized") is not False:
            fail(f"{name} must fail closed while genesisConfigHash is unresolved")
        if not state.get("blocker"): fail(f"{name} missing explicit global blocker")
        if plan_entries and plan_entries[0].get("status")!="COMPILER_ARTIFACT_FROZEN": fail(f"{name} plan overclaims readiness")
        if plan_entries and "runtime_code_hash" in plan_entries[0]: fail(f"{name} plan claims final runtime hash while unresolved")
        if dep_entries and dep_entries[0].get("artifact_status")!="SWAP_AUDIT_6_COMPILER_ARTIFACT_FROZEN_GLOBAL_HASH_PENDING":
            fail(f"{name} deployment status overclaims readiness")
        if dep_entries and "runtime_code_hash" in dep_entries[0]: fail(f"{name} deployment claims final runtime hash while unresolved")

if errors:
    print("SWAP-AUDIT-6 verification FAILED",file=sys.stderr)
    for e in errors: print(" - "+e,file=sys.stderr)
    raise SystemExit(1)
print("SWAP-AUDIT-6 repository evidence PASS")
print("compilerArtifacts=6")
print("frozenPredeployStates=4")
print("globalGenesisConfigHash=" + ("RESOLVED" if resolved else "UNRESOLVED_BLOCKING_FINAL_MATERIALIZATION"))
