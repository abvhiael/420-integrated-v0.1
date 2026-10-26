#!/usr/bin/env python3
"""Compile only the unmodified contract import closure used by HC-SEED-07."""
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
ROOT=Path(__file__).resolve().parents[2]
TEST='scripts/highcountry/seed-packs-contract-test.sol'

def main():
    with tempfile.TemporaryDirectory(prefix='hc-seed-07-contracts-') as folder:
        dest=Path(folder)
        pending=[TEST];seen=set()
        while pending:
            rel=pending.pop()
            if rel in seen:continue
            seen.add(rel)
            path=(ROOT/rel).resolve()
            path.relative_to(ROOT)
            text=path.read_text()
            target=dest/rel
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_text(text)
            for dep in re.findall(r'from\s+"([^"]+)"',text):
                pending.append(str((path.parent/dep).resolve().relative_to(ROOT)))
        manifest='deployments/highcountry/common-reference-genomes.v1.json'
        (dest/manifest).parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(ROOT/manifest,dest/manifest)
        (dest/'foundry.toml').write_text('''[profile.default]
src = "contracts/src"
test = "scripts/highcountry"
solc_version = "0.8.24"
evm_version = "cancun"
optimizer = true
optimizer_runs = 200
via_ir = true
ffi = false
fs_permissions = [{ access = "read", path = "./deployments" }]
''')
        result=subprocess.run([os.environ.get('HC_SEED_FORGE','forge'),'test','--root',folder,'--match-path',TEST,'-vv'],check=False)
        raise SystemExit(result.returncode)
if __name__=='__main__':main()
