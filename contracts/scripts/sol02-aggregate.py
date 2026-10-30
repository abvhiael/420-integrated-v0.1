#!/usr/bin/env python3
"""CI-SOL-02 exact-SHA evidence validation; never accept missing group artifacts."""
import argparse
import hashlib
import json
from pathlib import Path

def verify(plan, evidence_dir):
    found = {}
    required = set(plan["required"])
    for path in evidence_dir.glob("**/sol02-*.json"):
        doc = json.loads(path.read_text())
        if doc.get("schema") != plan["schema"] and path.name == "sol02-level2.json":
            continue  # Independently checked mandatory Level 2 evidence.
        name = doc.get("group")
        if name is None or name not in plan["groups"]:
            raise ValueError("unknown or malformed group evidence: " + path.name)
        if name in found:
            raise ValueError("duplicate group evidence: " + str(name))
        found[name] = doc
    missing = required - set(found)
    if missing:
        raise ValueError("missing required groups: " + ", ".join(sorted(missing)))
    for group in required:
        d = found[group]
        for field in ("schema", "sha", "profile", "inventory_sha256"):
            if d.get(field) != plan[field]:
                raise ValueError(f"{group}: {field} mismatch")
        expected = sorted(plan["groups"][group])
        if sorted(d.get("targets", [])) != expected or not d.get("passed", False):
            raise ValueError(group + ": target set mismatch or failed tests")
    if plan["level3"]:
        if set(found) != required:
            raise ValueError("Level 3 group inventory mismatch")
        canonical = sorted(p for paths in plan["groups"].values() for p in paths)
        if len(canonical) != len(set(canonical)) or len(canonical) != plan["inventory_count"]:
            raise ValueError("Level 3 primary inventory mismatch")
        digest = hashlib.sha256(("\n".join(canonical)+"\n").encode()).hexdigest()
        if digest != plan["inventory_sha256"]:
            raise ValueError("Level 3 inventory digest mismatch")
    return sorted(required)

def main():
    p = argparse.ArgumentParser()
    p.add_argument("plan")
    p.add_argument("evidence")
    args = p.parse_args()
    plan = json.loads(Path(args.plan).read_text())
    result = verify(plan, Path(args.evidence))
    print("Solidity Qualification Summary PASS: " + ", ".join(result))

if __name__ == "__main__":
    main()
