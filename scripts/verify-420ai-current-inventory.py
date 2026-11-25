#!/usr/bin/env python3
"""Compile-backed AI ABI and recursive Solidity import inventory."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACTS = ROOT / "contracts"
INVENTORY = ROOT / "docs/audit/420AI-AUDIT-10.1-CURRENT-MAIN-INVENTORY.json"

def git(*args):
    return subprocess.check_output(["git", "-C", str(ROOT), *args], text=True).strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    inventory = json.loads(INVENTORY.read_text())
    sources = sorted((CONTRACTS / "src/ai").glob("*.sol"))
    expected = {r["path"]: r["blob"] for r in inventory["sources"]}
    actual = {str(p.relative_to(ROOT)): git("hash-object", str(p)) for p in sources}
    if actual != expected:
        raise SystemExit("AI source inventory drift")
    # Clean artifacts to prevent stale ABI evidence.
    subprocess.run(["forge", "clean"], cwd=CONTRACTS, check=True)
    subprocess.run(["forge", "build", "src/ai"], cwd=CONTRACTS, check=True)
    result = {"schema": "420ai-compiled-abi-inventory-v1", "head": git("rev-parse", "HEAD"),
              "sourceBaseline": inventory["baseline"], "compiler": {}, "sources": {}}
    queue = list(sources)
    visited = set()
    closure = {}
    while queue:
        p = queue.pop().resolve()
        if p in visited:
            continue
        visited.add(p)
        text = re.sub(r"/\*[\s\S]*?\*/|//[^\n]*", "", p.read_text())
        imports = re.findall(r'\bimport\s+[^;]*?["\']([^"\']+)["\']\s*;', text)
        edges = []
        for imp in imports:
            if imp.startswith("."):
                target = (p.parent / imp).resolve()
            else:
                target = (CONTRACTS / imp).resolve()
            if not target.is_file():
                raise SystemExit(f"Unresolved import: {p}: {imp}")
            edges.append(str(target.relative_to(ROOT)))
            queue.append(target)
        closure[str(p.relative_to(ROOT))] = {"blob": git("hash-object", str(p)), "imports": sorted(edges)}
    result["importClosure"] = closure
    for p in sources:
        entries = {}
        for artifact in sorted((CONTRACTS / "out" / p.name).glob("*.json")):
            obj = json.loads(artifact.read_text())
            if "abi" not in obj:
                continue
            metadata = obj.get("metadata", {})
            if isinstance(metadata, str):
                metadata = json.loads(metadata)
            target = metadata.get("settings", {}).get("compilationTarget", {})
            if target and not any(k.endswith("/" + p.name) for k in target):
                continue
            entries[artifact.stem] = {"abi": obj["abi"], "methodIdentifiers": obj.get("methodIdentifiers", {}),
                                     "compiler": metadata.get("compiler", {}),
                                     "artifactSha256": hashlib.sha256(artifact.read_bytes()).hexdigest()}
        if not entries:
            raise SystemExit(f"No compiler artifacts for {p.name}")
        result["sources"][str(p.relative_to(ROOT))] = entries
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    print(f"420AI compiled inventory: {len(sources)} sources, {len(closure)} import-closure files")

if __name__ == "__main__":
    main()
