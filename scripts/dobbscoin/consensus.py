"""Independent Dobbscoin mainnet header/AuxPoW reference, pinned to source 1a300eb.

This is a qualification cross-check, not a full script/UTXO validator. Production
checkpoint construction also requires a fresh native replay with assumevalid=0.
"""
from hashlib import sha256, scrypt
import math,struct
SOURCE='1a300eb0f469e5a3cb0d8337f20adbab83a512e3'
GENESIS='6d2d7d525900712451b9697d0b5b2304ebae6efb349540da445bf575c0159969'
GENESIS_POW='b83bb8028229439a4e645a56d48ee31b884efdb0e395c8538a10a462166563f3'
LIMIT=(1<<236)-1
MASK=(1<<256)-1
MAGIC=bytes.fromhex('a0fb1783')

def require(ok,message):
    if not ok:raise ValueError(message)
def dsha(raw):return sha256(sha256(raw).digest()).digest()
def pow_hash(header):
    require(len(header)==80,'work header length')
    return scrypt(header,salt=header,n=1024,r=1,p=1,dklen=32)
def target(bits,limit=LIMIT):
    size=bits>>24;word=bits&0x7fffff
    require(word and not bits&0x800000 and size<=34 and not(word>0xff and size>33) and not(word>0xffff and size>32),'compact overflow/sign')
    value=word>>(8*(3-size)) if size<=3 else word<<(8*(size-3))
    require(0<value<=limit,'target range');return value
def compact(value):
    size=(value.bit_length()+7)//8
    word=value<<(8*(3-size)) if size<=3 else value>>(8*(size-3))
    if word&0x800000:word>>=8;size+=1
    return word|(size<<24)
def trunc(a,b):return abs(a)//b*(-1 if a<0 else 1)
def time(h):return struct.unpack_from('<I',h,68)[0]
def bits(h):return struct.unpack_from('<I',h,72)[0]
def work(h):return (1<<256)//(target(bits(h))+1)
def mode(height):return 5 if height>=1888808 else 4 if height>=68425 else 3 if height>=31597 else 2 if height>=13579 else 1

def expected(headers,height):
    """headers supports integer indexing; candidate height is len(history)."""
    require(height>0,'genesis special case');p=headers[height-1];b=bits(p);m=mode(height)
    if m==1:
        if height%2016:return b
        span=max(1209600//4,min(1209600*4,time(p)-time(headers[height-2016])))
        return compact(min(LIMIT,(target(b)*span&MASK)//1209600))
    if m==2:
        if height-1<9:return compact(LIMIT)
        avg=0;latest=time(p)
        for mass in range(1,min(252,height-1)+1):
            h=headers[height-mass];v=target(bits(h));avg=v if mass==1 else avg+trunc(v-avg,mass)
            latest=max(latest,time(h));actual=max(1,latest-time(h));span=600*mass
            ratio=span/actual;dev=1+0.7084*math.pow(mass/9,-1.228)
            if mass>=9 and (ratio<=1/dev or ratio>=dev):break
        return compact(min(LIMIT,avg*actual//span))
    if m in (3,4):
        spacing=600 if m==3 else 120
        span=spacing+trunc(time(p)-time(headers[height-2])-spacing,8)
        span=max(spacing-spacing//4,min(spacing+spacing//2,span))
        return compact(min(LIMIT,(target(b)*span&MASK)//spacing))
    if height<1888808+60:return b
    k=219600;weighted=0;total=0
    for i in range(1,61):
        h=headers[height-61+i]
        dt=max(-720,min(720,time(h)-time(headers[height-62+i])))
        weighted+=dt*i;total+=target(bits(h))//(60*k)
    return compact(min(LIMIT,total*max(weighted,k//3)))

def emergency(height,header,parent):return height>=1888888 and time(header)-time(parent)>21600 and bits(header)==compact(LIMIT)
def activation(header,height,activation_height=2000000):
    version=struct.unpack_from('<I',header)[0];aux=bool(version&256);chain=version>>16
    require((not aux and chain==0) if height<activation_height else chain==176,'activation/chain ID');return aux

def check_header(header,history,height,hash_=None,aux=None):
    require(len(header)==80,'header length')
    if height==0:
        require(dsha(header)[::-1].hex()==GENESIS,'genesis identity')
        require((hash_ or pow_hash(header))[::-1].hex()==GENESIS_POW,'genesis work exception identity')
        return
    parent=history[height-1];require(header[4:36]==dsha(parent),'ancestry')
    has_aux=activation(header,height)
    work_header=header
    if has_aux:
        require(aux is not None,'missing AuxPoW trailer');check_aux(header,aux['coinbase'],aux['parent_header'],aux['parent_branch'],aux['chain_branch'],aux['chain_index'],aux['parent_index']);work_header=aux['parent_header']
    else:require(aux is None,'unexpected AuxPoW trailer')
    normal=expected(history,height)
    require(bits(header)==normal or emergency(height,header,parent),'difficulty at '+str(height))
    times=sorted(time(history[i]) for i in range(max(0,height-11),height))
    require(time(header)>times[len(times)//2],'median-time-past')
    require(int.from_bytes(hash_ or pow_hash(work_header),'little')<=target(bits(header)),'scrypt work')

def cs(raw,at):
    require(at<len(raw),'truncated compact');n=raw[at];at+=1
    if n<253:return n,at
    size={253:2,254:4,255:8}[n];require(at+size<=len(raw),'compact truncated');v=int.from_bytes(raw[at:at+size],'little')
    require(v>={2:253,4:65536,8:4294967296}[size],'nonminimal compact');return v,at+size

def tx(raw,at=0,parent=False):
    start=at;require(at+4<=len(raw),'tx version');version=int.from_bytes(raw[at:at+4],'little');at+=4
    n,at=cs(raw,at);require(n and n<=(len(raw)-at)//41,'input count');inputs=[]
    for _ in range(n):
        require(at+36<=len(raw),'prevout');prev=raw[at:at+36];at+=36;size,at=cs(raw,at);require(at+size+4<=len(raw),'input script');script=raw[at:at+size];at+=size+4;inputs.append((prev,script))
    n,at=cs(raw,at);require((parent or n>0) and n<=(len(raw)-at)//9,'output count');outputs=[];total=0
    for _ in range(n):
        amount=int.from_bytes(raw[at:at+8],'little');at+=8;size,at=cs(raw,at);require(at+size<=len(raw),'output script');script=raw[at:at+size];at+=size
        total+=amount;require(parent or total<=10**18,'amount range');outputs.append((amount,script))
    require(at+4<=len(raw),'lock time');at+=4
    return {'raw':raw[start:at],'id':dsha(raw[start:at]),'version':version,'inputs':inputs,'outputs':outputs},at

def merkle(ids):
    require(bool(ids),'empty merkle')
    while len(ids)>1:
        # Native detects duplicate sibling pairs before odd-node duplication.
        require(all(ids[i]!=ids[i+1] for i in range(0,len(ids)-1,2)),'mutated merkle')
        if len(ids)%2:ids=ids+[ids[-1]]
        ids=[dsha(ids[i]+ids[i+1]) for i in range(0,len(ids),2)]
    return ids[0]
def branch(value,index,siblings):
    require(len(siblings)<=32 and index>=0 and index>>len(siblings)==0,'merkle index')
    for sibling in siblings:value=dsha(sibling+value) if index&1 else dsha(value+sibling);index>>=1
    return value
def expected_index(nonce,height):
    require(0<=height<=30,'chain height');r=(nonce*1103515245+12345+176)&0xffffffff;r=(r*1103515245+12345)&0xffffffff;return r%(1<<height)
def check_aux(child,parent_tx,parent_header,parent_branch,chain_branch,chain_index,parent_index=0,limit=LIMIT):
    require(len(parent_header)==80 and parent_index==0 and len(chain_branch)<=30,'aux structure')
    require(int.from_bytes(parent_header[:4],'little')>>16!=176,'parent chain ID')
    t,end=tx(parent_tx,parent=True);require(end==len(parent_tx),'parent tx end')
    parent_root=t['id']
    for sibling in parent_branch:parent_root=dsha(parent_root+sibling)
    require(parent_root==parent_header[36:68],'parent inclusion')
    root=branch(dsha(child),chain_index,chain_branch)[::-1];script=t['inputs'][0][1];pos=script.find(root);head=script.find(bytes.fromhex('fabe6d6d'))
    require(pos>=0,'missing child commitment')
    if head>=0:require(script.find(bytes.fromhex('fabe6d6d'),head+1)<0 and pos==head+4,'merged mining magic')
    else:require(pos<=20,'legacy commitment position')
    require(pos+40<=len(script),'tree descriptor');size,nonce=struct.unpack_from('<II',script,pos+32)
    require(size==1<<len(chain_branch) and chain_index==expected_index(nonce,len(chain_branch)),'aux tree slot')
    require(int.from_bytes(pow_hash(parent_header),'little')<=target(bits(child),limit),'parent scrypt against child target')

def read_aux(raw,at=80):
    """Deserialize the native CAuxPow trailer; hashBlock is unused metadata."""
    parent_tx,at=tx(raw,at,parent=True);require(at+32<=len(raw),'aux hashBlock');at+=32
    count,at=cs(raw,at);require(count<=(len(raw)-at)//32,'parent branch count');parent_branch=[raw[i:i+32] for i in range(at,at+32*count,32)];at+=32*count
    require(at+4<=len(raw),'parent index');parent_index=int.from_bytes(raw[at:at+4],'little');at+=4
    count,at=cs(raw,at);require(count<=30 and count<=(len(raw)-at)//32,'chain branch count');chain_branch=[raw[i:i+32] for i in range(at,at+32*count,32)];at+=32*count
    require(at+84<=len(raw),'chain index/parent header');chain_index=int.from_bytes(raw[at:at+4],'little');at+=4;parent_header=raw[at:at+80];at+=80
    return {'coinbase':parent_tx['raw'],'parent_branch':parent_branch,'parent_index':parent_index,'chain_branch':chain_branch,'chain_index':chain_index,'parent_header':parent_header},at

def aux_json(a):return {'coinbase':a['coinbase'].hex(),'parent_branch':[x.hex() for x in a['parent_branch']],'parent_index':a['parent_index'],'chain_branch':[x.hex() for x in a['chain_branch']],'chain_index':a['chain_index'],'parent_header':a['parent_header'].hex()}
