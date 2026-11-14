"""Independently decode block 170, reconstruct txids/Merkle root, and check persisted evidence."""
import hashlib
import json
from pathlib import Path
import struct
ROOT=Path(__file__).resolve().parent

def sha256d(b):return hashlib.sha256(hashlib.sha256(b).digest()).digest()

def check(b):
    if len(b)!=490 or b[80]!=2:raise ValueError('block framing')
    if b[:80]!=(ROOT/'headers.bin').read_bytes()[170*80:171*80]:raise ValueError('historical header mismatch')
    at=81;txs=[]
    def compact():
        nonlocal at
        v=b[at];at+=1
        if v>=253:
            n={253:2,254:4,255:8}[v];v=int.from_bytes(b[at:at+n],'little');at+=n
            if v<({2:253,4:65536,8:4294967296}[n]):raise ValueError('noncanonical count')
        return v
    for _ in range(2):
        start=at;at+=4;inputs=compact()
        for _ in range(inputs):
            at+=36;n=compact();at+=n+4
        outputs=compact();values=[];scripts=[]
        for _ in range(outputs):
            values.append(struct.unpack_from('<Q',b,at)[0]);at+=8
            n=compact();scripts.append(b[at:at+n].hex());at+=n
        at+=4
        txs.append(dict(offset=start,size=at-start,txid=sha256d(b[start:at])[::-1].hex(),amounts=values,scripts=scripts))
    if at!=len(b):raise ValueError('trailing block bytes')
    root=sha256d(bytes.fromhex(txs[0]['txid'])[::-1]+bytes.fromhex(txs[1]['txid'])[::-1])
    if root!=b[36:68]:raise ValueError('Merkle root mismatch')
    if txs[1]['amounts']!=[1_000_000_000,4_000_000_000]:raise ValueError('historical amounts')
    return dict(height=170,block_hash=sha256d(b[:80])[::-1].hex(),sha256=hashlib.sha256(b).hexdigest(),transactions=txs)

def main():
    data=(ROOT/'block170.bin').read_bytes();actual=check(data)
    expected=json.loads((ROOT/'block170.json').read_text())
    if actual!=expected['expected']:raise ValueError('block evidence mismatch')
    damaged=bytearray(data);damaged[-8]^=1
    try:check(damaged)
    except ValueError:pass
    else:raise ValueError('mutated historical transaction accepted')
    print('PASS: block 170 framing, 2 txids, output scripts and satoshis, Merkle inclusion, header linkage, checksum and corruption rejection')
if __name__=='__main__':main()
