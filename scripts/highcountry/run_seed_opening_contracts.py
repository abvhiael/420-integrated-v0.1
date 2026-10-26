#!/usr/bin/env python3
"""Compile only the unmodified contract import closure used by HC-SEED-03."""
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
ROOT=Path(__file__).resolve().parents[2]
TEST='scripts/highcountry/seed-openings-contract-test.sol'

def main():
    with tempfile.TemporaryDirectory(prefix='hc-seed-03-contracts-') as folder:
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
            for dep in re.findall(r'(?:from\s+|import\s+)"([^"]+)"',text):
                pending.append(str((path.parent/dep).resolve().relative_to(ROOT)))
        manifest='deployments/highcountry/common-reference-genomes.v1.json'
        (dest/manifest).parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(ROOT/manifest,dest/manifest)
        shutil.copyfile(ROOT/'deployments/highcountry/rare-breeding-plan.v1.json',dest/'deployments/highcountry/rare-breeding-plan.v1.json')
        shutil.copyfile(ROOT/'deployments/highcountry/seed-opening-policy.v1.json',dest/'deployments/highcountry/seed-opening-policy.v1.json')
        (dest/'foundry.toml').write_text('''[profile.default]
src = "contracts/src"
test = "scripts/highcountry"
solc_version = "0.8.24"
evm_version = "cancun"
optimizer = true
optimizer_runs = 200
via_ir = true
ffi = false
fs_permissions = [{ access = "read", path = "./deployments" }, { access = "read-write", path = "./out" }]
''')
        result=subprocess.run([os.environ.get('HC_SEED_FORGE','forge'),'test','--root',folder,'--match-path',TEST,'-vv'],check=False,capture_output=True,text=True)
        print(result.stdout);print(result.stderr)
        if result.returncode==0 and 'Suite result: ok.' not in result.stdout:raise RuntimeError('no passing actual-contract suite evidence')
        raise SystemExit(result.returncode)
if __name__=='__main__':main()
