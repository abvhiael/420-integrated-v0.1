"""Native Curecoin arithmetic/serialization port; canonicality/UTXO truth still requires full native replay."""
import hashlib
import struct

SOURCE='a3eb106715638e316eb03af383dc27aad2e89536'
GENESIS='00000ce427729d5393dbf9f464e7a1d2c039e393e881f93448516b1530b688fc'
COIN=1000000
MAX_MONEY=156000000*COIN
STAKE_LIMIT=(1<<232)-1
WORK_LIMIT=(1<<236)-1
HF=257322
SPACING=240
SELECTION_INTERVAL=sum(21600*63//(63+(63-i)*2) for i in range(64))
H=lambda b:hashlib.sha256(hashlib.sha256(b).digest()).digest()

def require(ok,message):
    if not ok:raise ValueError(message)

def compact(n):
    if not n:return 0
    size=(n.bit_length()+7)//8;word=n<<(8*(3-size)) if size<=3 else n>>(8*(size-3))
    if word&0x800000:word>>=8;size+=1
    return size<<24|word

def target(bits,pos=True):
    size=bits>>24;word=bits&0x7fffff
    require(word and not bits&0x800000 and size<=32,'compact encoding')
    n=word>>(8*(3-size)) if size<=3 else word<<(8*(size-3))
    require(0<n<=(STAKE_LIMIT if pos else WORK_LIMIT) and compact(n)==bits,'target limit/canonicality')
    return n

def limit(height,pos=True):
    return WORK_LIMIT if not pos or height<=14060 else (1<<226)-1 if height<=15000 else STAKE_LIMIT

def next_bits(bits,last,older,pos=True,height=300000,last_type_height=None):
    spacing=600 if height<=HF+1 else 240
    if not pos:spacing=min(7200,spacing*(1+height-1-(last_type_height if last_type_height is not None else height-1)))
    interval=14400//spacing;n=decode_target(bits)*((interval-1)*spacing+2*(last-older))//((interval+1)*spacing)
    require(n>0,'nonpositive retarget');return compact(min(n,limit(height,pos)))

def decode_target(bits):
    size=bits>>24;word=bits&0x7fffff;require(word and not bits&0x800000 and size<=32,'target')
    return word>>(8*(3-size)) if size<=3 else word<<(8*(size-3))

def trust(bits,pos=True):return (1<<256)//(decode_target(bits)+1) if pos else 1

def eligible_kind(height,pos):return pos or height<=HF

def minimum_age(height):return 30*86400 if height<=HF+1 else 4*86400

def weight(amount,tx_time,stake_time,height=300000):
    age=minimum_age(height);require(0<amount<=MAX_MONEY and stake_time>=tx_time+age,'stake age/value')
    return amount*(min(stake_time-tx_time,90*86400)-age)//COIN//86400

def kernel(modifier,origin_block_time,offset,prev_time,index,stake_time):
    return H(struct.pack('<QIIIII',modifier,origin_block_time,offset,prev_time,index,stake_time))

def check_kernel(bits,modifier,block_time,offset,prev_time,index,time,amount,height=300000):
    require(block_time+minimum_age(height)<=time and prev_time<=block_time,'source block age')
    w=weight(amount,prev_time,time,height);h=kernel(modifier,block_time,offset,prev_time,index,time)
    require(w>0 and int.from_bytes(h,'little')<=decode_target(bits)*w,'strict weighted kernel target')
    return h

def cs(n):
    if n<253:return bytes([n])
    if n<=65535:return b'\xfd'+struct.pack('<H',n)
    if n<=0xffffffff:return b'\xfe'+struct.pack('<I',n)
    return b'\xff'+struct.pack('<Q',n)

def varint(raw,p):
    require(p<len(raw),'truncated CompactSize');x=raw[p];p+=1
    if x<253:return x,p
    n={253:2,254:4,255:8}[x];require(p+n<=len(raw),'truncated CompactSize value');v=int.from_bytes(raw[p:p+n],'little')
    require(v>={2:253,4:65536,8:4294967296}[n],'noncanonical CompactSize');return v,p+n

def transaction(raw,p=0):
    start=p;require(p+8<=len(raw),'transaction header');version,time=struct.unpack_from('<II',raw,p);p+=8
    count,p=varint(raw,p);require(0<count<=1000,'input count');inputs=[]
    for _ in range(count):
        require(p+36<=len(raw),'input outpoint');txid=raw[p:p+32];index=int.from_bytes(raw[p+32:p+36],'little');p+=36
        size,p=varint(raw,p);require(size<=10000 and p+size+4<=len(raw),'input script');script=raw[p:p+size];p+=size;sequence=int.from_bytes(raw[p:p+4],'little');p+=4;inputs.append((txid,index,script,sequence))
    count,p=varint(raw,p);require(0<count<=1000,'output count');outputs=[];total=0
    for _ in range(count):
        require(p+8<=len(raw),'output value');amount=int.from_bytes(raw[p:p+8],'little');p+=8;size,p=varint(raw,p)
        require(size<=10000 and p+size<=len(raw) and amount<=MAX_MONEY,'output script/value');script=raw[p:p+size];p+=size;total+=amount;require(total<=MAX_MONEY,'transaction amount range');outputs.append((amount,script))
    require(p+4<=len(raw),'locktime');locktime=int.from_bytes(raw[p:p+4],'little');p+=4
    comment_size,p=varint(raw,p);require(comment_size<=268 and p+comment_size<=len(raw),'comment');comment=raw[p:p+comment_size];p+=comment_size
    require(version>0,'transaction version');coinbase=len(inputs)==1 and inputs[0][0]==bytes(32) and inputs[0][1]==0xffffffff
    stake=not coinbase and len(outputs)>1 and outputs[0]==(0,b'')
    return {'raw':raw[start:p],'id':H(raw[start:p]),'time':time,'inputs':inputs,'outputs':outputs,'coinbase':coinbase,'stake':stake,'locktime':locktime,'comment':comment},p

def merkle(leaves):
    require(bool(leaves),'empty Merkle tree')
    while len(leaves)>1:leaves=[H(leaves[i]+leaves[min(i+1,len(leaves)-1)]) for i in range(0,len(leaves),2)]
    return leaves[0]

def branch(leaves,index):
    result=[]
    while len(leaves)>1:
        result.append(leaves[min(index^1,len(leaves)-1)]);index//=2
        leaves=[H(leaves[i]+leaves[min(i+1,len(leaves)-1)]) for i in range(0,len(leaves),2)]
    return result
