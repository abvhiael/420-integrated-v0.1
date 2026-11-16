#!/usr/bin/env python3
"""Compile unchanged production imports and enforce EVM deployment size bounds."""
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
pending = [ROOT/'contracts/src/bridge/verifiers/TronFinalityVerifier420.sol',
           ROOT/'contracts/src/bridge/adapters/TronBridgeAdapter420.sol']
sources = {}
while pending:
    p = pending.pop().resolve()
    rel = str(p.relative_to(ROOT))
    if rel in sources:
        continue
    source = p.read_text()
    sources[rel] = {'content': source}
    for dep in re.findall(r'(?:from\s+|import\s+)"([^"]+)"', source):
        pending.append(p.parent/dep)
request = {'language':'Solidity','sources':sources,'settings':{
    'evmVersion':'cancun','optimizer':{'enabled':True,'runs':200},'viaIR':True,
    'outputSelection':{'*':{'*':['evm.bytecode.object','evm.deployedBytecode.object']}}}}
result = subprocess.run([os.environ.get('TRON_SOLC','solc'),'--standard-json'],
    input=json.dumps(request),text=True,capture_output=True,check=True)
data = json.loads(result.stdout)
errors = [e for e in data.get('errors',[]) if e['severity']=='error']
if errors:
    raise RuntimeError(errors)
sizes = {}
for contracts in data['contracts'].values():
    for name,c in contracts.items():
        if not name.startswith('Tron'):
            continue
        init = len(c['evm']['bytecode']['object'])//2
        run = len(c['evm']['deployedBytecode']['object'])//2
        if init > 49152 or run > 24576:
            raise RuntimeError((name,init,run))
        sizes[name]={'init_bytes':init,'runtime_bytes':run}
if 'TronFinalityVerifier420' not in sizes or 'TronBridgeAdapter420' not in sizes:
    raise RuntimeError('production artifacts missing')
print(json.dumps(sizes,indent=2))
