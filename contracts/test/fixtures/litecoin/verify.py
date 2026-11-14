"""Offline independent Litecoin oracle: OpenSSL Scrypt, SHA256d, retargets, MTP and tx Merkle paths."""
import hashlib,json,struct,sys
from pathlib import Path
R=Path(__file__).resolve().parent
LIMIT=int('00000'+'f'*59,16)
def h(b):return hashlib.sha256(hashlib.sha256(b).digest()).digest()
def header(b):return struct.pack('<I',b['version'])+bytes.fromhex(b.get('previousblockhash') or '00'*32)[::-1]+bytes.fromhex(b['merkle_root'])[::-1]+struct.pack('<III',b['timestamp'],b['bits'],b['nonce'])
def target(bits):
 size=bits>>24;word=bits&0x7fffff
 assert word and not bits&0x800000 and size<=34 and not(word>255 and size>33) and not(word>65535 and size>32)
 t=word>>(8*(3-size)) if size<=3 else word<<(8*(size-3));assert 0<t<=LIMIT;return t
def compact(t):
 size=(t.bit_length()+7)//8;word=t<<(8*(3-size)) if size<=3 else t>>(8*(size-3))
 if word&0x800000:word>>=8;size+=1
 return size<<24|word
def retarget(old,span):
 span=max(75600,min(1209600,span));t=target(old);shift=t.bit_length()>LIMIT.bit_length()-1
 if shift:t>>=1
 t=t*span//302400
 if shift:t<<=1
 return compact(min(LIMIT,t))
def cs(b,at):
 x=b[at];at+=1
 if x<253:return x,at
 n={253:2,254:4,255:8}[x];v=int.from_bytes(b[at:at+n],'little');assert v>={253:253,254:65536,255:4294967296}[x];return v,at+n
def transaction(raw):
 at=4;flags=0
 if raw[at]==0:flags=raw[at+1];at+=2
 start=at;n,at=cs(raw,at);assert n;inputs=n
 for i in range(n):at+=36;n,at=cs(raw,at);at+=n+4
 n,at=cs(raw,at);outputs=[]
 for i in range(n):
  value=int.from_bytes(raw[at:at+8],'little');at+=8;n,at=cs(raw,at);outputs.append((value,raw[at:at+n]));at+=n
 end=at
 if flags&1:
  for i in range(inputs):
   n,at=cs(raw,at)
   for j in range(n):size,at=cs(raw,at);at+=size
 if flags&8:assert raw[at]==0;at+=1 # Genuine HogEx marker, not an MWEB body decoder.
 assert not flags&~9 and len(raw)-at==4
 return h(raw[:4]+raw[start:end]+raw[at:]),outputs,raw[:4]+raw[start:end]+raw[at:]
def proof(ids,index):
 nodes=[bytes.fromhex(x)[::-1] for x in ids];path=[];i=index
 while len(nodes)>1:
  if len(nodes)&1:nodes.append(nodes[-1])
  path.append(nodes[i^1]);i//=2;nodes=[h(nodes[j]+nodes[j+1]) for j in range(0,len(nodes),2)]
 return nodes[0],path
def verify_bad_pow():
 raw=bytearray((R/"headers.bin").read_bytes()[80:160]);raw[79]^=1
 digest=hashlib.scrypt(raw,salt=raw,n=1024,r=1,p=1,dklen=32)
 assert (R/"bad-pow.bin").read_bytes()==digest and int.from_bytes(digest,"little")>target(int.from_bytes(raw[72:76],"little"))
 print("PASS: independent mutated-header Scrypt negative vector")
def main(write=False):
 verify_bad_pow()
 blocks=json.loads((R/'blocks.json').read_text());assert len(blocks)==4033;raws=[];expected=[];work=0
 for i,b in enumerate(blocks):
  raw=header(b);raws.append(raw);bid=h(raw);assert b['height']==i and bid[::-1].hex()==b['id']
  if i:assert bid!=h(raws[i-1]) and raw[4:36]==h(raws[i-1]) and b['timestamp']>sorted(x['timestamp'] for x in blocks[max(0,i-11):i])[(min(i,11))//2]
  bits=blocks[i-1]['bits'] if i else 0x1e0ffff0
  if i and i%2016==0:bits=retarget(bits,blocks[i-1]['timestamp']-blocks[0 if i==2016 else i-2017]['timestamp'])
  assert bits==b['bits'],('retarget',i,hex(bits),hex(b['bits']))
  t=target(bits);pow_=hashlib.scrypt(raw,salt=raw,n=1024,r=1,p=1,dklen=32);assert int.from_bytes(pow_,'little')<=t
  w=(1<<256)//(t+1);work+=w;mtp=sorted(x['timestamp'] for x in blocks[max(0,i-10):i+1])[min(i+1,11)//2];assert b['mediantime']==mtp
  expected.append({'height':i,'hash':b['id'],'pow':pow_.hex(),'target':hex(t),'work':hex(w),'chainwork':hex(work),'mtp':mtp,'bits':hex(bits)})
 payload=b''.join(raws);text=''.join(json.dumps(row,separators=(',',':'))+'\n' for row in expected)
 artifacts={'headers.bin':payload,'expected.jsonl':text.encode()}
 # Fixed-width independent oracle records used by the Solidity historical owners.
 artifacts['oracle.bin']=b''.join(int(x['chainwork'],16).to_bytes(32,'big')+int(x['mtp']).to_bytes(4,'little') for x in expected)
 vectors=[]
 for name,blockfile,idsfile in [('legacy','legacy-block.json','legacy-txids.json'),('transparent','mweb-block.json','mweb-txids.json'),('hogex','mweb-block.json','mweb-txids.json')]:
  b=json.loads((R/blockfile).read_text());raw=header(b);assert h(raw)[::-1].hex()==b['id'];pow_=hashlib.scrypt(raw,salt=raw,n=1024,r=1,p=1,dklen=32);assert int.from_bytes(pow_,'little')<=target(b['bits'])
  tx=(R/(name+'.bin')).read_bytes();meta=json.loads((R/(name+'.json')).read_text());txid,outs,stripped=transaction(tx);assert txid[::-1].hex()==meta['txid'];assert outs==[(v['value'],bytes.fromhex(v['scriptpubkey'])) for v in meta['vout']]
  ids=json.loads((R/idsfile).read_text());index=meta['fixture_index'];assert ids[index]==meta['txid'];root,nodes=proof(ids,index);assert root[::-1].hex()==b['merkle_root']
  artifacts[name+'-proof.bin']=index.to_bytes(4,'little')+len(nodes).to_bytes(1,'little')+b''.join(nodes)+root+txid
  if name=='hogex':
   assert outs[0][1][:2]==bytes.fromhex('5820') and tx[4:6]==bytes.fromhex('0008');artifacts['hogex-stripped.bin']=stripped
  vectors.append({'name':name,'height':b['height'],'txid':meta['txid'],'outputs':len(outs),'amounts':[v for v,s in outs]})
  if name=='transparent':artifacts['modern-header.bin']=raw;artifacts['modern-pow.bin']=pow_
 artifacts['vectors.json']=(json.dumps(vectors,indent=2)+'\n').encode()
 for name,data in artifacts.items():
  if write:(R/name).write_bytes(data)
  assert (R/name).read_bytes()==data,('oracle drift',name)
 if (R/'SHA256SUMS.json').exists():
  for name,digest in json.loads((R/'SHA256SUMS.json').read_text()).items():assert hashlib.sha256((R/name).read_bytes()).hexdigest()==digest,name
 print('PASS: 4033 consecutive mainnet headers; every OpenSSL Scrypt PoW, SHA256d ID, target, retarget (2016/4032), MTP and cumulative work; genuine legacy/SegWit/HogEx identities, outputs and Merkle paths; terminal work',hex(work))
if __name__=='__main__':main('--write' in sys.argv)
