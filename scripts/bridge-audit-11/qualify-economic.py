#!/usr/bin/env python3
"""Owner-scoped malicious-token economic qualification; preserve compiler/profile."""
import argparse,hashlib,json,re,shutil,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--forge',required=True);p.add_argument('--solc',required=True);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--match',default='^(testSecurity11|testFuzzSecurity11|invariantSecurity11)');p.add_argument('--log',type=Path,required=True);a=p.parse_args()
dest=a.workspace.resolve();dest.mkdir(parents=True,exist_ok=True);marker=dest/'.security11-owned';assert marker.exists() or not any(dest.iterdir()),'foreign workspace';marker.touch()
pending=[ROOT/'contracts/test/BridgeSecurityEconomic11.t.sol'];seen=set()
while pending:
 file=pending.pop().resolve();rel=file.relative_to(ROOT)
 if rel in seen:continue
 seen.add(rel);target=dest/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(file,target)
 for dep in re.findall(r'(?:from\s+|import\s+)["\x27]([^"\x27]+)["\x27]',file.read_text()):pending.append((ROOT/'contracts'/dep if dep.startswith('forge-std/') else file.parent/dep).resolve())
config='''[profile.default]
src="contracts/src"
test="contracts/test"
evm_version="cancun"
optimizer=true
optimizer_runs=200
via_ir=true
ffi=false
gas_limit=9223372036854775807
code_size_limit=1000000
fuzz={runs=2500,seed="0x42022"}
[invariant]
runs=128
depth=64
fail_on_revert=true
'''
(dest/'foundry.toml').write_text(config)
actual=json.loads(subprocess.check_output([a.forge,'config','--root',str(dest),'--json'],text=True));assert not actual['dynamic_test_linking'] and actual['via_ir'] and actual['optimizer'] and actual['optimizer_runs']==200
command=[a.forge,'test','--root',str(dest),'--use',a.solc,'--threads','2','--match-contract','^BridgeSecurity.*11Test$','--match-test',a.match,'-vv']
a.log.parent.mkdir(parents=True,exist_ok=True);a.log.with_suffix('.inputs.json').write_text(json.dumps({'command':command,'foundry_config':config,'dynamic_test_linking':False,'forge':subprocess.check_output([a.forge,'--version'],text=True),'source_sha256':{str(p):hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in sorted(seen)}},indent=2)+'\n')
with a.log.open('w')as log:
 proc=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 for line in proc.stdout:print(line,end='',flush=True);log.write(line);log.flush()
 code=proc.wait()
if code==0:assert re.search(r'\b[1-9][0-9]* tests? passed',a.log.read_text()),'zero passing tests'
raise SystemExit(code)
