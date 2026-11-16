#!/usr/bin/env python3
"""Reproducible TEST-ONLY chain/proof, never genuine historical qualification."""
import argparse,json,struct,hashlib
from pathlib import Path
from eth_abi import encode
from eth_hash.auto import keccak
from coincurve import PrivateKey
from consensus import *
from native_hash import hasher
ROOT=Path(__file__).resolve().parents[2];FIX=ROOT/'contracts/test/fixtures/potcoin'
STATE='(bytes32,bytes32,uint64,bytes32,bytes32,uint256,uint256,uint8,uint32,uint32,uint32,uint32,uint32,uint64,bytes32,uint32,uint64,bytes32,uint32,uint32,uint32,uint32,bool,bool)'
PROOF=f'({STATE},uint32,bytes32[],bytes,bytes,bytes,bytes,uint32,bytes32[],bytes,uint32,bytes32[],uint32,bytes32)'
def tx(time,inputs,outputs):
    out=struct.pack('<II',1,time)+cs(len(inputs))
    for h,i,s in inputs:out+=h+struct.pack('<I',i)+cs(len(s))+s+b'\xff'*4
    out+=cs(len(outputs))
    for a,s in outputs:out+=struct.pack('<Q',a)+cs(len(s))+s
    return out+bytes(4)
def main():
    p=argparse.ArgumentParser();p.add_argument('--x13',required=True);a=p.parse_args();x13=hasher(a.x13)
    stamp=b'4/20/2026 PotCoin Rises From The Ashes';sig=b'\x00\x01\x2a'+bytes([len(stamp)])+stamp
    genesis_tx=tx(1774803100,[(bytes(32),0xffffffff,sig)],[(0,b'')])
    header=struct.pack('<I',1)+bytes(32)+H(genesis_tx)+struct.pack('<III',1774803100,0x1e0fffff,1054102)
    require(x13(header)[::-1].hex()==GENESIS,'genesis');(FIX/'genesis-header.bin').write_bytes(header);(FIX/'genesis-transaction.bin').write_bytes(genesis_tx)
    key=PrivateKey(bytes(31)+b'\x01');pub=key.public_key.format();p2pk=bytes([len(pub)])+pub+b'\xac';gateway=bytes.fromhex('76a914'+'42'*20+'88ac')
    route=keccak(b'420/BRIDGE/ROUTE/POT/MAINNET');router='0x0000000000000000000000000000000000420420';recipient='0x0000000000000000000000000000000000000b0b'
    domain=hashlib.sha256(encode(['string','uint256','address','bytes32'],['420/POT/DESTINATION/V1',420,router,route])).digest()
    time=1777803100;origin_time=time-26*86400;amount=380000000*COIN
    origin=tx(origin_time,[(bytes(32),0xffffffff,b'\x01\x01')],[(amount,p2pk)])
    coinbase=tx(time,[(bytes(32),0xffffffff,b'\x02\x58\x02')],[(0,b''),(0,b'')])
    stake=tx(time,[(H(origin),0,b'controlled-only')],[(0,b''),(amount,p2pk)])
    deposit=tx(time,[(b'\x11'*32,0,b'controlled-only')],[(42*COIN,gateway),(0,b'\x6a\x3c420POTV1'+domain+bytes.fromhex(recipient[2:]))])
    leaves=[H(coinbase),H(stake),H(deposit)];header=struct.pack('<I',1)+b'\x22'*32+merkle(leaves)+struct.pack('<III',time,0x1e00ffff,0);blockhash=x13(header)
    check_kernel(0x1e00ffff,42,origin_time,81,origin_time,0,time,amount)
    state=[bytes.fromhex(GENESIS)[::-1],bytes.fromhex(SOURCE)+bytes(12),600,blockhash,hashlib.sha256(header).digest(),100,100+trust(0x1e00ffff),2,0x1e00ffff,time-258,time-516,time-258,time-258,42,H(origin),0,amount,hashlib.sha256(p2pk).digest(),400,origin_time,origin_time,81,True,True]
    proof=[state,0,[],header,stake,key.sign(blockhash,hasher=None),origin,3,branch(leaves,1),deposit,2,branch(leaves,2),0,route]
    (FIX/'controlled-proof.bin').write_bytes(encode([PROOF],[proof]))
    root=hashlib.sha256(encode(['string',STATE],['420/POT/NATIVE-REPLAY-STATE/V1',state])).digest()
    (FIX/'controlled-root.bin').write_bytes(root)
    (FIX/'controlled.json').write_text(json.dumps({'classification':'CONTROLLED TEST ONLY — not historical native consensus evidence','public_test_private_key':'01','height':600,'time':time,'chain_id':420,'router':router,'recipient':recipient,'root':root.hex(),'x13':blockhash.hex(),'native_source':SOURCE},indent=2)+'\n')
    print('PASS genuine genesis serialization/X13; generated explicitly controlled proof')
if __name__=='__main__':main()
