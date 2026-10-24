#!/usr/bin/env python3
"""Record or verify source-bound genuine WS8 evidence; never assert test success."""
import hashlib,json,shutil,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BUNDLE=ROOT/'clients/420bet-poker/zkshuffle/fixtures/ws8'
def digest(p):
 data=p.read_bytes()
 if p.suffix in {'.go','.sol'}:data=data.replace(b'\r\n',b'\n')
 return hashlib.sha256(data).hexdigest()
if sys.argv[1:]==['--record']:
 material=ROOT/'artifacts/contracts/ws8-material';runtime=ROOT/'artifacts/contracts/ws8'
 (BUNDLE/'keys').mkdir(parents=True,exist_ok=True);(BUNDLE/'proofs').mkdir(exist_ok=True)
 names=['InitialDeck52','Reencrypt52','Delivery','RecipientPoP','Aggregate','Partial','Unmask']
 keys=[]
 for name in names:
  shutil.copyfile(material/(name+'.vk'),BUNDLE/'keys'/(name+'.vk'))
  keys.append(dict(name=name,relationSHA256=digest(material/(name+'.r1cs'))))
 for name in ['context.bin','context.json','rounds.bin']:
  shutil.copyfile(runtime/name,BUNDLE/name)
 proofs=[]
 for p in sorted((runtime/'proofs').iterdir()):
  if p.name.endswith(('.abi','.points','.public')) or p.name in ['roots.bin','deck-0.bin','deck-1.bin','deck-2.bin']:
   shutil.copyfile(p,BUNDLE/'proofs'/p.name)
  elif p.name.startswith('EXPERIMENTAL-') and p.name.endswith(('Proof.bin','SolidityFixture.json')):
   shutil.copyfile(p,BUNDLE/'proofs'/p.name.removeprefix('EXPERIMENTAL-'))
 for p in sorted((BUNDLE/'proofs').glob('*.abi')):
  name=p.stem
  key=next((key for prefix,key in [('WS8Initial','InitialDeck52'),('WS8Shuffle','Reencrypt52'),('WS8Delivery','Delivery'),('WS8Recipient','RecipientPoP'),('WS8Aggregate','Aggregate'),('WS8Partial','Partial'),('WS8Unmask','Unmask')] if name.startswith(prefix)),None)
  if key is None:raise SystemExit('unknown proof family '+name)
  proofs.append(dict(name=name,key=key))
 if len(proofs)!=41:raise SystemExit('41 genuine proof records required')
 for p in BUNDLE.rglob('*.json'):p.write_bytes(p.read_bytes().replace(b'\r\n',b'\n'))
 files=[p for p in BUNDLE.rglob('*') if p.is_file() and p.name!='manifest.json']
 files+=list((ROOT/'contracts/src/bet/generated').glob('WS8*.sol'))
 files+=list((ROOT/'clients/420bet-poker/zkshuffle').glob('*_circuit.go'))
 files+=[ROOT/'clients/420bet-poker/zkshuffle/ciphertext_merkle.go']
 manifest=dict(format=1,setup='experimental qualification fixture; not a production trusted ceremony',keys=keys,proofs=proofs,
  files={p.relative_to(ROOT).as_posix():digest(p) for p in sorted(set(files))},
  historicalArtifacts={'WS2':dict(run=40003702620,artifact=12522623783,zipSHA256='c591c05daaaad50ed82d0add978b901683452a72f349450f3d14f53ddac20e9c'),'WS3':dict(run=40013195917,artifact=12527008958,zipSHA256='74b557d7c11d4a9d892177e18ad0d1fa3d2496aafaf009e7f2f7d50aafbe938b')})
 (BUNDLE/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8',newline='\n')
 print('Recorded source/checksum identities for seven keys and 41 genuine proofs')
elif sys.argv[1:]==['--verify']:
 manifest=json.loads((BUNDLE/'manifest.json').read_text(encoding='utf-8'))
 for name,expected in manifest['files'].items():
  p=ROOT/name
  if not p.is_file() or digest(p)!=expected:raise SystemExit('WS8 evidence checksum mismatch: '+name)
 if len(manifest['keys'])!=7 or len(manifest['proofs'])!=41:raise SystemExit('incomplete evidence')
 print('WS8 evidence checksums match; cryptographic and funded tests must execute separately')
else:raise SystemExit('usage: package-ws8-evidence.py --record|--verify')
