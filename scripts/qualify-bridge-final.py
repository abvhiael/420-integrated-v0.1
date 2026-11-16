#!/usr/bin/env python3
"""Compile the reconciled verifier graph once; run only integration-invalidated owners."""
import argparse,hashlib,json,re,shutil,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OWNERS=['BridgeCanonicalEnvelope420.t.sol', 'BridgeFinalAdmission420.t.sol', 'SupportedTokenRoutes420.t.sol', 'TokenGatewayRouterIntegration420.t.sol', 'EthereumGatewaySharedIntegration420.t.sol', 'LitecoinGatewayIntegration420.t.sol', 'DogecoinGatewayIntegration420.t.sol', 'CCTPGatewayIntegration420.t.sol', 'CADCLayerZero420.t.sol', 'CADCGatewayIntegration420.t.sol', 'BridgeGenesisIntegration420.t.sol', 'BridgeVerifierRouteIdentity420.t.sol', 'BridgeProductionAdmission420.t.sol', 'BridgeProductionAdmissionInvariant420.t.sol', 'BridgeFullLocalIntegration420.t.sol', 'BridgeFullLocalInvariant420.t.sol', 'BridgeSettlementBoundary420.t.sol', 'PaySwapBridgeGenesisIntegration420.t.sol', 'BitcoinGatewayIntegration420.t.sol', 'BridgeTransferLifecycle420.t.sol']
def main():
 p=argparse.ArgumentParser();p.add_argument('--forge',required=True);p.add_argument('--solc',required=True);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--group',choices=['build','integration','cadc-router','token-router'],required=True);p.add_argument('--owners',nargs='+');p.add_argument('--match-test');p.add_argument('--exclude-contract',nargs='*',default=[]);p.add_argument('--log',type=Path,required=True);a=p.parse_args();dest=a.workspace.resolve();dest.mkdir(parents=True,exist_ok=True)
 if a.group!='build' and not a.owners:p.error('--owners must name the affected test owners; see retained command manifests')
 marker=dest/'.v22-owned';assert marker.exists() or not any(dest.iterdir()),'refusing foreign workspace';marker.touch()
 owners=a.owners or OWNERS
 pending=([x.relative_to(ROOT) for x in (ROOT/'contracts/src/bridge').rglob('*.sol')] if a.group=='build' else [Path('contracts/test')/x for x in owners]);seen=set()
 while pending:
  rel=pending.pop()
  if rel in seen:continue
  seen.add(rel);source=ROOT/rel;target=dest/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
  for dep in re.findall(r'(?:from\s+|import\s+)"([^"]+)"',source.read_text()):
   path=(ROOT/'contracts/test/fixtures/cadc/upstream'/dep if dep.startswith('@') or dep.startswith('solidity-bytes-utils/') else ROOT/'contracts'/dep if dep.startswith('forge-std/') else source.parent/dep).resolve();pending.append(path.relative_to(ROOT))
 for fixture in ['ethereum','bitcoin','bnb','litecoin','dogecoin','cadc','cctp','verifier-identity','solana/outbound-request-v1']:
  src=ROOT/'contracts/test/fixtures'/fixture
  if src.exists():shutil.copytree(src,dest/'contracts/test/fixtures'/fixture,dirs_exist_ok=True)
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
remappings=["forge-std/=contracts/forge-std/","@layerzerolabs/=contracts/test/fixtures/cadc/upstream/@layerzerolabs/","@openzeppelin/=contracts/test/fixtures/cadc/upstream/@openzeppelin/","solidity-bytes-utils/=contracts/test/fixtures/cadc/upstream/solidity-bytes-utils/"]
fs_permissions=[{access="read",path="./contracts/test/fixtures"}]
fuzz={runs=2500,seed="0x42022"}
[invariant]
runs=128
depth=64
fail_on_revert=true
''';(dest/'foundry.toml').write_text(config)
 command=[a.forge,'build' if a.group=='build' else 'test','--root',str(dest),'--use',a.solc,'--threads','2','--no-dynamic-test-linking']
 if a.group!='build':
  command+=['--match-path',('contracts/test/'+owners[0] if len(owners)==1 else 'contracts/test/{'+','.join(owners)+'}'),'-vv']
  command+=['--no-match-contract','CADCGatewayIntegration420Test|TokenGatewayRouterIntegration420Test'] if a.group=='integration' else ['--match-contract','^'+('CADCGatewayIntegration420Test' if a.group=='cadc-router' else 'TokenGatewayRouterIntegration420Test')+'$','--match-test','^testRouter']
 if a.exclude_contract:
  assert a.group=='integration','contract exclusion belongs to integration selection'
  at=command.index('--no-match-contract');command[at+1]+='|'+'|'.join('^'+re.escape(x)+'$' for x in a.exclude_contract)
 if a.match_test:command+=['--match-test',a.match_test]
 a.log.parent.mkdir(parents=True,exist_ok=True);inputs={str(x):hashlib.sha256((ROOT/x).read_bytes()).hexdigest() for x in sorted(seen)}
 a.log.with_suffix('.inputs.json').write_text(json.dumps({'command':command,'source_sha256':inputs,'foundry_config':config,'owners':owners},indent=2,sort_keys=True)+'\n')
 output=[]
 with a.log.open('w') as log:
  process=subprocess.Popen(command,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
  for line in process.stdout:print(line,end='',flush=True);log.write(line);log.flush();output.append(line)
  code=process.wait()
 if code==0:
  if a.group!='build':assert re.search(r'\b[1-9][0-9]* tests? passed', ''.join(output)), 'no executed passing tests; selection is not qualification'
  sizes={}
  for rel in sorted((ROOT/'contracts/src/bridge').rglob('*.sol')):
   folder=dest/'out'/rel.name
   if folder.exists():
    for artifact in folder.glob('*.json'):
     obj=json.loads(artifact.read_text());runtime=obj.get('deployedBytecode',{}).get('object','').removeprefix('0x');size=len(runtime)//2
     if size:sizes[str(rel.relative_to(ROOT))+':'+artifact.stem]=size
  too_large={k:v for k,v in sizes.items() if v>24576};assert not too_large,too_large
  a.log.with_suffix('.bytecode.json').write_text(json.dumps(sizes,indent=2,sort_keys=True)+'\n')
 raise SystemExit(code)
if __name__=='__main__':main()
