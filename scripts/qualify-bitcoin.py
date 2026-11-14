#!/usr/bin/env python3
"""Run the Bitcoin test owners against an unmodified, isolated source import closure."""
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
    parser.add_argument('--match',default='Bitcoin*420.t.sol')
    parser.add_argument('--solc',default='0.8.24')
    parser.add_argument('--exclude-test')
    parser.add_argument('--match-test')
    args=parser.parse_args()
    tests=list((ROOT/'contracts/test').glob(args.match))
    if not tests: raise RuntimeError('No Bitcoin tests selected')
    with tempfile.TemporaryDirectory(prefix='bitcoin-qualification-') as folder:
        dest=Path(folder);pending=[p.relative_to(ROOT) for p in tests];seen=set()
        while pending:
            rel=pending.pop()
            if rel in seen:continue
            seen.add(rel);source=ROOT/rel
            target=dest/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
            for dep in re.findall(r'(?:from\s+|import\s+)"([^"]+)"',source.read_text()):
                path=(ROOT/'contracts'/dep if dep.startswith('forge-std/') else source.parent/dep).resolve()
                pending.append(path.relative_to(ROOT))
        shutil.copytree(ROOT/'contracts/test/fixtures/bitcoin',dest/'contracts/test/fixtures/bitcoin')
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
fs_permissions=[{access="read",path="./contracts/test/fixtures/bitcoin"}]
fuzz={runs=2500,seed="0x420"}
''')
        command=[os.environ.get('BTC_FORGE','forge'),'test','--root',folder,'--use',args.solc,'--match-path','contracts/test/'+args.match,'-vv']
        if args.exclude_test:command+=['--no-match-test',args.exclude_test]
        if args.match_test:command+=['--match-test',args.match_test]
        result=subprocess.run(command,check=False)
        raise SystemExit(result.returncode)

if __name__=='__main__':main()
