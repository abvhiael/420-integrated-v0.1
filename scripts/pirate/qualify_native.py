"""Compare isolated decryption, tree witnesses and received-note nullifiers to native regtest state."""
from pathlib import Path
import argparse
import subprocess,json,os
a=argparse.ArgumentParser();a.add_argument('--workdir',required=True);a.add_argument('--binary',required=True);a.add_argument('--params',required=True);args=a.parse_args()
root=Path(args.workdir).resolve();exe=Path(args.binary).resolve();
base={'raw_file':'','branch_id':0x37a5165b}
def call(req,key=None):
 (root/'request.json').write_text(json.dumps(req));a=[str(exe),str(root/'request.json')]
 if key:a += [str(key),str(Path(args.params).resolve())]
 r=subprocess.run(a,capture_output=True,text=True)
 if r.returncode:raise RuntimeError(r.stderr)
 return json.loads(r.stdout)
leaves={0:[],1:[]};targets={}
for path in sorted(root.glob('block-*.bin'),key=lambda p:int(p.stem.split('-')[-1])):
 height=int(path.stem.split('-')[-1]);desc=call(dict(base,mode='inspect-block',raw_file=str(path)))
 for t in desc['transactions']:
  for pool,field in [(0,'sapling_outputs'),(1,'ironwood_outputs')]:
   for i,cm in enumerate(t[field]):
    for name in ['sapling','ironwood']:
     txj=json.loads((root/(name+'-tx.json')).read_text())
     if t['txid']==bytes.fromhex(txj['txid'])[::-1].hex() and pool==(0 if name=='sapling' else 1):targets[(name,i)]=(len(leaves[pool]),height)
    leaves[pool].append(cm)
for name,pool in [('sapling',0),('ironwood',1)]:
 decoded=(root/(name+'-viewing.decoded.private'))
 if not decoded.exists():
  s=(root/(name+'-viewing.private')).read_text().strip().rsplit('1',1)[1];alpha='qpzry9x8gf2tvdw0s3jn54khce6mua7l';v=bits=0;out=bytearray()
  for ch in s[:-6]:
   v=(v<<5)|alpha.index(ch);bits+=5
   if bits>=8:bits-=8;out.append((v>>bits)&255)
  decoded.write_bytes(out);decoded.chmod(0o600)
 key=root/(name+'-fvk.private');key.write_bytes(decoded.read_bytes()[41:137]);key.chmod(0o600)
 for (target,index),(position,height) in targets.items():
  if target!=name:continue
  w=call(dict(base,mode='witness',pool=pool,position=position,commitments=leaves[pool]));block=json.loads((root/'block-18.json').read_text());native=block['finalsaplingroot' if pool==0 else 'finalironwoodroot'];print(name,index,'tree matches native',w['root']==(bytes.fromhex(native)[::-1].hex() if pool==0 else native),flush=True)
  if w['root']!=(bytes.fromhex(native)[::-1].hex() if pool==0 else native):raise RuntimeError('native tree mismatch')
  req=dict(base,mode='decrypt',raw_file=str(root/(name+'-tx.bin')),pool=pool,output_index=index,**w)
  try:
   result=call(req,key);(root/(name+'-receipt.json')).write_text(json.dumps(result,indent=2));(root/(name+'-decrypt.json')).write_text(json.dumps(req,indent=2));print(name,index,'ownership verified',flush=True)
  except RuntimeError as e:print(name,index,'rejected',flush=True)

for pool in ['sapling','ironwood']:
 receipt=json.loads((root/(pool+'-receipt.json')).read_text())
 spend=json.loads((root/('ironwood-tx.json' if pool=='sapling' else 'ironwood-spend.json')).read_text())
 nfs=[x['nullifier'] for x in (spend['vShieldedSpend'] if pool=='sapling' else spend['ironwood']['actions'])]
 nf=bytes.fromhex(receipt['nullifier'])[::-1].hex() if pool=='sapling' else receipt['nullifier']
 if nf not in nfs:raise RuntimeError('received-note nullifier differs from native spend')
 print(pool,'received-note nullifier matched subsequent native spend',flush=True)
