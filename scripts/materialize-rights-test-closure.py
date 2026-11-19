#!/usr/bin/env python3
"""Materialize the exact Rights test import closure, preserving Foundry profiles."""
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

source = (Path(__file__).resolve().parent.parent / "contracts").resolve()
dest = Path(sys.argv[1]).resolve()
if dest.exists():
    raise RuntimeError(f"destination already exists: {dest}")
pending = sorted((source / "test").glob("Rights*.t.sol"))
required = {"RightsGenesis420.t.sol", "RightsFocusedHardening420.t.sol", "RightsDeploymentBinding420.t.sol"}
if not required.issubset({path.name for path in pending}):
    raise RuntimeError("missing canonical Rights test file")
seen = set()
pattern = re.compile(r'\bimport\s+(?:[^;]*?\bfrom\s+)?["\x27]([^"\x27]+)["\x27]\s*;')
while pending:
    path = pending.pop().resolve()
    if path in seen:
        continue
    if not path.is_relative_to(source) or not path.is_file():
        raise RuntimeError(f"missing or external Solidity import: {path}")
    seen.add(path)
    for name in pattern.findall(path.read_text()):
        pending.append(source / name if name.startswith("forge-std/") else path.parent / name)
for path in sorted(seen):
    target = dest / path.relative_to(source)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, target)
    if target.read_bytes() != path.read_bytes():
        raise RuntimeError(f"source identity mismatch: {path}")
shutil.copyfile(source / "foundry.toml", dest / "foundry.toml")
(dest / "remappings.txt").write_text("forge-std/=forge-std/\n")
print(json.dumps({str(p.relative_to(source)): hashlib.sha256(p.read_bytes()).hexdigest()
                  for p in sorted(seen)}, sort_keys=True))
