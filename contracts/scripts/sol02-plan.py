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

# Select bounded partitions by actual Solidity import closure and shared dependencies.
# Primary ownership is unique; imported dependencies may occur in multiple groups.
from functools import lru_cache
import posixpath

MAX_PRIMARY_TARGETS = 60
MAX_IMPORT_GRAPH_FILES = 280
IMPORT_RE = re.compile(r"""import\s+(?:[^;]*?from\s+)?["']([^"']+)["']\s*;""", re.MULTILINE)

@lru_cache(maxsize=None)
def direct_imports(path):
    root = (ROOT / path).read_text(encoding="utf-8")
    found = set()
    for imported in IMPORT_RE.findall(root):
        if imported.startswith("."):
            resolved = posixpath.normpath(posixpath.join(posixpath.dirname(path), imported))
            if not (ROOT / resolved).is_file():
                raise RuntimeError(f"missing Solidity import: {path} -> {imported}")
            found.add(resolved)
        elif imported.startswith(("src/", "test/", "script/")):
            if not (ROOT / imported).is_file():
                raise RuntimeError(f"missing Solidity import: {path} -> {imported}")
            found.add(imported)
        # External packages and remappings remain Foundry's responsibility.
    return frozenset(found)

@lru_cache(maxsize=None)
def dependency_closure(path):
    seen = set()
    stack = [path]
    while stack:
        next_path = stack.pop()
        if next_path in seen:
            continue
        seen.add(next_path)
        stack.extend(direct_imports(next_path) - seen)
    return frozenset(seen)

def bounded_groups(groups):
    partitioned = {}
    for family, items in groups.items():
        remaining = set(items)
        parts = []
        while remaining:
            # Start from the most dependency-heavy primary target; greedily
            # colocate targets reusing the same dependency graph.
            seed = min(remaining, key=lambda p: (-len(dependency_closure(p)), p))
            chosen, graph = [], set()
            while remaining and len(chosen) < MAX_PRIMARY_TARGETS:
                options = sorted(remaining, key=lambda p: (-len(dependency_closure(p) & graph), len(dependency_closure(p) - graph), p))
                candidate = seed if not chosen else options[0]
                closure = dependency_closure(candidate)
                if len(graph | closure) > MAX_IMPORT_GRAPH_FILES:
                    # Search for any smaller compatible target before splitting.
                    candidates = [p for p in options if len(graph | dependency_closure(p)) <= MAX_IMPORT_GRAPH_FILES]
                    if not candidates:
                        if not chosen:
                            raise RuntimeError(f"oversized single import closure: {candidate}")
                        break
                    candidate = candidates[0]
                    closure = dependency_closure(candidate)
                chosen.append(candidate)
                remaining.remove(candidate)
                graph.update(closure)
            parts.append((sorted(chosen), sorted(graph)))
        if len(parts) == 1:
            partitioned[family] = parts[0][0]
        else:
            for i, (targets, _) in enumerate(parts, 1):
                partitioned[f"{family}--{i:02d}"] = targets
    flat = sorted(p for entries in partitioned.values() for p in entries)
    expected = sorted(p for entries in groups.values() for p in entries)
    if flat != expected:
        raise RuntimeError("bounded partition lost or duplicated a primary Solidity unit")
    return partitioned

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
    inv, original = inventory()
    changes = [] if args.level3 else changed_files(args.base)
    required_families = choose(inv, original, changes, args.level3)
    groups = bounded_groups(original)
    required = [g for g in groups if g.split("--")[0] in required_families]
    sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT.parent, text=True).strip()
    data = {"schema": CONFIG["schema"], "sha": sha, "profile": "ci" if args.level3 else "pr",
            "level3": args.level3, "groups": groups, "required": required,
            "inventory_sha256": hashlib.sha256(("\n".join(inv)+"\n").encode()).hexdigest(),
            "inventory_count": len(inv), "changes": changes}
    Path(args.output).write_text(json.dumps(data, indent=2, sort_keys=True)+"\n")
    print(json.dumps({"required": required, "sha": sha, "inventory_count": len(inv), "inventory_sha256": data["inventory_sha256"]}))

if __name__ == "__main__":
    main()
