import json,pathlib,re,subprocess
root=pathlib.Path(__file__).resolve().parents[1];pending=list((root/'contracts/src/bridge/verifiers').glob('Bnb*.sol'))+list((root/'contracts/src/bridge/verifiers/bnb').glob('*.sol'))+[root/'contracts/src/bridge/BnbDepositGateway420.sol',root/'contracts/src/bridge/adapters/BnbBridgeAdapter420.sol'];sources={}
while pending:
 p=pending.pop().resolve();rel=str(p.relative_to(root))
 if rel in sources:continue
 s=p.read_text();sources[rel]={'content':s}
 for dep in re.findall(r'(?:from\s+|import\s+)"([^"]+)"',s):pending.append(p.parent/dep)
request={'language':'Solidity','sources':sources,'settings':{'evmVersion':'cancun','optimizer':{'enabled':True,'runs':200},'viaIR':True,'outputSelection':{'*':{'*':['evm.bytecode.object','evm.deployedBytecode.object']}}}}
p=subprocess.run([__import__('os').environ.get('BNB_SOLC','solc'),'--standard-json'],input=json.dumps(request),text=True,capture_output=True,check=True);data=json.loads(p.stdout);errors=[x for x in data.get('errors',[]) if x['severity']=='error'];assert not errors,errors
sizes={}
for f,cs in data['contracts'].items():
 for name,c in cs.items():
  if not name.startswith('Bnb') or name.endswith('Vm420'):continue
  init=len(c['evm']['bytecode']['object'])//2;run=len(c['evm']['deployedBytecode']['object'])//2
  assert init<=49152 and run<=24576,(name,init,run)
  sizes[name]={'init_bytes':init,'runtime_bytes':run}
print(json.dumps(sizes,indent=2));pass
