#!/usr/bin/env python3
"""Generate current Bridge ABI descriptors; deploy addresses remain separate."""
import argparse,hashlib,json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
NAMES=['BridgeChainRegistry420','BridgeAssetRegistry','BridgeRouteRegistry','BridgeRiskManager','BridgeTransferRegistry','BridgeAccountingRegistry','GatewayRouter420','VerifiedGateway420','CADCBridgeIntegration','BridgeVerifierRegistry420','BridgeValueCustody420']
p=argparse.ArgumentParser();p.add_argument('--solc',required=True);p.add_argument('--check',action='store_true');a=p.parse_args()
pending=[ROOT/'contracts/src/bridge'/f'{name}.sol'for name in NAMES];sources={}
while pending:
 f=pending.pop().resolve();rel=str(f.relative_to(ROOT))
 if rel in sources:continue
 text=f.read_text();sources[rel]={'content':text}
 for dep in re.findall(r'(?:from\s+|import\s+)["\x27]([^"\x27]+)["\x27]',text):pending.append((f.parent/dep).resolve())
request={'language':'Solidity','sources':sources,'settings':{'evmVersion':'cancun','optimizer':{'enabled':True,'runs':200},'viaIR':True,'outputSelection':{'*':{'*':['abi']}}}}
r=subprocess.run([a.solc,'--standard-json'],input=json.dumps(request),text=True,capture_output=True,check=True);response=json.loads(r.stdout);assert not [e for e in response.get('errors',[])if e['severity']=='error'],response.get('errors')
contracts=[]
for name in NAMES:
 path=f'contracts/src/bridge/{name}.sol';abi=response['contracts'][path][name]['abi'];events=[]
 for event in abi:
  if event['type']!='event':continue
  inputs=[{'name':i['name'],'type':i['type'],'indexed':bool(i.get('indexed'))}for i in event['inputs']]
  events.append({'name':event['name'],'signature':event['name']+'('+','.join(i['type']for i in inputs)+')','inputs':inputs})
 contracts.append({'contractName':name,'sourcePath':path,'sourceBlobSha':subprocess.check_output(['git','hash-object',path],cwd=ROOT,text=True).strip(),'events':sorted(events,key=lambda e:e['signature'])})
manifest={'schema':'420-bridge-artifact-descriptor-v1','descriptorVersion':1,'protocol':'420Bridge','authority':'artifact_events_only_addresses_resolved_by_deployment','contracts':contracts}
payload=json.dumps(manifest,indent=2)+'\n';dest=ROOT/'420-indexer/descriptors/bridge420-v1.json'
if a.check:assert dest.read_text()==payload,'Bridge descriptor drift'
else:dest.write_text(payload)
print(json.dumps({'pass':True,'contracts':len(contracts),'events':sum(len(c['events'])for c in contracts),'source_closure':len(sources),'sha256':hashlib.sha256(payload.encode()).hexdigest()}))
