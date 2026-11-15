#!/usr/bin/env python3
"""Reproducible TEST-ONLY chain/proof, never genuine historical qualification."""
import argparse,json,struct,hashlib
from pathlib import Path
from eth_abi import encode
from eth_hash.auto import keccak
from coincurve import PrivateKey
from consensus import *

ROOT=Path(__file__).resolve().parents[2];FIX=ROOT/'contracts/test/fixtures/curecoin'
STATE='(bytes32,bytes32,uint64,bytes32,bytes32,uint256,uint256,uint8,uint32,uint32,uint32,uint32,uint32,uint64,bytes32,uint32,uint64,bytes32,uint32,uint32,uint32,uint32,bool,bool,uint32)'
PROOF=f'({STATE},uint32,bytes32[],bytes,bytes,bytes,bytes,uint32,bytes32[],bytes,uint32,bytes32[],uint32,bytes32)'
def tx(time,inputs,outputs,comment=b''):

    out=struct.pack('<II',1,time)+cs(len(inputs))
    for h,i,s in inputs:out+=h+struct.pack('<I',i)+cs(len(s))+s+b'\xff'*4
    out+=cs(len(outputs))
    for a,s in outputs:out+=struct.pack('<Q',a)+cs(len(s))+s
    return out+bytes(4)+cs(len(comment))+comment
def main():
    p=argparse.ArgumentParser();a=p.parse_args();x13=H
    stamp=b'This Blind Man Can Show You How To Look On The Bright Side.';sig=bytes.fromhex('04ffff001d020f27')+bytes([len(stamp)])+stamp
    genesis_tx=tx(1398151422,[(bytes(32),0xffffffff,sig)],[(0,b'')],b'text:curecoin genesis block')
    header=struct.pack('<I',1)+bytes(32)+H(genesis_tx)+struct.pack('<III',1398151422,0x1e0fffff,25338)
    require(x13(header)[::-1].hex()==GENESIS,'genesis');(FIX/'genesis-header.bin').write_bytes(header);(FIX/'genesis-transaction.bin').write_bytes(genesis_tx)
    key=PrivateKey(bytes(31)+b'\x01');pub=key.public_key.format();p2pk=bytes([len(pub)])+pub+b'\xac';gateway=bytes.fromhex('76a914'+'42'*20+'88ac')
    route=keccak(b'420/BRIDGE/ROUTE/CURE/MAINNET');router='0x0000000000000000000000000000000000420420';recipient='0x0000000000000000000000000000000000000b0b'
    domain=hashlib.sha256(encode(['string','uint256','address','bytes32'],['420/CURE/DESTINATION/V1',420,router,route])).digest()
    time=1777803100;origin_time=time-91*86400;amount=100000000*COIN
    origin=tx(origin_time,[(bytes(32),0xffffffff,b'\x01\x01')],[(amount,p2pk)])
    coinbase=tx(time,[(bytes(32),0xffffffff,b'\x02\x58\x02')],[(0,b'')])
    stake=tx(time,[(H(origin),0,b'controlled-only')],[(0,b''),(amount,p2pk)])
    deposit=tx(time,[(b'\x11'*32,0,b'controlled-only')],[(42*COIN,gateway)],b'420CUREV1'+domain+bytes.fromhex(recipient[2:]))
    leaves=[H(coinbase),H(stake),H(deposit)];header=struct.pack('<I',4)+b'\x22'*32+merkle(leaves)+struct.pack('<III',time,0x1e00ffff,0);blockhash=x13(header)
    check_kernel(0x1e00ffff,42,origin_time,81,origin_time,0,time,amount)
    state=[bytes.fromhex(GENESIS),bytes.fromhex(SOURCE)+bytes(12),300000,blockhash[::-1],hashlib.sha256(header).digest(),100,100+trust(0x1e00ffff),2,0x1e00ffff,time-240,time-480,time-240,time-240,42,H(origin),0,amount,hashlib.sha256(p2pk).digest(),400,origin_time,origin_time,81,True,True,4*86400]
    proof=[state,0,[],header,stake,key.sign(blockhash,hasher=None),origin,3,branch(leaves,1),deposit,2,branch(leaves,2),0,route]
    (FIX/'controlled-proof.bin').write_bytes(encode([PROOF],[proof]))
    root=hashlib.sha256(encode(['string',STATE],['420/CURE/NATIVE-REPLAY-STATE/V1',state])).digest()
    (FIX/'controlled-root.bin').write_bytes(root)
    (FIX/'controlled.json').write_text(json.dumps({'classification':'CONTROLLED TEST ONLY — not historical native consensus evidence','public_test_private_key':'01','height':300000,'time':time,'chain_id':420,'router':router,'recipient':recipient,'root':root.hex(),'sha256d_raw':blockhash.hex(),'native_source':SOURCE},indent=2)+'\n')
    print('PASS genuine genesis serialization/SHA256d; generated explicitly controlled proof')
if __name__=='__main__':main()
