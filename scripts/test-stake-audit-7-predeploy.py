#!/usr/bin/env python3
"""Focused negative/adversarial fixtures for STAKE-AUDIT-7 materialization records.

These tests deliberately mutate retained evidence in memory. They do not edit repository files.
"""
from __future__ import annotations
import copy
import json
import pathlib
import sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
NAMES=("RewardController","ValidatorRegistry","CommunityValidatorReserve","Stake420")
CALLER="0x000000000000000000000000000000000000043c"
REGISTRY="0x0000000000000000000000000000000000000423"
RESERVE="0x0000000000000000000000000000000000000425"
CONFIG_HASH="0x7721fafee1f582e819e15ca57ce557bb0b473c584a49759e5d2511f882ff5eac"
EMPTY_ROOT="0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
RESERVE_BALANCE="6300000000000000000000000"

def load(path):
    return json.loads((ROOT/path).read_text(encoding="utf-8"))

def bundle():
    return {
      "summary":load("contracts/config/predeploy/Stake420-materialization.json"),
      "manifest":load("contracts/config/deployment-manifest.json"),
      "states":{n:load(f"contracts/config/predeploy/{n}-predeploy-state.json") for n in NAMES},
      "artifacts":{n:load(f"contracts/artifacts/{n}.json") for n in NAMES},
    }

def packed(address):
    return "0x"+("00"*11)+"01"+address[2:]

def by_name(items,name):
    matches=[x for x in items if x.get("name")==name]
    return matches[0] if len(matches)==1 else None

def validate(b):
    errors=[]
    summary=b["summary"]; states=b["states"]; artifacts=b["artifacts"]; manifest=b["manifest"]
    if summary.get("liveDeploymentVerified") is not False:
        errors.append("live readiness overclaim")
    if summary.get("stakeGenesisConfigHash")!=CONFIG_HASH:
        errors.append("config hash drift")
    rc=states["RewardController"]; vr=states["ValidatorRegistry"]; reserve=states["CommunityValidatorReserve"]; stake=states["Stake420"]
    zero="0x"+"00"*32; slot7="0x"+(7).to_bytes(32,"big").hex()
    if rc.get("storage",{}).get(zero)!=packed(CALLER): errors.append("reward caller binding")
    if vr.get("storage",{}).get(zero)!=packed(CALLER): errors.append("validator caller binding")
    if vr.get("storage",{}).get(slot7)!=packed(RESERVE): errors.append("validator reserve binding")
    if vr.get("genesisConfigHash")!=CONFIG_HASH: errors.append("validator config hash")
    if reserve.get("storage",{}).get(zero)!=packed(REGISTRY): errors.append("reserve registry binding")
    if str(reserve.get("genesisBalanceWei"))!=RESERVE_BALANCE: errors.append("reserve balance")
    if stake.get("storage")!={} or stake.get("storageRoot")!=EMPTY_ROOT: errors.append("stake mutable state")
    for name in NAMES:
        art=artifacts[name]; state=states[name]
        if art.get("runtimeCodeHash")!=state.get("runtimeCodeHash"): errors.append(name+" artifact/state runtime mismatch")
        d=by_name(manifest.get("contracts",[]),name)
        if not d or d.get("runtime_code_hash")!=state.get("runtimeCodeHash"): errors.append(name+" manifest runtime mismatch")
        if art.get("authority")!="offline_materialized_predeploy_not_live_deployment_evidence": errors.append(name+" authority overclaim")
    return errors

def expect(mutator,needle):
    b=copy.deepcopy(bundle()); mutator(b); errors=validate(b)
    if not any(needle in e for e in errors):
        raise AssertionError(f"expected {needle!r}; got {errors!r}")

base=bundle()
if validate(base):
    raise AssertionError("untampered Audit7 fixture must pass: "+repr(validate(base)))

expect(lambda b:b["summary"].__setitem__("liveDeploymentVerified",True),"live readiness overclaim")
expect(lambda b:b["states"]["RewardController"]["storage"].__setitem__("0x"+"00"*32,packed(REGISTRY)),"reward caller binding")
expect(lambda b:b["states"]["ValidatorRegistry"].__setitem__("genesisConfigHash","0x"+"00"*32),"validator config hash")
expect(lambda b:b["states"]["ValidatorRegistry"]["storage"].__setitem__("0x"+(7).to_bytes(32,"big").hex(),packed(REGISTRY)),"validator reserve binding")
expect(lambda b:b["states"]["CommunityValidatorReserve"].__setitem__("genesisBalanceWei","0"),"reserve balance")
expect(lambda b:b["states"]["CommunityValidatorReserve"]["storage"].__setitem__("0x"+"00"*32,packed(CALLER)),"reserve registry binding")
expect(lambda b:b["states"]["Stake420"].__setitem__("storage",{"0x"+"00"*32:"0x"+"01".rjust(64,"0")}),"stake mutable state")
expect(lambda b:b["artifacts"]["Stake420"].__setitem__("runtimeCodeHash","0x"+"00"*32),"Stake420 artifact/state runtime mismatch")
expect(lambda b:by_name(b["manifest"]["contracts"],"ValidatorRegistry").__setitem__("runtime_code_hash","0x"+"00"*32),"ValidatorRegistry manifest runtime mismatch")
expect(lambda b:b["artifacts"]["RewardController"].__setitem__("authority","LIVE_DEPLOYED"),"RewardController authority overclaim")

print("STAKE-AUDIT-7 negative/adversarial fixture tests PASS")
