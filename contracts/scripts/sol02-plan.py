#!/usr/bin/env python3
"""CI-SOL-02: deterministic contract-family partitioning and fail-closed inventory."""
import argparse
import fnmatch
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / "config/sol02-groups.json").read_text())
ORDER = list(CONFIG["groups"])

def assign(path):
    matches = []
    for group, rules in CONFIG["groups"].items():
        if group == "integration":
            continue
        for prefix in rules["source" if path.startswith("src/") else "tests"]:
            if path.startswith(prefix):
                matches.append((len(prefix), ORDER.index(group), group))
    if not matches:
        return "integration"
    # Longest prefix wins; explicit group ordering breaks ties.
    return sorted(matches, key=lambda t: (-t[0], t[1]))[0][2]

def inventory():
    paths = sorted(str(p.relative_to(ROOT)) for folder in ("src", "test", "script") for p in (ROOT / folder).rglob("*.sol"))
    if not paths:
        raise RuntimeError("empty Solidity inventory")
    groups = {key: [] for key in ORDER}
    for p in paths:
        group = assign(p) if not p.startswith("script/") else "integration"
        groups[group].append(p)
    flat = sorted(p for values in groups.values() for p in values)
    if flat != paths or len(flat) != len(set(flat)):
        raise RuntimeError("non-exhaustive or duplicate inventory")
    return paths, groups

def changed_files(base):
    if not base:
        raise RuntimeError("PR scope needs a verified merge-base")
    out = subprocess.check_output(["git", "diff", "--name-only", "--diff-filter=ACMRT", base + "...HEAD"], cwd=ROOT.parent, text=True)
    return sorted(set(x for x in out.splitlines() if x))

def choose(paths, groups, changes, level3):
    if level3:
        return [name for name, items in groups.items() if items]
    if not changes:
        raise RuntimeError("empty PR change list")
    # No silent exclusion for altered CI, policies, scripts, cross-module APIs, or unrecognized Solidity scope.
    force_full = any(x.startswith(("contracts/config/","contracts/scripts/","contracts/foundry.toml",".github/workflows/")) or
                     x.startswith("contracts/src/interfaces/") or x.startswith("contracts/src/libraries/") or
                     x.startswith("contracts/src/system/") or x.startswith("contracts/src/governance/") for x in changes)
    if force_full:
        return [name for name, items in groups.items() if items]
    selected = set()
    for path in changes:
        if path.startswith("contracts/") and path.endswith(".sol"):
            selected.add(assign(path.removeprefix("contracts/")))
    if not selected:
        return []
    # Conservative: unresolved / mixed domains require all groups for integration.
    if "integration" in selected or len(selected) > 1:
        return [name for name, items in groups.items() if items]
    selected.add("integration")
    return [name for name in ORDER if name in selected and groups[name]]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base")
    ap.add_argument("--level3", action="store_true")
    ap.add_argument("--output", required=True)
    args = ap.parse_args()
    inv, groups = inventory()
    changes = [] if args.level3 else changed_files(args.base)
    required = choose(inv, groups, changes, args.level3)
    sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT.parent, text=True).strip()
    data = {"schema": CONFIG["schema"], "sha": sha, "profile": "ci" if args.level3 else "pr",
            "level3": args.level3, "groups": groups, "required": required,
            "inventory_sha256": hashlib.sha256(("\n".join(inv)+"\n").encode()).hexdigest(),
            "inventory_count": len(inv), "changes": changes}
    Path(args.output).write_text(json.dumps(data, indent=2, sort_keys=True)+"\n")
    print(json.dumps({"required": required, "sha": sha, "inventory_count": len(inv), "inventory_sha256": data["inventory_sha256"]}))

if __name__ == "__main__":
    main()
