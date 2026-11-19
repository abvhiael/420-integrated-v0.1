#!/usr/bin/env python3
"""Copy exact canonical Treasury deployable source graph into an isolated Foundry root."""
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path
source = (Path(__file__).resolve().parents[2] / "contracts").resolve()
dest = Path(sys.argv[1]).resolve()
if dest.exists():
    raise RuntimeError("destination already exists")
owners = sorted((source / "src/treasury").glob("*.sol")) + [
    source / "src/system/CapabilityRegistry420.sol",
    source / "src/governance/GovernanceTimelock.sol",
    source / "src/apps/ProtocolRegistry.sol",
]
pending = list(owners)
seen = set()
pattern = re.compile(r'\bimport\s+(?:[^;]*?\bfrom\s+)?["\x27]([^"\x27]+)["\x27]\s*;')
while pending:
    path = pending.pop().resolve()
    if path in seen:
        continue
    if not path.is_relative_to(source) or not path.is_file():
        raise RuntimeError(f"missing or external import: {path}")
    seen.add(path)
    for name in pattern.findall(path.read_text()):
        pending.append(source / name if name.startswith("forge-std/") else path.parent / name)
for path in sorted(seen):
    target = dest / path.relative_to(source)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, target)
    assert target.read_bytes() == path.read_bytes()
shutil.copyfile(source / "foundry.toml", dest / "foundry.toml")
(dest / "remappings.txt").write_text("forge-std/=forge-std/\n")
print(json.dumps({str(p.relative_to(source)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(seen)}, sort_keys=True))
