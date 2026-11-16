"""Native PotCoin arithmetic/serialization port; canonicality/UTXO truth still requires full native replay."""
import hashlib
import struct

SOURCE='24b987951186417af909a9cf1ea4da736e782c0f'
GENESIS='000002fe94ee5871d9954e6b441195ad6a2709c33e47fc7ba51914bb0e8109f8'
COIN=100000000
MAX_MONEY=420000000*COIN
STAKE_LIMIT=(1<<232)-1
WORK_LIMIT=(1<<236)-1
SPACING=258
SELECTION_INTERVAL=sum(60*63//(63+(63-i)*2) for i in range(64))
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

def next_bits(bits,last,older,pos=True):
    spacing=SPACING if last<older else last-older
    n=target(bits,pos)*(12*SPACING+2*spacing)//(14*SPACING)
    limit=STAKE_LIMIT if pos else WORK_LIMIT
    return compact(limit if n<=0 or n>limit else n)

def trust(bits,pos=True):return (1<<256)//(target(bits,pos)+1)

def eligible_kind(height,pos):return height>=20 if pos else height<=500

def weight(amount,tx_time,stake_time):
    require(0<amount<=MAX_MONEY and stake_time>=tx_time+900,'stake age/value')
    return amount*min(stake_time-tx_time-900,25*86400)//COIN//86400

def kernel(modifier,origin_block_time,offset,prev_time,index,stake_time):
    return H(struct.pack('<QIIIII',modifier,origin_block_time,offset,prev_time,index,stake_time))

def check_kernel(bits,modifier,block_time,offset,prev_time,index,time,amount):
    require(block_time+900<=time and prev_time<=block_time,'source block age')
    w=weight(amount,prev_time,time);h=kernel(modifier,block_time,offset,prev_time,index,time)
    require(w>0 and int.from_bytes(h,'little')<target(bits)*w,'strict weighted kernel target')
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
    require(version>0,'transaction version');coinbase=len(inputs)==1 and inputs[0][0]==bytes(32) and inputs[0][1]==0xffffffff
    stake=not coinbase and len(outputs)>1 and outputs[0]==(0,b'')
    return {'raw':raw[start:p],'id':H(raw[start:p]),'time':time,'inputs':inputs,'outputs':outputs,'coinbase':coinbase,'stake':stake,'locktime':locktime},p

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
