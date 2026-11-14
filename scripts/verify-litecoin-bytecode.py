#!/usr/bin/env python3
"""Compile only the Litecoin production import closure and enforce Cancun deployment limits."""
import argparse,json,re,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--solc',default='solc');a=p.parse_args();root=Path(__file__).resolve().parents[1]
pending=list((root/'contracts/src/bridge/verifiers').glob('Litecoin*420.sol'))+[root/'contracts/src/bridge/adapters/LitecoinBridgeAdapter420.sol'];sources={}
while pending:
 path=pending.pop().resolve();name=str(path.relative_to(root))
 if name in sources:continue
 text=path.read_text();sources[name]={'content':text}
 for imp in re.findall(r'(?:from\s+|import\s+)"([^"]+)"',text):pending.append(path.parent/imp)
spec={'language':'Solidity','sources':sources,'settings':{'optimizer':{'enabled':True,'runs':200},'viaIR':True,'evmVersion':'cancun','outputSelection':{'*':{'*':['evm.bytecode.object','evm.deployedBytecode.object']}}}}
r=subprocess.run([a.solc,'--standard-json'],input=json.dumps(spec),capture_output=True,text=True,check=True);d=json.loads(r.stdout);assert not [e for e in d.get('errors',[]) if e['severity']=='error'];sizes={}
for file,contracts in d['contracts'].items():
 for name,c in contracts.items():
  if name in ['LitecoinScrypt420','LitecoinHeaderChain420','LitecoinFinalityVerifier420','LitecoinBridgeAdapter420']:
   init=len(c['evm']['bytecode']['object'])//2;runtime=len(c['evm']['deployedBytecode']['object'])//2;assert init<=49152 and runtime<=24576,(name,init,runtime);sizes[name]={'creation_bytes':init,'runtime_bytes':runtime}
assert len(sizes)==4
(root/'contracts/test/fixtures/litecoin/qualification/bytecode-sizes.json').write_text(json.dumps(sizes,indent=2)+'\n');print(json.dumps(sizes,indent=2))
