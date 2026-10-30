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
        if path.name in ("sol02-level2.json","sol02-fixture.json"):
            continue  # Both are independently verified by the summary job.
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
        records=d.get("runtime")
        expected_tests={t for t in expected if t.startswith("test/") and t.endswith(".sol")}
        if not isinstance(records,list) or {r.get("target") for r in records}!=expected_tests:
            raise ValueError(group + ": runtime target inventory mismatch")
        seen=set()
        for record in records:
            discovered=record.get("discovered")
            executed=record.get("executed")
            if not isinstance(discovered,list) or not isinstance(executed,list):
                raise ValueError(group + ": missing runtime identities")
            ids=[(x.get("contract"),x.get("test")) for x in executed]
            expected_ids=[(x.get("contract"),x.get("test")) for x in discovered]
            if ids!=expected_ids or len(ids)!=len(set(ids)):
                raise ValueError(group + ": executed/discovered runtime mismatch")
            if record.get("supportOnly") != (not bool(ids)):
                raise ValueError(group + ": invalid support-only marker")
            for identity in ids:
                if identity in seen or not all(isinstance(x,str) and x for x in identity):
                    raise ValueError(group + ": duplicate or malformed runtime identity")
                seen.add(identity)
        if len(seen)!=d.get("runtimeTestCount") or not seen:
            raise ValueError(group + ": runtime count mismatch")

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
