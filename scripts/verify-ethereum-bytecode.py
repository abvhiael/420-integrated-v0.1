#!/usr/bin/env python3
"""Compile only the Ethereum production import closure and enforce Cancun size limits."""
import json,re,subprocess
from pathlib import Path
import argparse
p=argparse.ArgumentParser();p.add_argument("--solc",default="solc");a=p.parse_args()
root=Path(__file__).resolve().parents[1]
import os
os.chdir(root)
pending=[Path('contracts/src/bridge/EthereumDepositGateway420.sol')]+list(Path('contracts/src/bridge/verifiers').glob('Ethereum*420.sol'))+[Path('contracts/src/bridge/adapters/EthereumBridgeAdapter420.sol')];sources={}
while pending:
 p=pending.pop();p=Path(p.resolve().relative_to(root))
 if str(p) in sources:continue
 content=p.read_text();sources[str(p)]={'content':content}
 for imp in re.findall(r'(?:from\s+|import\s+)"([^"]+)"',content):pending.append(p.parent/imp)
spec={'language':'Solidity','sources':sources,'settings':{'optimizer':{'enabled':True,'runs':200},'viaIR':True,'evmVersion':'cancun','outputSelection':{'*':{'*':['evm.bytecode.object','evm.deployedBytecode.object']}}}}
p=subprocess.run([a.solc,'--standard-json'],input=json.dumps(spec),text=True,capture_output=True,check=True);d=json.loads(p.stdout);assert not [e for e in d.get('errors',[]) if e['severity']=='error'],d.get('errors')
names=['EthereumConsensusLightClient420','EthereumFinalityVerifier420','EthereumGatewayMessageVerifier420','EthereumBridgeAdapter420','EthereumDepositGateway420','SP1Verifier'];sizes={}
for file,contracts in d['contracts'].items():
 for name,c in contracts.items():
  if name in names:
   init=len(c['evm']['bytecode']['object'])//2;runtime=len(c['evm']['deployedBytecode']['object'])//2;assert init<=49152 and runtime<=24576,(name,init,runtime);sizes[name]={'creation_bytes':init,'runtime_bytes':runtime}
assert len(sizes)==len(names)
Path('contracts/test/fixtures/ethereum/qualification/bytecode-sizes.json').write_text(json.dumps({'solc':'0.8.24','evm':'cancun','optimizer_runs':200,'via_ir':True,'contracts':sizes},indent=2)+'\n');print(json.dumps(sizes,indent=2))
