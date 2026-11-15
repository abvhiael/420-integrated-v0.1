#!/usr/bin/env python3
"""Reproduce historical signature/wire facts; RPC execution/finality stays untrusted."""
import os,zipfile,tempfile
from pathlib import Path
os.chdir(Path(__file__).resolve().parents[2])
import pathlib,json,base64,hashlib,base58,collections
from eth_abi import encode
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
r=pathlib.Path('contracts/test/fixtures/solana')
sha=lambda b:hashlib.sha256(b).digest()
def parse(raw,loaded):
 def compact(at):
  v=0
  for i in range(3):
   c=raw[at+i];assert i!=2 or c<4;v|=(c&127)<<(7*i)
   if c<128:
    assert i==0 or c!=0
    return v,at+i+1
  assert False
 version=1 if raw[0]==129 else None
 if version==1:
  ns,rs,ru=raw[1:4];assert 0<ns<=12 and rs<ns;sigat=len(raw)-64*ns;message=raw[:sigat];sigs=[raw[sigat+64*i:sigat+64*(i+1)] for i in range(ns)]
  count,n=raw[40:42];assert 0<count<=64 and ns+ru<=n<=64;keys=[raw[42+32*i:74+32*i] for i in range(n)];at=42+32*n;mask=int.from_bytes(raw[4:8],'little');assert mask<=31 and mask&3 in (0,3)
  for bit in range(5):
   if mask>>bit&1:
    if bit==4:assert 32768<=int.from_bytes(raw[at:at+4],'little')<=262144 and int.from_bytes(raw[at:at+4],'little')%1024==0
    at+=4
  headers=[raw[at+4*i:at+4*i+4] for i in range(count)];at+=count*4;instructions=[]
  for h in headers:
   pi,na=h[:2];nd=int.from_bytes(h[2:],'little');acc=raw[at:at+na];at+=na;data=raw[at:at+nd];at+=nd;assert pi<n and all(a<n for a in acc);instructions.append((pi,acc,data))
  assert at==sigat
 else:
  ns,at=compact(0);assert 0<ns<=64;sigs=[raw[at+64*i:at+64*(i+1)] for i in range(ns)];at+=64*ns;message=raw[at:];version=0 if raw[at]==128 else 'legacy'
  if version==0:at+=1
  nr,rs,ru=raw[at:at+3];at+=3;assert nr==ns and rs<ns;n,at=compact(at);assert ns+ru<=n<=256;keys=[raw[at+32*i:at+32*i+32] for i in range(n)];at+=32*n+32;count,at=compact(at);instructions=[]
  for i in range(count):
   pi=raw[at];at+=1;na,at=compact(at);acc=raw[at:at+na];at+=na;nd,at=compact(at);data=raw[at:at+nd];at+=nd;instructions.append((pi,acc,data))
  nw=nr_=0
  if version==0:
   nc,at=compact(at)
   for i in range(nc):
    at+=32;na,at=compact(at);nw+=na;at+=na;na,at=compact(at);nr_+=na;at+=na
  assert at==len(raw);assert nw==len(loaded.get('writable',[])) and nr_==len(loaded.get('readonly',[]))
  keys += [base58.b58decode(k) for k in loaded.get('writable',[])+loaded.get('readonly',[])]
 assert len(keys)==len(set(keys))
 for k,s in zip(keys[:ns],sigs):Ed25519PublicKey.from_public_bytes(k).verify(s,message)
 return {'version':version,'keys':keys,'message':message,'signature':sigs[0],'instructions':instructions,'signatures':sigs}
archive=zipfile.ZipFile(r/'rpc-observations.zip')
b=json.loads(archive.read('block-459652999.json'))['result'];counts=collections.Counter();selected={}
for i,t in enumerate(b['transactions']):
 raw=base64.b64decode(t['transaction'][0]);loaded=t['meta'].get('loadedAddresses') or {'writable':[],'readonly':[]}
 try:p=parse(raw,loaded)
 except Exception as e:raise RuntimeError(('bad transaction',i,t['version'],str(e))) from e
 assert str(p['version'])==str(t['version']);counts[str(p['version'])]+=1
 if t['meta']['err'] is None:
  name='legacy' if p['version']=='legacy' else 'v'+str(p['version'])
  if name not in selected:selected[name]=(raw,loaded,p,b['blockhash'],459652999)
  for pi,acc,data in p['instructions']:
   if p['keys'][pi]==bytes(32) and data[:4]==b'\x02\0\0\0' and len(data)==12:selected.setdefault('native',(raw,loaded,p,b['blockhash'],459652999))
for name in ['ray','eurc']:
 t=json.loads(archive.read(f'historical-{name}.json'));raw=base64.b64decode(t['transaction'][0]);loaded=t['meta'].get('loadedAddresses') or {'writable':[],'readonly':[]};p=parse(raw,loaded);assert t['meta']['err'] is None;selected[name]=(raw,loaded,p,None,t['slot'])
expected=[]
qualified_ids={sha(item[2]['signature']) for item in selected.values()}
remaining=[]
for t in b['transactions']:
 raw=base64.b64decode(t['transaction'][0]);loaded=t['meta'].get('loadedAddresses') or {'writable':[],'readonly':[]}
 parsed=parse(raw,loaded)
 if sha(parsed['signature']) not in qualified_ids:remaining.append((raw,[base58.b58decode(x) for x in loaded.get('writable',[])],[base58.b58decode(x) for x in loaded.get('readonly',[])],sha(parsed['signature']),sha(parsed['message'])))
(r/'historical-remaining-block.bin').write_bytes(encode(['(bytes,bytes32[],bytes32[],bytes32,bytes32)[]'],[remaining]))
print('Prepared',len(remaining),'previously untested block transactions; retained six existing on-chain vectors')
for name,(raw,loaded,p,blockhash,slot) in selected.items():
 args=(raw,[base58.b58decode(x) for x in loaded.get('writable',[])],[base58.b58decode(x) for x in loaded.get('readonly',[])],sha(p['signature']),sha(p['message']))
 (r/f'historical-{name}.bin').write_bytes(encode(['bytes','bytes32[]','bytes32[]','bytes32','bytes32'],args))
 expected.append({'name':name,'slot':slot,'version':p['version'],'primary_signature_base58':base58.b58encode(p['signature']).decode(),'signature_id_sha256':sha(p['signature']).hex(),'message_sha256':sha(p['message']).hex(),'finality':'RPC observation only; NOT a validator/quorum certificate'})
(r/'historical-expected.json').write_text(json.dumps({'block_transaction_counts':dict(counts),'total_transactions':sum(counts.values()),'selected':expected},indent=2)+'\n')
print('PASS independently verified all',sum(counts.values()),'historical block transactions and two token transactions; versions',dict(counts))
print('Signature identity only. Historical finality and execution metadata are NOT authenticated by this check.')

account=json.loads(archive.read('solana-token-program-data.json'))['result']['value']
elf=base64.b64decode(account['data'][0])[45:]
assert elf== (r/'spl_token.so').read_bytes(), 'Observed Tokenkeg ELF differs'
print('PASS observed Tokenkeg executable bytes; account authenticity remains unproven')
