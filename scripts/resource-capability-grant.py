#!/usr/bin/env python3
"""Generate canonical Resource capability identifiers using Foundry cast.
Never signs or submits a grant. The authority must review the output.
"""
import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOMAINS = {"provider": "420/RESOURCE/PROVIDER/SCOPE/V1", "node": "420/RESOURCE/NODE/SCOPE/V1", "session": "420/RESOURCE/SESSION/SCOPE/V1", "proofScheme": "420/STORAGE/PROOF_SCHEME/SCOPE/V1"}
COMPONENT = "420/RESOURCE/COMPONENT/V1"
ACTIONS = {
    "ResourceIds420.ACTION_REGISTER_PROVIDER": "provider",
    "ResourceIds420.ACTION_UPDATE_PROVIDER": "provider",
    "ResourceIds420.ACTION_SET_PROVIDER_STATE": "provider",
    "ResourceIds420.ACTION_REGISTER_NODE": "node",
    "ResourceIds420.ACTION_UPDATE_NODE": "node",
    "ResourceIds420.ACTION_SET_NODE_STATE": "node",
    "ResourceIds420.ACTION_PUBLISH_OFFER": "node",
    "ResourceIds420.ACTION_SUBMIT_RECEIPT": "node",
    "ResourceIds420.ACTION_SETTLE": "session",
    "StorageIds420.ACTION_CONFIGURE_STORAGE_CAPACITY": "node",
    "StorageIds420.ACTION_RESERVE_STORAGE_CAPACITY": "node",
    "StorageProofIds420.ACTION_REGISTER_PROOF_SCHEME": "proofScheme",
    "StorageProofIds420.ACTION_SET_PROOF_SCHEME_STATE": "proofScheme",
    "StorageProofIds420.ACTION_REGISTER_STORAGE_COMMITMENT": "node",
    "StorageProofIds420.ACTION_ACCEPT_STORAGE_AGREEMENT": "node"
}
def cast(*args):
    return subprocess.check_output(["cast", *args], text=True).strip()
def word(s):
    if not re.fullmatch(r"0x[0-9a-fA-F]{64}", s) or int(s,16)==0:
        raise ValueError("expected nonzero bytes32")
    return s.lower()
def derive(action, ids):
    kind = ACTIONS[action]
    ids = [word(x) for x in ids]
    if len(ids) != (2 if kind == "node" else 1):
        raise ValueError("wrong scope arity")
    lib, name = action.split(".")
    source = (ROOT/"contracts/src/resource"/(lib+".sol")).read_text()
    preimage = re.search(r'constant\s+'+name+r'\s*=\s*keccak256\("([^"]+)"\)',source).group(1)
    encoded = cast("abi-encode", "f(string,"+",".join(["bytes32"]*len(ids))+")", DOMAINS[kind], *ids)
    return {"componentId":cast("keccak",COMPONENT),"capabilityId":cast("keccak",preimage),"scopeHash":cast("keccak",encoded),"scopeKind":kind}
if __name__ == "__main__":
    p=argparse.ArgumentParser()
    p.add_argument("action",choices=sorted(ACTIONS))
    p.add_argument("ids",nargs="+")
    args=p.parse_args()
    print(json.dumps(derive(args.action,args.ids),sort_keys=True))
