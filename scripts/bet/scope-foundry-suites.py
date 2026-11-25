#!/usr/bin/env python3
"""Copy mandatory Foundry test roots and local test dependencies verbatim.
Run from contracts/. Destination must be a fresh direct child of contracts/.
Source imports continue to resolve to the original canonical contracts.
"""
import pathlib
import re
import shutil
import sys

root = pathlib.Path("test").resolve()
dest = pathlib.Path(sys.argv[1]).resolve()
assert dest.parent == root.parent and dest != root and dest.is_dir()
names = sys.argv[2:]
assert names and len(names) == len(set(names))
seen = set()

def copy(relative):
    if relative in seen:
        return
    seen.add(relative)
    src = root / relative
    target = dest / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, target)
    for dep in re.findall(r'import\s+(?:[^;]*?\s+from\s+)?["\x27]([^"\x27]+)["\x27]\s*;', src.read_text()):
        if dep.startswith("."):
            resolved = (src.parent / dep).resolve()
            if resolved.is_relative_to(root):
                copy(resolved.relative_to(root))

for name in names:
    assert re.fullmatch(r"(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_]+", name)
    copy(pathlib.Path(name + ".t.sol"))
print("Mandatory test source closure:", ", ".join(sorted(str(p) for p in seen)))
