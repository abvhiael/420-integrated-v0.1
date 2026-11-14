#!/usr/bin/env python3
"""Run the Dogecoin test owners against an unmodified, isolated source import closure."""
import argparse
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--match',default='Dogecoin*420.t.sol')
    parser.add_argument('--solc',default='0.8.24')
    parser.add_argument('--exclude-test')
    parser.add_argument('--match-test')
    parser.add_argument('--trace',action='store_true')
    args=parser.parse_args()
    tests=list((ROOT/'contracts/test').glob(args.match))
    if not tests: raise RuntimeError('No Dogecoin tests selected')
    with tempfile.TemporaryDirectory(prefix='dogecoin-qualification-') as folder:
        dest=Path(folder);pending=[p.relative_to(ROOT) for p in tests];seen=set()
        while pending:
            rel=pending.pop()
            if rel in seen:continue
            seen.add(rel);source=ROOT/rel
            target=dest/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
            for dep in re.findall(r'(?:from\s+|import\s+)"([^"]+)"',source.read_text()):
                path=(ROOT/'contracts'/dep if dep.startswith('forge-std/') else source.parent/dep).resolve()
                pending.append(path.relative_to(ROOT))
        shutil.copytree(ROOT/'contracts/test/fixtures/dogecoin',dest/'contracts/test/fixtures/dogecoin')
        (dest/'foundry.toml').write_text('''[profile.default]
src="contracts/src"
test="contracts/test"
solc_version="0.8.24"
evm_version="cancun"
optimizer=true
optimizer_runs=200
via_ir=true
ffi=false
gas_limit=9223372036854775807
code_size_limit=1000000
remappings=["forge-std/=contracts/forge-std/"]
fs_permissions=[{access="read",path="./contracts/test/fixtures/dogecoin"}]
fuzz={runs=2500,seed="0x420"}
[invariant]
runs=128
depth=64
fail_on_revert=true
''')
        command=[os.environ.get('DOGE_FORGE','forge'),'test','--root',folder,'--use',args.solc,'--match-path','contracts/test/'+args.match,'-vvvv' if args.trace else '-vv']
        if args.exclude_test:command+=['--no-match-test',args.exclude_test]
        if args.match_test:command+=['--match-test',args.match_test]
        result=subprocess.run(command,check=False,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
        print(result.stdout,end="")
        if result.returncode==0 and not re.search(r"[1-9][0-9]* tests? passed",result.stdout):raise RuntimeError("Zero passing tests")
        raise SystemExit(result.returncode)

if __name__=='__main__':main()
