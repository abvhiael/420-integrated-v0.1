#!/usr/bin/env python3
"""Compare actual compiler ABI and storage layouts at pinned AIJobManager revisions."""
import argparse
import hashlib
import json
import os
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRE = "2bcf3155d55c442714a25e3d5e49f04ed96749f8"
POST = "00a2b8e68b133aa0e6df2edc1c53526722f526b7"
SOURCE = "contracts/src/ai/AIJobManager.sol"
EXPECTED = {PRE: "6163093e917af185f5f33f2e32b82e5ab8404d57",
            POST: "a536bd89eeb229dc3ead63b79ea5007dc18d2ac9"}

def git(*args):
    return subprocess.check_output(["git", "-C", str(ROOT), *args], text=True).strip()

def compile_at(ref, directory):
    # Use exact historical source, including imports and Foundry settings.
    # Worktrees isolate compiler outputs and caches from the current checkout.
    subprocess.run(["git", "-C", str(ROOT), "worktree", "add", "--detach", str(directory), ref], check=True)
    try:
        source_blob = git("rev-parse", f"{ref}:{SOURCE}")
        if source_blob != EXPECTED[ref]:
            raise RuntimeError(f"Unexpected source fingerprint at {ref}")
        env = dict(os.environ, FOUNDRY_PROFILE="default")
        subprocess.run(["forge", "build", "src/ai/AIJobManager.sol", "--extra-output", "storageLayout"],
                       cwd=directory / "contracts", env=env, check=True)
        path = directory / "contracts/out/AIJobManager.sol/AIJobManager.json"
        obj = json.loads(path.read_text())
        metadata = obj["metadata"]
        if isinstance(metadata, str):
            metadata = json.loads(metadata)
        layout = obj["storageLayout"]
        if not layout["storage"] or not layout["types"] or not obj["methodIdentifiers"]:
            raise RuntimeError("Missing compiler outputs")
        return {"commit": ref, "sourceBlob": source_blob,
                "artifactSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "compiler": metadata["compiler"], "settings": metadata["settings"],
                "abi": obj["abi"], "methodIdentifiers": obj["methodIdentifiers"],
                "storageLayout": layout}
    finally:
        subprocess.run(["git", "-C", str(ROOT), "worktree", "remove", "--force", str(directory)], check=True)

def abi_type(p):
    t = p["type"]
    if t.startswith("tuple"):
        return "(" + ",".join(abi_type(c) for c in p["components"]) + ")" + t[5:]
    return t

def abi_key(e):
    return e["type"] + ":" + e.get("name", "") + "(" + ",".join(abi_type(p) for p in e.get("inputs", [])) + ")"

def abi_map(entries):
    result = {}
    for e in entries:
        key = abi_key(e)
        if key in result:
            raise RuntimeError(f"Duplicate ABI key {key}")
        result[key] = e
    return result

def normalized_type(types, ident):
    # Compiler-generated type IDs and AST IDs differ across source revisions.
    # Resolve structural types, retaining encoding, labels, byte widths, and
    # recursively all member slots, byte offsets, names and types.
    t = types[ident]
    out = {k: t[k] for k in ("encoding", "label", "numberOfBytes")}
    for k in ("key", "value", "base"):
        if k in t:
            out[k] = normalized_type(types, t[k])
    if "members" in t:
        out["members"] = [normalized_slot(types, m) for m in t["members"]]
    return out

def normalized_slot(types, slot):
    return {"label": slot["label"], "slot": int(slot["slot"]),
            "offset": int(slot["offset"]), "type": normalized_type(types, slot["type"])}

def compare(pre, post):
    old, new = abi_map(pre["abi"]), abi_map(post["abi"])
    missing = sorted(old.keys() - new.keys())
    changed = sorted(k for k in old.keys() & new.keys() if old[k] != new[k])
    selectors_changed = sorted(k for k, v in pre["methodIdentifiers"].items()
                               if post["methodIdentifiers"].get(k) != v)
    added = sorted(new.keys() - old.keys())
    a, b = pre["storageLayout"], post["storageLayout"]
    old_slots = [normalized_slot(a["types"], s) for s in a["storage"]]
    new_slots = [normalized_slot(b["types"], s) for s in b["storage"]]
    append = new_slots[len(old_slots):]
    # Require exact ordered prefix, and appended entries strictly beyond the
    # final old occupied byte (including multi-slot static values).
    old_end = max(s["slot"] * 32 + s["offset"] + int(s["type"]["numberOfBytes"]) for s in old_slots)
    append_safe = bool(append) and all(s["slot"] * 32 + s["offset"] >= old_end for s in append)
    checks = {
        "sameCompiler": pre["compiler"] == post["compiler"],
        "sameCompilerSettings": all(pre["settings"].get(k) == post["settings"].get(k)
                                    for k in ("optimizer", "evmVersion", "viaIR")),
        "jobsABIUnchanged": old.get("function:jobs(bytes32)") is not None and
                            old["function:jobs(bytes32)"] == new.get("function:jobs(bytes32)") and
                            pre["methodIdentifiers"].get("jobs(bytes32)") == post["methodIdentifiers"].get("jobs(bytes32)"),
        "existingABIEntriesUnchanged": not missing and not changed,
        "existingSelectorsUnchanged": not selectors_changed,
        "existingStorageAndNestedMembersUnchanged": new_slots[:len(old_slots)] == old_slots,
        "disputeStorageAppended": append_safe and [s["label"] for s in append] ==
            ["disputeSequence", "_disputeContexts", "disputeReferenceUsed"],
        "newDisputeInterfacesInventoried": all(k in added for k in (
            "function:disputeSequence(bytes32)", "function:getDisputeContext(bytes32,uint64)",
            "function:disputeReferenceUsed(bytes32)", "error:InvalidDisputeEvidence()",
            "event:DisputeContextRecorded(bytes32,uint64,bytes32,uint8,bytes32,bytes32,bytes32)",
            "event:DisputeContextResolved(bytes32,uint64,bytes32,uint8,uint8)")),
    }
    return {"checks": checks, "passed": all(checks.values()), "missingABI": missing,
            "changedABI": changed, "changedSelectors": selectors_changed,
            "addedABI": {k: new[k] for k in added}, "oldStorage": old_slots,
            "newStorage": new_slots, "appendedStorage": append, "oldStorageEndByte": old_end}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    # Ensure the current checkout still implements the exact compared source.
    if git("hash-object", SOURCE) != EXPECTED[POST]:
        raise RuntimeError("Current AIJobManager differs from pinned post-remediation source")
    with tempfile.TemporaryDirectory(prefix="ai-abi-") as tmp:
        pre = compile_at(PRE, Path(tmp) / "pre")
        post = compile_at(POST, Path(tmp) / "post")
    comparison = compare(pre, post)
    result = {"schema": "420ai-abi-storage-compatibility-v1",
              "qualificationHead": git("rev-parse", "HEAD"), "pre": pre, "post": post,
              "comparison": comparison}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    print(json.dumps(comparison["checks"], indent=2))
    if not comparison["passed"]:
        raise SystemExit("ABI/storage compatibility failed")

if __name__ == "__main__":
    main()
