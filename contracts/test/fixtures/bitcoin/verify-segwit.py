"""Independent historical SegWit decoder, stripped txids, block Merkle tree and PoW."""
import hashlib
import json
from pathlib import Path
import struct
ROOT=Path(__file__).resolve().parent

def dsha(b):return hashlib.sha256(hashlib.sha256(b).digest()).digest()

def decode_block(b):
    at=80
    def compact():
        nonlocal at
        v=b[at];at+=1
        if v>=253:
            n={253:2,254:4,255:8}[v];v=int.from_bytes(b[at:at+n],'little');at+=n
            if v<{2:253,4:65536,8:4294967296}[n]:raise ValueError('noncanonical CompactSize')
        return v
    count=compact();txs=[]
    for index in range(count):
        start=at;at+=4;witness=b[at:at+2]==b'\x00\x01'
        if witness:at+=2
        ins=at;inputs=compact()
        if inputs==0:raise ValueError('zero inputs')
        for _ in range(inputs):
            at+=36;n=compact();at+=n+4
        nout=compact();amounts=[];scripts=[]
        for _ in range(nout):
            amounts.append(struct.unpack_from('<Q',b,at)[0]);at+=8;n=compact();scripts.append(b[at:at+n].hex());at+=n
        end_outputs=at
        if witness:
            for _ in range(inputs):
                n=compact()
                for _ in range(n):k=compact();at+=k
        stripped=b[start:start+4]+b[ins:end_outputs]+b[at:at+4];at+=4
        txs.append(dict(index=index,offset=start,size=at-start,stripped_size=len(stripped),witness=witness,txid=dsha(stripped)[::-1].hex(),wtxid=dsha(b[start:at])[::-1].hex(),amounts=amounts,scripts=scripts))
    if at!=len(b):raise ValueError('block framing')
    leaves=[bytes.fromhex(t['txid'])[::-1] for t in txs]
    selected=next(t for t in txs if t['index']>0 and t['witness'] and len(t['amounts'])>=2)
    position=selected['index'];siblings=[]
    while len(leaves)>1:
        if len(leaves)%2:leaves.append(leaves[-1])
        siblings.append(leaves[position^1].hex());position//=2
        leaves=[dsha(leaves[i]+leaves[i+1]) for i in range(0,len(leaves),2)]
    if leaves[0]!=b[36:68]:raise ValueError('transaction Merkle root')
    bits=struct.unpack_from('<I',b,72)[0];target=(bits&0x7fffff)<<(8*((bits>>24)-3))
    if int.from_bytes(dsha(b[:80]),'little')>target:raise ValueError('header PoW')
    return dict(height=481824,block_hash=dsha(b[:80])[::-1].hex(),sha256=hashlib.sha256(b).hexdigest(),transaction_count=count,selected=selected,siblings=siblings,merkle_root=b[36:68].hex())

def main():
    b=(ROOT/'block481824.bin').read_bytes();actual=decode_block(b)
    if actual!=json.loads((ROOT/'segwit.json').read_text())['expected']:raise ValueError('historical SegWit oracle mismatch')
    tx=actual['selected']
    if (ROOT/'segwit-transaction.bin').read_bytes()!=b[tx['offset']:tx['offset']+tx['size']]:raise ValueError('selected transaction mismatch')
    print(f"PASS: block 481824 PoW, {actual['transaction_count']} independently stripped txids and Merkle root; selected SegWit txid {tx['txid']}, output scripts, amounts and witness serialization")
if __name__=='__main__':main()
