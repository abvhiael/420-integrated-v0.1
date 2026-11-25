#!/usr/bin/env python3
"""Compile both frozen commits and retain actual ABI/storage output; fail on Resource drift."""
import json, os, pathlib, subprocess, sys, tempfile, importlib.util
spec = importlib.util.spec_from_file_location('resource_stage', pathlib.Path(__file__).with_name('qualify-resource-solidity.py'))
stager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stager)
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = pathlib.Path(sys.argv[1]).resolve()
OUT.mkdir(parents=True, exist_ok=True)
manifest = json.loads((ROOT / "docs/audit/420RESOURCE-8A1-baseline.json").read_text())
def run(args, cwd, env=None):
    return subprocess.check_output(args, cwd=cwd, env=env, text=True)
def normalize_layout(layout):
    types = layout.get("types") or {}
    def typ(key, seen=()):
        if key in seen:
            return {"recursive": types[key]["label"]}
        t = types[key]
        r = {k:t[k] for k in ("encoding","label","numberOfBytes") if k in t}
        for k in ("base","key","value"):
            if k in t: r[k] = typ(t[k], seen+(key,))
        if "members" in t:
            r["members"] = [member(m, seen+(key,)) for m in t["members"]]
        return r
    def member(m, seen=()):
        return {**{k:m[k] for k in ("label","slot","offset")}, "type":typ(m["type"],seen)}
    return [member(m) for m in layout["storage"]]
def abi(a):
    return sorted(a,key=lambda x:json.dumps(x,sort_keys=True))
paths = [f["path"] for f in manifest["files"] if f["path"].endswith(".sol") and f["current"] and f["qualified"] and (f["path"].startswith("contracts/src/resource/") or f["path"].startswith("contracts/src/vault/") or f["path"].endswith(("GovernanceTimelock.sol","ProtocolRegistry.sol","CapabilityRegistry420.sol")))]
results = {}
with tempfile.TemporaryDirectory() as tmp:
    for label in ("qualified","baseline"):
        sha = manifest[label]
        work = pathlib.Path(tmp)/label
        run(["git","fetch","--no-tags","origin",sha],ROOT)
        run(["git","worktree","add","--detach",str(work),sha],ROOT)
        try:
            assert run(["git","rev-parse","HEAD"],work).strip() == sha
            run(["git","submodule","update","--init","--recursive"],work)
            env = dict(os.environ, FOUNDRY_PROFILE="ci", FOUNDRY_SRC="src/resource", FOUNDRY_TEST="test/__resource_empty__")
            original = work/"contracts"
            cwd = pathlib.Path(tmp)/(label+"-compiler")
            stager.stage(original, cwd, [], [pathlib.Path(p).relative_to("contracts") for p in paths])
            folder = OUT/label
            folder.mkdir()
            (folder/"forge-version.txt").write_text(run(["forge","--version"],cwd,env))
            (folder/"forge-config.json").write_text(run(["forge","config","--json"],original,dict(os.environ, FOUNDRY_PROFILE="ci")))
            (folder/"staged-forge-config.json").write_text(run(["forge","config","--json"],cwd,env))
            results[label] = {}
            for path in paths:
                source = pathlib.Path(path)
                target = str(source.relative_to("contracts"))+":"+source.stem
                raw = {}
                for field in ("abi","storage-layout"):
                    raw[field] = json.loads(run(["forge","inspect",target,field,"--json"],cwd,env))
                (folder/(source.stem+".json")).write_text(json.dumps(raw,indent=2,sort_keys=True))
                results[label][path] = {"abi":abi(raw["abi"]),"layout":normalize_layout(raw["storage-layout"])}
        finally:
            run(["git","worktree","remove","--force",str(work)],ROOT)
report = []
for path in paths:
    a,b = (results[k][path] for k in ("qualified","baseline"))
    report.append({"path":path,"abi_equal":a["abi"]==b["abi"],"layout_equal":a["layout"]==b["layout"]})
(OUT/"comparison.json").write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
# Timelock change is expected but must be explicitly reviewed; never silently accept it.
if not all(r["abi_equal"] and r["layout_equal"] for r in report if not r["path"].endswith("GovernanceTimelock.sol")):
    sys.exit("Unexpected ABI/storage drift")
