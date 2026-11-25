#!/usr/bin/env python3
"""Stage unmodified Resource sources and selected test owners with exact import closure."""
import argparse, hashlib, json, re, shutil
from pathlib import Path

def stage(root, dest, owners, sources):
    root, dest = root.resolve(), dest.resolve()
    dest.mkdir(parents=True, exist_ok=False)
    shutil.copy2(root/"foundry.toml", dest/"foundry.toml")
    vendor = root/"test/fixtures/cadc/upstream"
    manifest = vendor.parent/"upstream-manifest.json"
    locked = json.loads(manifest.read_text())["sources"] if manifest.exists() else {}
    pattern = re.compile(r"""\bimport\s+(?:[^;"']*?\s+from\s+)?["']([^"']+)["']\s*;""", re.S)
    queue = list(sources)+list(owners)
    seen = set()
    while queue:
        rel = queue.pop()
        if rel in seen: continue
        seen.add(rel)
        source = root/rel
        if not source.is_file(): raise RuntimeError(f"Missing import {rel}")
        target = dest/rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source,target)
        for dep in pattern.findall(source.read_text()):
            if dep.startswith(("@","solidity-bytes-utils/")):
                path = vendor/dep
                if dep not in locked or hashlib.sha256(path.read_bytes()).hexdigest()!=locked[dep]:
                    raise RuntimeError(f"Unverified dependency {dep}")
            elif dep.startswith("."): path = source.parent/dep
            else: path = root/dep
            queue.append(path.resolve().relative_to(root))
    remaps = ["forge-std/=forge-std/"]
    for prefix in ("@layerzerolabs/","@openzeppelin/","solidity-bytes-utils/"):
        remaps.append(prefix+"=test/fixtures/cadc/upstream/"+prefix)
    (dest/"remappings.txt").write_text("\n".join(remaps)+"\n")
    print(f"Staged {len(seen)} exact source/import files")
    return seen

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--stage",required=True,type=Path)
    a=p.parse_args()
    root=Path(__file__).resolve().parents[1]/"contracts"
    names=["ResourceGenesis420","ResourceDeploymentBinding420","StorageCapacityRegistry420","StorageProofProtocol420","StorageAgreementRegistry420","StorageObjectManifestRegistry420","StorageSettlementRegistry420"]
    owners=[Path("test")/(n+".t.sol") for n in names]
    sources=[s.relative_to(root) for s in (root/"src/resource").glob("*.sol")]
    stage(root,a.stage,owners,sources)
