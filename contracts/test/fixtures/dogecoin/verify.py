"""Independent stdlib/OpenSSL Dogecoin Scrypt, AuxPoW and difficulty oracle."""
import hashlib,json,struct,sys,zipfile
from pathlib import Path
R=Path(__file__).resolve().parent
LIMIT=(1<<236)-1
def source(name):
 p=R/'raw'/name
 if p.exists():return p.read_bytes()
 with zipfile.ZipFile(R/'source-blocks.zip') as z:return z.read('raw/'+name)
SEGMENTS=[(0,480),(144988,145012),(371325,371349)]
def H(b):return hashlib.sha256(hashlib.sha256(b).digest()).digest()
def u(b,at,n=4):return int.from_bytes(b[at:at+n],'little')
def cs(b,at):
 x=b[at];at+=1
 if x<253:return x,at
 n={253:2,254:4,255:8}[x];v=u(b,at,n);assert v>={253:253,254:65536,255:4294967296}[x];return v,at+n
def transaction(b,at):
 start=at;version=b[at:at+4];at+=4;witness=b[at]==0
 if witness:assert b[at+1]==1;at+=2
 body=at;n,at=cs(b,at);assert n;inputs=n;scripts=[]
 for _ in range(n):
  at+=36;size,at=cs(b,at);scripts.append(b[at:at+size]);at+=size+4
 n,at=cs(b,at);outs=[]
 for _ in range(n):
  value=u(b,at,8);at+=8;size,at=cs(b,at);outs.append((value,b[at:at+size]));at+=size
 end=at
 if witness:
  for _ in range(inputs):
   n,at=cs(b,at)
   for _ in range(n):size,at=cs(b,at);at+=size
 at+=4;assert at<=len(b);raw=b[start:at];txid=H(version+b[body:end]+b[at-4:at]);return at,raw,txid,scripts,outs

def target(bits):
 n=bits>>24;w=bits&0x7fffff;assert w and not bits&0x800000 and n<=34 and not(w>255 and n>33) and not(w>65535 and n>32)
 v=w>>(8*(3-n)) if n<=3 else w<<(8*(n-3));assert 0<v<=LIMIT;return v

def compact(t):
 n=(t.bit_length()+7)//8;w=t<<(8*(3-n)) if n<=3 else t>>(8*(n-3))
 if w&0x800000:w>>=8;n+=1
 return n<<24|w

def branch(x,index,nodes):
 for node in nodes:x=H(node+x) if index&1 else H(x+node);index>>=1
 return x

def index(nonce,depth):
 x=(nonce*1103515245+12345+98)&0xffffffff;x=(x*1103515245+12345)&0xffffffff;return x%(1<<depth)

def word(n):return n.to_bytes(32,'big')
def dynamic(b):return word(len(b))+b+bytes((-len(b))%32)
def abi_aux(p):
 data=[dynamic(p['coinbase']),word(len(p['parentBranch']))+b''.join(p['parentBranch']),None,word(len(p['chainBranch']))+b''.join(p['chainBranch']),None,dynamic(p['parentHeader'])];head=[];tail=b''
 for i,v in enumerate(data):
  if v is None:head.append(word(p['parentIndex'] if i==2 else p['chainIndex']))
  else:head.append(word(192+len(tail)));tail+=v
 return word(32)+b''.join(head)+tail

def parse_block(raw,height):
 header=raw[:80]
 if len(raw)==80:assert json.loads(source(f'{height}.json'))['hash']==H(header)[::-1].hex()
 version=u(header,0);aux=bool(version&256);legacy=version in (1,2)
 assert legacy or version>>16==98
 assert not(aux and height<371337) and not(legacy and height>=371337)
 assert height<1034383 or version%256>=3
 assert height<3464751 or version%256>=4
 at=80;p=None;powheader=header
 if aux:
  if len(raw)==80:
   meta=json.loads(source(f'{height}.json'));assert meta['hash']==H(header)[::-1].hex();a=meta['auxpow'];cb=bytes.fromhex(a['tx']['hex']);end,_,txid,scripts,_=transaction(cb,0);assert end==len(cb) and txid[::-1].hex()==a['tx']['txid']
   pb=[bytes.fromhex(x)[::-1] for x in a['merklebranch']];cbn=[bytes.fromhex(x)[::-1] for x in a['chainmerklebranch']];pi=a['index'];ci=a['chainindex'];ph=bytes.fromhex(a['parentblock'])
  else:
   at,cb,txid,scripts,_=transaction(raw,at);at+=32 # historical hashBlock is not consensus authority
   n,at=cs(raw,at);pb=[raw[at+i*32:at+(i+1)*32] for i in range(n)];at+=n*32;pi=u(raw,at);at+=4
   n,at=cs(raw,at);cbn=[raw[at+i*32:at+(i+1)*32] for i in range(n)];at+=n*32;ci=u(raw,at);at+=4
   ph=raw[at:at+80];at+=80
  assert len(ph)==80 and pi==0 and len(cbn)<=30 and u(ph,0)>>16!=98
  assert branch(txid,pi,pb)==ph[36:68];root=branch(H(header),ci,cbn)[::-1];script=scripts[0];pos=script.find(root);assert pos>=0
  marker=script.find(bytes.fromhex('fabe6d6d'))
  if marker>=0:assert script.count(bytes.fromhex('fabe6d6d'))==1 and marker+4==pos
  else:assert pos<=20
  pos+=32;assert len(script)-pos>=8;size=u(script,pos);nonce=u(script,pos+4)
  assert size==1<<len(cbn) and ci==index(nonce,len(cbn))
  p={'coinbase':cb,'parentBranch':pb,'parentIndex':pi,'chainBranch':cbn,'chainIndex':ci,'parentHeader':ph};powheader=ph
 digest=hashlib.scrypt(powheader,salt=powheader,n=1024,r=1,p=1,dklen=32);t=target(u(header,72));assert int.from_bytes(digest,'little')<=t
 txs=[]
 if len(raw)>at:
  n,at=cs(raw,at)
  for _ in range(n):at,tx,txid,scripts,outs=transaction(raw,at);txs.append((tx,txid,outs))
  assert at==len(raw)
  nodes=[x[1] for x in txs]
  while len(nodes)>1:
   if len(nodes)&1:nodes.append(nodes[-1])
   nodes=[H(nodes[i]+nodes[i+1]) for i in range(0,len(nodes),2)]
  assert nodes and nodes[0]==header[36:68]
 return header,p,powheader,digest,t,txs

def expected_bits(rows,height):
 prev=rows[height-1];bits=prev['bits']
 if height>=145000:
  span=prev['time']-rows[height-2]['time'];d=span-60;span=60+(abs(d)//8 if d>=0 else -(abs(d)//8));span=max(45,min(90,span));nominal=60
 else:
  if height%240:return bits
  start=0 if height==240 else height-241;span=prev['time']-rows[start]['time'];span=max(900 if height<=5000 else 1800 if height<=10000 else 3600,min(57600,span));nominal=14400
 return compact(min(LIMIT,target(bits)*span//nominal))

def verify(write=False):
 rows={};artifacts={};total_aux=0;txcount=0
 for lo,hi in SEGMENTS:
  cumulative=0
  for height in range(lo,hi+1):
   raw=source(f'{height}.bin');head,p,powheader,digest,t,txs=parse_block(raw,height);bid=H(head)
   if height>lo:
    assert head[4:36]==bytes.fromhex(rows[height-1]['raw_hash']);
    if height>=lo+11:assert u(head,68)>sorted(rows[j]['time'] for j in range(height-11,height))[5]
   w=(1<<256)//(t+1);cumulative+=w
   if lo==0 and len(raw)==80:assert int(json.loads(source(f'{height}.json'))['chainwork'],16)==cumulative
   row={'height':height,'hash':bid[::-1].hex(),'raw_hash':bid.hex(),'time':u(head,68),'bits':u(head,72),'target':hex(t),'work':w,'segment_work':cumulative,'pow':digest.hex(),'auxpow':p is not None};rows[height]=row
   if height>lo and ((height>=145000 and height>=lo+2) or (height<145000 and (height%240 or height==240 or height==480))):assert expected_bits(rows,height)==row['bits'],('difficulty',height)
   if height<17 or height>=144988:artifacts[f'headers/{height}.bin']=head
   if height>=371325:artifacts[f'aux/{height}.bin']=abi_aux(p) if p else b''
   if p:artifacts[f'parents/{height}.bin']=powheader;total_aux+=1
   txcount+=len(txs)
   if height==371337:
    artifacts['parent-pow.bin']=digest
    assert row['hash']=='60323982f9c5ff1b5a954eac9dc1269352835f47c2c5222691d80f0d50dcf053'
    for i,(tx,txid,outs) in enumerate(txs):
     if i and len(outs)>=2:
      nodes=[x[1] for x in txs];path=[];idx=i
      while len(nodes)>1:
       if len(nodes)&1:nodes.append(nodes[-1])
       path.append(nodes[idx^1]);idx//=2;nodes=[H(nodes[j]+nodes[j+1]) for j in range(0,len(nodes),2)]
      artifacts['payment.bin']=tx;artifacts['payment-proof.bin']=word(i)+word(len(path))+b''.join(path)+txid+word(outs[0][0])+word(outs[1][0]);break
 assert rows[145000]['hash']=='cc47cae70d7c5c92828d3214a266331dde59087d4a39071fa76ddfff9b7bde72'
 assert rows[0]['hash']=='1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691'
 artifacts['headers.bin']=b''.join(source(f'{h}.bin')[:80] for h in range(481))
 artifacts['expected.json']=(json.dumps(list(rows.values()),indent=2)+'\n').encode()
 artifacts['oracle.bin']=b''.join(word(rows[h]['segment_work'])+word(rows[h]['bits']) for h in range(481))
 vectors=b''
 for i in range(128):
  nonce=(i*3471823+0xfffffff0)&0xffffffff;depth=i%31;vectors+=struct.pack('<IBI',nonce,depth,index(nonce,depth))
 artifacts['index-vectors.bin']=vectors;vectors=b''
 for span in list(range(-20,90))+[100,120,300,10000,1000000]:
  d=span-60;mod=60+(abs(d)//8 if d>=0 else -(abs(d)//8));mod=max(45,min(90,mod));vectors+=struct.pack('<iI',span,compact(target(0x1b123456)*mod//60))
 artifacts['digishield-vectors.bin']=vectors
 for name,data in artifacts.items():
  p=R/name
  if write:p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
  assert p.read_bytes()==data,('artifact drift',name)
 if (R/'SHA256SUMS.json').exists():
  for name,d in json.loads((R/'SHA256SUMS.json').read_text()).items():assert hashlib.sha256((R/name).read_bytes()).hexdigest()==d,name
 print(f'PASS: {len(rows)} genuine headers, {total_aux} historical AuxPoW relationships, every Scrypt/target/hash, pre-DigiShield and DigiShield difficulty, segment ancestry/work; {txcount} complete transactions and block Merkle trees')
if __name__=='__main__':verify('--write' in sys.argv)
