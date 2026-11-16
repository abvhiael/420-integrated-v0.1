#!/usr/bin/env python3
"""Run only V.19 and the affected shared bridge owners on their exact import closure."""
import argparse,hashlib,json,os,re,shutil,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
 p=argparse.ArgumentParser();p.add_argument('--solc',default='0.8.24');p.add_argument('--forge',default='forge');p.add_argument('--owners',nargs='+',default=['BridgeVerifierIdentity420.t.sol','BridgeVerifierIdentityInvariant420.t.sol','BridgeVerifierRouteIdentity420.t.sol','BridgeGenesisIntegration420.t.sol','BridgeRouteChainIdentity420.t.sol','BitcoinGatewayIntegration420.t.sol']);p.add_argument('--match-test');p.add_argument('--match-contract');p.add_argument('--log',required=True);a=p.parse_args()
 with tempfile.TemporaryDirectory(prefix='bridge-identity-qualification-') as folder:
  dest=Path(folder);pending=[Path('contracts/test')/name for name in a.owners];seen=set()
  while pending:
   rel=pending.pop()
   if rel in seen:continue
   seen.add(rel);source=ROOT/rel;target=dest/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
   for dependency in re.findall(r'(?:from\s+|import\s+)"([^"]+)"',source.read_text()):
    path=(ROOT/'contracts'/dependency if dependency.startswith('forge-std/') else source.parent/dependency).resolve();pending.append(path.relative_to(ROOT))
  shutil.copytree(ROOT/'contracts/test/fixtures/verifier-identity',dest/'contracts/test/fixtures/verifier-identity')
  (dest/'foundry.toml').write_text('''[profile.default]
src="contracts/src"
test="contracts/test"
solc_version="0.8.24"
evm_version="cancun"
optimizer=true
optimizer_runs=200
via_ir=true
ffi=false
fs_permissions=[{access="read",path="./contracts/test/fixtures/verifier-identity"}]
gas_limit=9223372036854775807
code_size_limit=1000000
remappings=["forge-std/=contracts/forge-std/"]
fuzz={runs=2500,seed="0x42019"}
[invariant]
runs=128
depth=64
fail_on_revert=true
''')
  command=[a.forge,'test','--root',folder,'--use',a.solc,'--threads','2','--match-path','contracts/test/{'+','.join(a.owners)+'}','-vv']
  if a.match_test:command+=['--match-test',a.match_test]
  if a.match_contract:command+=['--match-contract',a.match_contract]
  inputs={str(path):hashlib.sha256((ROOT/path).read_bytes()).hexdigest() for path in sorted(seen)}
  for path in (ROOT/'contracts/test/fixtures/verifier-identity').rglob('*'):
   if path.is_file():inputs[str(path.relative_to(ROOT))]=hashlib.sha256(path.read_bytes()).hexdigest()
  Path(a.log).parent.mkdir(parents=True,exist_ok=True)
  Path(a.log).with_suffix('.inputs.json').write_text(json.dumps({'command':command,'owners':a.owners,'source_sha256':inputs,'foundry_config':(dest/'foundry.toml').read_text()},indent=2,sort_keys=True)+'\n')
  result=subprocess.run(command,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT);Path(a.log).parent.mkdir(parents=True,exist_ok=True);Path(a.log).write_text(result.stdout);print(result.stdout,end='')
  if result.returncode==0 and not re.search(r'[1-9][0-9]* tests? passed',result.stdout):raise RuntimeError('zero passing tests')
  if result.returncode==0:
   sizes={}
   for name in ['BridgeVerifierRegistry420','BridgeVerifierProxy420','BridgeChainRegistry420','BridgeRouteRegistry','GatewayRouter420','VerifiedGateway420']:
    path=dest/'out'/(name+'.sol')/(name+'.json')
    if path.exists():
     artifact=json.loads(path.read_text());size=len(artifact['deployedBytecode']['object'].removeprefix('0x'))//2;assert size<=24576,(name,size);sizes[name]=size
   Path(a.log).with_suffix('.bytecode.json').write_text(json.dumps(sizes,indent=2,sort_keys=True)+'\n')
  raise SystemExit(result.returncode)
if __name__=='__main__':main()
