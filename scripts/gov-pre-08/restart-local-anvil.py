#!/usr/bin/env python3
"""Source-bound Anvil RPC state dump and import; disposable chain 31337 ONLY.

--init and --dump-state are mutually exclusive in Anvil; use the supported
local anvil_dumpState/anvil_loadState RPC pair across two *actual processes*.
Historical receipt continuity is NOT implied by this developer-state snapshot.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import re
import subprocess
from pathlib import Path

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("govpre08_step3_funding_rpc",
                                           HERE/"materialize-local-vault-funding.py")
funding=importlib.util.module_from_spec(spec)
spec.loader.exec_module(funding)

def require(condition,msg):
    if not condition:
        raise ValueError("local Anvil recovery: "+msg)

def source_head():
    return subprocess.check_output(["git","rev-parse","HEAD"],
               cwd=HERE.parents[1],text=True).strip()

def act(url, mode, path):
    rpc=funding.Rpc(url)
    require(int(rpc.call("eth_chainId",[]),16)==31337,"wrong local network")
    if mode=="dump":
        require(not path.exists(),"refusing to overwrite saved evidence")
        blob=rpc.call("anvil_dumpState",[])
        require(isinstance(blob,str) and re.fullmatch(r"0x(?:[a-fA-F0-9]{2})+",blob),
                "malformed Anvil state RPC response")
        payload={
            "schema":"GOV_PRE_08_STEP3_ANVIL_LOCAL_RESTART_SNAPSHOT_V1",
            "sourceGitHead":source_head(),"chainId":31337,
            "snapshotHex":blob,
            "snapshotSha256":hashlib.sha256(bytes.fromhex(blob[2:])).hexdigest(),
            "productionRelease":False,
        }
        path.write_text(json.dumps(payload,sort_keys=True)+"\n")
        print("GOV_PRE_08_STEP3_LOCAL_PROCESS_SNAPSHOT_SAVED=PASS")
    else:
        payload=json.loads(path.read_text())
        require(payload["schema"]=="GOV_PRE_08_STEP3_ANVIL_LOCAL_RESTART_SNAPSHOT_V1"
                and payload["sourceGitHead"]==source_head()
                and payload["chainId"]==31337 and not payload["productionRelease"],
                "stale/nonlocal/forged snapshot identity")
        blob=payload["snapshotHex"]
        require(isinstance(blob,str) and re.fullmatch(r"0x(?:[a-fA-F0-9]{2})+",blob),
                "malformed saved snapshot")
        require(hashlib.sha256(bytes.fromhex(blob[2:])).hexdigest()==payload["snapshotSha256"],
                "saved Anvil state was tampered")
        result=rpc.call("anvil_loadState",[blob])
        require(result is True,"Anvil rejected state import")
        print("GOV_PRE_08_STEP3_LOCAL_STATE_IMPORTED_IN_FRESH_PROCESS=PASS")

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--rpc",required=True)
    group=p.add_mutually_exclusive_group(required=True)
    group.add_argument("--dump",type=Path)
    group.add_argument("--restore",type=Path)
    a=p.parse_args()
    try:
        act(a.rpc,"dump" if a.dump else "restore",a.dump or a.restore)
    except (ValueError,KeyError,OSError,subprocess.CalledProcessError,TypeError) as exc:
        p.exit(1,str(exc)+"\n")

if __name__=="__main__":
    main()
