#!/usr/bin/env python3
"""Fail-closed runtime test evidence for CI-SOL-02. Run inside contracts/."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess

def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def run_json(command, log):
    proc=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    Path(log).write_text(proc.stdout+"\n--- stderr ---\n"+proc.stderr)
    if proc.returncode:
        raise RuntimeError("Failed command (see diagnostics): "+" ".join(command))
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Foundry did not return JSON: "+" ".join(command)) from exc

def flatten_list(doc):
    """Foundry --list --json: source path => contract name => test signatures."""
    if not isinstance(doc,dict):
        raise ValueError("Malformed Foundry discovery")
    inventory=set()
    for path,contracts in doc.items():
        if not isinstance(path,str) or not isinstance(contracts,dict):
            raise ValueError("Malformed Foundry discovery file")
        for contract,names in contracts.items():
            if not isinstance(contract,str) or not isinstance(names,(dict,list)):
                raise ValueError("Malformed Foundry discovery contract")
            signatures=names.keys() if isinstance(names,dict) else names
            for name in signatures:
                if not isinstance(name,str) or not name:
                    raise ValueError("Malformed Foundry discovered test")
                identity=(path+":"+contract,name)
                if identity in inventory:
                    raise ValueError("Duplicate discovered test")
                inventory.add(identity)
    return inventory

def flatten_results(doc):
    if not isinstance(doc,dict):
        raise ValueError("Malformed Foundry runtime results")
    results={}
    for suite,payload in doc.items():
        if not isinstance(payload,dict) or not isinstance(payload.get("test_results"),dict):
            raise ValueError("Missing runtime test results for "+str(suite))
        for name,row in payload["test_results"].items():
            if not isinstance(row,dict) or row.get("status")!="Success":
                raise ValueError("Unsuccessful runtime test: "+suite+":"+name)
            identity=(suite,name)
            if identity in results:
                raise ValueError("Duplicate executed test: "+suite+":"+name)
            results[identity]=row
    return results

def qualify(target, out):
    out=Path(out)
    out.mkdir(parents=True,exist_ok=True)
    stem=hashlib.sha256(target.encode()).hexdigest()[:16]
    discovered=flatten_list(run_json(["forge","test","--list","--json","--match-path",target],out/(stem+".discovered.log")))
    if not discovered:
        return {"target":target,"supportOnly":True,"discovered":[],"executed":[]}
    executed=flatten_results(run_json(["forge","test","--json","--match-path",target],out/(stem+".executed.log")))
    if set(executed)!=discovered:
        missing=sorted(discovered-set(executed));extra=sorted(set(executed)-discovered)
        raise ValueError(f"Runtime inventory mismatch: {target} missing={missing} extra={extra}")
    identities=[{"contract":suite,"test":name} for suite,name in sorted(discovered)]
    return {"target":target,"supportOnly":False,"discovered":identities,"executed":identities,"count":len(identities)}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--target",required=True)
    ap.add_argument("--output",required=True)
    args=ap.parse_args()
    result=qualify(args.target,Path(args.output).parent/"runtime-logs")
    Path(args.output).write_text(json.dumps(result,sort_keys=True,indent=2)+"\n")

if __name__=="__main__":
    main()
