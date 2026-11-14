#!/usr/bin/env python3
"""Qualify unmodified Ethereum verifier/route test import closures, not unrelated apps."""
import argparse
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
ROOT=Path(__file__).resolve().parents[1]
HARDENING=['VerifierRotationHardening420.t.sol','EmergencyControlsHardening420.t.sol','CrossAdapterHardeningBridgeAdapter420.t.sol','DomainNonceRouterBypassHardening420.t.sol','MalformedProofRecipientFuzzHardening420.t.sol']
ROUTES=['AaveBridgeAdapter420.t.sol','AudioBridgeAdapter420.t.sol','EurcBridgeAdapter420.t.sol','LinkBridgeAdapter420.t.sol','QcadBridgeAdapter420.t.sol','UniBridgeAdapter420.t.sol','UsdtBridgeAdapter420.t.sol']
def main():
    p=argparse.ArgumentParser();p.add_argument('--match',default='Ethereum*420.t.sol');p.add_argument('--match-test');p.add_argument('--solc',default='0.8.24');p.add_argument('--routes',action='store_true');p.add_argument('--trace',action='store_true');p.add_argument('--hardening',action='store_true');a=p.parse_args()
    tests=list((ROOT/'contracts/test').glob(a.match))
    if a.routes:tests += [ROOT/'contracts/test'/name for name in ROUTES]
    primary_tests=list(tests)
    if a.hardening:tests += [ROOT/'contracts/test'/name for name in HARDENING]
    if not tests:raise RuntimeError('No Ethereum test owners selected')
    with tempfile.TemporaryDirectory(prefix='ethereum-qualification-') as folder:
        dest=Path(folder);pending=[p.relative_to(ROOT) for p in tests];seen=set()
        while pending:
            rel=pending.pop()
            if rel in seen:continue
            seen.add(rel);source=(ROOT/rel).resolve();source.relative_to(ROOT)
            target=dest/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
            for dep in re.findall(r'(?:from\s+|import\s+)"([^"]+)"',source.read_text()):
                path=(ROOT/'contracts'/dep if dep.startswith('forge-std/') else source.parent/dep).resolve()
                pending.append(path.relative_to(ROOT))
        shutil.copytree(ROOT/'contracts/test/fixtures/ethereum',dest/'contracts/test/fixtures/ethereum')
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
fs_permissions=[{access="read",path="./contracts/test/fixtures/ethereum"}]
fuzz={runs=2500,seed="0x420"}
[invariant]
runs=128
depth=64
fail_on_revert=true
''')
        command=[os.environ.get('ETH_FORGE','forge'),'test','--root',folder,'--use',a.solc,'-vvvv' if a.trace else '-vv']
        if a.match_test:command+=['--match-test',a.match_test]
        elif a.hardening:
            names=set()
            for path in primary_tests:
                names.update(re.findall(r'function\s+(test\w+|invariant\w+)\s*\(',path.read_text()))
            for name in HARDENING:
                names.update(n for n in re.findall(r'function\s+(test\w+)\s*\(',(ROOT/'contracts/test'/name).read_text()) if 'Solana' not in n)
            command+=['--match-test','^(?:'+'|'.join(sorted(names))+')(?:\\(|$)']
        # All copied test files are deliberate owners; imports can add helper tests,
        # so callers selecting one owner also constrain its source path.
        if not a.routes and not a.hardening:command+=['--match-path','contracts/test/'+a.match]
        result=subprocess.run(command,check=False,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
        print(result.stdout,end='')
        if result.returncode==0 and not re.search(r'\b[1-9][0-9]* tests? passed',result.stdout):raise RuntimeError('Qualification executed zero passing tests')
        raise SystemExit(result.returncode)
if __name__=='__main__':main()
