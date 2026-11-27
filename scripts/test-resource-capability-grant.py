#!/usr/bin/env python3
import importlib.util
import pathlib
import json
import subprocess
p=pathlib.Path(__file__).with_name("resource-capability-grant.py")
spec=importlib.util.spec_from_file_location("grant",p)
g=importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)
a="0x"+"00"*31+"01"
b="0x"+"00"*31+"02"
fixed=json.loads((g.ROOT/"sdk/storage420/testdata/resource_identifier_vectors.json").read_text())
expected={x["name"]:x for x in fixed["identifiers"]}
scopes={x["kind"]:x for x in fixed["scopes"]}
assert set(g.ACTIONS)=={x["name"] for x in fixed["identifiers"] if x["kind"]}
for x in fixed["identifiers"]:
    assert g.cast("keccak",x["preimage"])==x["hash"],x["name"]
vectors=[]
for action,kind in g.ACTIONS.items():
    ids=[a,b] if kind=="node" else [a]
    v=g.derive(action,ids)
    assert v["capabilityId"]==expected[action]["hash"]
    assert v["scopeHash"]==scopes[kind]["hash"]
    assert v["componentId"]==expected["ResourceIds420.COMPONENT_RESOURCE"]["hash"]
    assert v["scopeHash"] != g.cast("keccak",g.cast("abi-encode","f("+",".join(["bytes32"]*len(ids))+")",*ids))
    vectors.append(dict(action=action,ids=ids,**v))
assert len({v["capabilityId"] for v in vectors})==15
assert len({v["scopeHash"] for v in vectors})==4
assert all(v["componentId"]!=g.cast("keccak","420/service/resource-protocol/v1") for v in vectors)
for action in ("ResourceIds420.ACTION_OPEN_SESSION","unknown"):
    try: g.derive(action,[a])
    except KeyError: pass
    else: raise AssertionError("unsupported action")
print(json.dumps(vectors,indent=2))
