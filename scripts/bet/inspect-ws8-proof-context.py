#!/usr/bin/env python3
"""Compare actual production context with immutable historical WS2/WS3 statements.
This report is compatibility and identity evidence, not Level 2 acceptance.
"""
import json,re,sys
from pathlib import Path
FR=21888242871839275222246405745257275088548364400416034343698204186575808495617
ROOT=Path(__file__).resolve().parents[2]
if len(sys.argv)!=3:raise SystemExit('usage: inspect-ws8-proof-context.py executed-forge.log report.json')
raw=Path(sys.argv[1]).read_text(encoding='utf-8')
m=re.search(r'WS8ProverHandScope\([^\n]*?scope:\s*(\d+)',raw)
if not m:raise SystemExit('missing actual contract-derived hand scope')
scope=int(m[1])
if not 0<scope<FR:raise SystemExit('invalid BN254 hand scope')
bundle=ROOT/'clients/420bet-poker/zkshuffle/fixtures/ws8'
comparisons=[]
for old in json.loads((bundle/'historical-contexts.json').read_text(encoding='utf-8')):
 family=old['family']
 name={'initial':'WS8Initial','shuffle1':'WS8Shuffle1','shuffle2':'WS8Shuffle2','aggregate':'WS8Aggregate'}.get(family)
 if family=='recipient':name='WS8Recipient'+str(old['seat'])
 if family=='delivery':name='WS8Delivery'+str(old['position'])+str(old['provider'])
 new=json.loads((bundle/'proofs'/(name+'SolidityFixture.json')).read_text(encoding='utf-8'))['public']
 differences=[i for i,(a,b) in enumerate(zip(old['public'],new)) if int(a)!=int(b)]
 if len(old['public'])!=len(new):raise SystemExit('historical/current public schema differs: '+name)
 comparisons.append(dict(name=name,historicalPublic=old['public'],productionPublic=new,changedPublicIndices=differences,proofReusable=not differences))
identities=[]
for line in raw.splitlines():
 if 'emit WS8VerifierIdentity(' not in line:continue
 ident={}
 for field in ['verifyingKeyHash','runtimeCodeHash','circuitHash','schemaHash']:
  m=re.search(field+r': (0x[0-9a-fA-F]{64})',line)
  if not m:raise SystemExit('missing actual verifier identity '+field)
  ident[field]=m[1]
 ident['index']=int(re.search(r'index: (\d+)',line)[1])
 segment=line.split('verifier: ',1)[1].split(', verifyingKeyHash:',1)[0]
 ident['verifierAddress']=re.search(r'0x[0-9a-fA-F]{40}',segment)[0]
 identities.append(ident)
if len(identities)!=7 or len({x['index'] for x in identities})!=7:raise SystemExit('seven actual verifier runtime identities required')
native=[]
for line in raw.splitlines():
 if 'emit WS8NativeImplementationIdentity(' not in line:continue
 role=re.search(r'role: "([^"]+)"',line)[1]
 address=re.search(r'0x[0-9a-fA-F]{40}',line.split('implementation: ',1)[1])[0]
 codehash=re.search(r'runtimeCodeHash: (0x[0-9a-fA-F]{64})',line)[1]
 size=int(re.search(r'runtimeBytes: (\d+)',line)[1])
 if not 0<size<=24576:raise SystemExit('actual native runtime exceeds EIP-170: '+role)
 native.append(dict(role=role,address=address,runtimeCodeHash=codehash,runtimeBytes=size))
expected={'engine','clock','admission','play','custody','settlement','admission-factory','play-factory','custody-factory','settlement-factory'}
if len(native)!=10 or {x['role'] for x in native}!=expected:raise SystemExit('ten actual fixed native implementation identities required')
report=dict(contractDerivedHandScope=str(scope),previousProofScope='420',scopeCompatibleWithPreviouslyQualifiedWS2WS3=scope==420,
 historicalStatementComparisons=comparisons,actualVerifierIdentities=identities,actualNativeIdentities=native,
 provingMaterial='Historical archives contain no proving keys. New experimental exact-relation fixture keys were persisted and reused for all context-specific proofs; no old proof was relabelled.',
 qualification='CONTEXT/IDENTITY REPORT ONLY; actual cryptographic verification and funded execution are separate mandatory gates')
out=Path(sys.argv[2]);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('Exported seven actual verifier identities and',len(comparisons),'historical statement comparisons')
