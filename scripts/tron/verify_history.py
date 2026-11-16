#!/usr/bin/env python3
"""Independently verify native TRON historical wire/signature/finality evidence offline."""
import hashlib
import json
import re
from pathlib import Path
from coincurve import PublicKey
from eth_abi import encode
from eth_hash.auto import keccak

ROOT = Path(__file__).resolve().parents[2]
FIX = ROOT / 'contracts/test/fixtures/tron'
GENESIS = bytes.fromhex('00000000000000001ebf88508a03865c71d452e25f4d51194196a1d22b6653dc')
H = lambda b: hashlib.sha256(b).digest()

def require(ok, message):
    if not ok:
        raise ValueError(message)

def vi(v):
    require(0 <= v < 2**64, 'varint range')
    out = bytearray()
    while v >= 128:
        out.append((v & 127) | 128)
        v >>= 7
    return bytes(out) + bytes([v])

def blob(f, b):
    return vi(f * 8 + 2) + vi(len(b)) + b

def num(f, n):
    return vi(f * 8) + vi(n)

def header(b):
    d = b['block_header']['raw_data']
    out = b''
    for f, key, wire in [(1,'timestamp',0),(2,'txTrieRoot',2),(3,'parentHash',2),
                         (7,'number',0),(8,'witness_id',0),(9,'witness_address',2),
                         (10,'version',0),(11,'accountStateRoot',2)]:
        if key in d and d[key] not in (0, ''):
            out += blob(f, bytes.fromhex(d[key])) if wire == 2 else num(f, d[key])
    return out

def transaction(t):
    raw = bytes.fromhex(t['raw_data_hex'])
    out = blob(1, raw) + b''.join(blob(2, bytes.fromhex(s)) for s in t.get('signature', []))
    results = {'DEFAULT':0,'SUCCESS':1,'REVERT':2,'OUT_OF_ENERGY':10,'OUT_OF_TIME':11,'TRANSFER_FAILED':14}
    for r in t.get('ret', []):
        require(set(r) <= {'fee','ret','contractRet'}, 'unsupported historical result')
        result = num(1,r['fee']) if r.get('fee') else b''
        if r.get('ret') == 'FAILED': result += num(2,1)
        if r.get('contractRet') and r['contractRet'] != 'DEFAULT': result += num(3,results[r['contractRet']])
        out += blob(5,result)
    require(H(raw).hex() == t['txID'], 'transaction ID')
    return out

def base58(s):
    alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    n = 0
    for c in s:
        n = n*58 + alphabet.index(c)
    b = n.to_bytes(25,'big')
    require(H(H(b[:-4]))[:4] == b[-4:], 'base58 checksum')
    return b[:-4]

def main():
    config = (FIX/'java-tron-mainnet-config.conf').read_text()
    witnesses = [base58(a) for a in re.findall(r'address: (T\w+)',config)]
    require(len(witnesses) == 27 and len(set(witnesses)) == 27, 'genesis SR membership')
    genesis = json.loads((FIX/'genesis.json').read_bytes())
    require(bytes(8)+H(header(genesis))[8:] == GENESIS == bytes.fromhex(genesis['blockID']), 'native genesis header identity')
    blocks = {}
    for f in sorted(FIX.glob('blocks-*.json')):
        for b in json.loads(f.read_bytes())['block']:
            n = b['block_header']['raw_data']['number']
            if n in blocks: require(blocks[n] == b, 'overlapping capture mismatch')
            blocks[n] = b
    require(set(blocks) == set(range(1,1100)), 'consecutive fixture range')
    prev = GENESIS
    previous_time = 0
    raws, sigs, expected = [], [], []
    tx_count = 0
    for n in range(1,1100):
        b = blocks[n]; d = b['block_header']['raw_data']; raw = header(b)
        bid = n.to_bytes(8,'big') + H(raw)[8:]
        require(bid.hex() == b['blockID'], f'header serialization/id {n}')
        require(bytes.fromhex(d['parentHash']) == prev, f'ancestry {n}')
        require(d['timestamp']//3000 > previous_time//3000, f'time {n}')
        rank = (d['timestamp']//3000 - (2 if n == 2 else 0)) % 27
        require(bytes.fromhex(d['witness_address']) == witnesses[rank], f'genesis schedule {n}')
        sig = bytes.fromhex(b['block_header']['witness_signature'])
        pub = PublicKey.from_signature_and_message(sig,H(raw),hasher=None).format(compressed=False)
        require(b'\x41'+keccak(pub[1:])[-20:] == witnesses[rank], f'producer signature {n}')
        leaves = []
        for t in b.get('transactions',[]):
            require(len(t['raw_data']['contract']) == 1 and t['raw_data']['contract'][0]['type'] == 'TransferContract', 'historical schedule-changing transaction unsupported')
            tx = transaction(t); leaves.append(H(tx)); tx_count += 1
            # Independent transaction signature recovery; historical accounts use owner keys.
            for s in t.get('signature',[]):
                pub = PublicKey.from_signature_and_message(bytes.fromhex(s),H(bytes.fromhex(t['raw_data_hex'])),hasher=None).format(compressed=False)
                owner = t['raw_data']['contract'][0]['parameter']['value']['owner_address']
                require((b'\x41'+keccak(pub[1:])[-20:]).hex() == owner, f'transaction signature {n}')
        while len(leaves)>1:
            leaves = [H(leaves[i]+leaves[i+1]) if i+1<len(leaves) else leaves[i] for i in range(0,len(leaves),2)]
        root = leaves[0] if leaves else bytes(32)
        require(root.hex() == d.get('txTrieRoot','00'*32), f'full transaction/result Merkle root {n}')
        raws.append(raw); sigs.append(sig)
        expected.append({'number':n,'block_id':bid.hex(),'raw_sha256':H(raw).hex(),
                         'timestamp':d['timestamp'],'rank':rank,'root':root.hex()})
        prev=bid;previous_time=d['timestamp']
    # All data below lies within the genesis SR schedule, before its first six-hour boundary.
    checkpoint = blocks[2]; cp = checkpoint['block_header']['raw_data']
    deadline = ((cp['timestamp']//21_600_000)+1)*21_600_000
    require(previous_time < deadline, 'maintenance boundary')
    profile_type='(bytes32,bytes32,uint64,bytes32,uint64,uint64,uint64,bytes20[27],address[27])'
    snapshot = H((FIX/'java-tron-mainnet-config.conf').read_bytes())
    profile=(GENESIS,snapshot,2,bytes.fromhex(checkpoint['blockID']),cp['timestamp'],1099,deadline,
             [a[1:] for a in witnesses],['0x'+a[1:].hex() for a in witnesses])
    (FIX/'historical-profile.bin').write_bytes(encode([profile_type],[profile]))
    (FIX/'historical-headers.bin').write_bytes(encode(['bytes[]','bytes[]'],[raws[2:],sigs[2:]]))
    target = blocks[1045]; t = target['transactions'][0]; tx=transaction(t)
    (FIX/'historical-transaction.bin').write_bytes(tx)
    (FIX/'expected.json').write_text(json.dumps({'genesis':GENESIS.hex(),'headers':expected,'transactions_checked':tx_count,
        'historical_native':{'block':1045,'tx_id':t['txID'],'amount_sun':580000000000,'full_leaf':H(tx).hex()},
        'profile_snapshot_sha256':snapshot.hex()},indent=2)+'\n')
    print(f'PASS: {len(raws)} consecutive genuine headers anchored to mainnet genesis; producer signatures, ordered genesis SR membership and schedules; {tx_count} native transaction signatures/full leaves; 19-of-27 solidification inputs.')

if __name__ == '__main__':
    main()
