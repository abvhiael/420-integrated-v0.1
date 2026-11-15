#!/usr/bin/env python3
"""Deterministic PUBLIC TEST-ONLY native XRPL fixtures. Never mainnet validator evidence."""
import hashlib
from pathlib import Path
from coincurve import PrivateKey
from eth_abi import encode
from eth_hash.auto import keccak
from xrpl.core.binarycodec import encode as serialize
from xrpl.core.addresscodec import encode_classic_address
from verify_history import HALF, vl
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature, encode_dss_signature

FIX=Path(__file__).resolve().parents[2]/'contracts/test/fixtures/xrpl'
PROFILE='(bytes32,bytes32,uint32,uint32,uint32,uint32,uint16,bytes32[],bytes32[],address[])'
BUNDLE=['bytes','bytes[]','bytes','bytes','bytes32[16][]']

def main():
    sizes=[0,1,3,4,31,32,64,111,112,113,127,128,129,239,240,255,256,511,512,1024,4096]
    messages=[bytes((i*73+size)%256 for i in range(size)) for size in sizes]
    (FIX/'sha512half-vectors.bin').write_bytes(encode(['bytes[]','bytes32[]'],[messages,[HALF(m) for m in messages]]))
    digest=HALF(b'PUBLIC TEST-ONLY native DER boundary');secret=PrivateKey((1).to_bytes(32,'big'))
    r,s=decode_dss_signature(secret.sign(digest,hasher=None));high=0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141-s
    (FIX/'controlled-high-s.bin').write_bytes(encode(['bytes32','bytes','address'],[digest,encode_dss_signature(r,high),'0x'+keccak(secret.public_key.format(compressed=False)[1:])[-20:].hex()]))
    keys=[PrivateKey(i.to_bytes(32,'big')) for i in range(1,6)]
    pubs=[k.public_key.format(compressed=True) for k in keys]
    masters=[hashlib.sha256(b'PUBLIC CONTROLLED XRPL MASTER/'+bytes([i])).digest() for i in range(5)]
    profile=(keccak(b'XRPL/MAINNET'),hashlib.sha256(b'PUBLIC CONTROLLED UNL').digest(),1000,1000,799999700,800000300,4,
        masters,[hashlib.sha256(p).digest() for p in pubs],['0x'+keccak(k.public_key.format(compressed=False)[1:])[-20:].hex() for k in keys])
    (FIX/'controlled-profile.bin').write_bytes(encode([PROFILE],[profile]))
    route=keccak(b'420/BRIDGE/ROUTE/XRP/MAINNET');gateway=bytes.fromhex('00'*17+'420420')
    user=PrivateKey((100).to_bytes(32,'big'));pub=user.public_key.format(compressed=True)
    source=hashlib.new('ripemd160',hashlib.sha256(pub).digest()).digest()
    memo=b'420XRPV1'+(420).to_bytes(32,'big')+int(0x420420).to_bytes(20,'big')+route+int(0xb0b).to_bytes(20,'big')
    scenarios=['success','failed','partial','issued','delivered-mismatch','wrong-tag','missing-tag','zero-tag','wrong-chain','wrong-router','wrong-route','missing-memo','zero-amount']
    for name in scenarios:
        data=memo
        if name=='wrong-chain':data=memo[:8]+(421).to_bytes(32,'big')+memo[40:]
        if name=='wrong-router':data=memo[:40]+int(0xbad).to_bytes(20,'big')+memo[60:]
        if name=='wrong-route':data=memo[:60]+keccak(b'wrong')+memo[92:]
        tx={'TransactionType':'Payment','Flags':0x80000000,'Sequence':1,'DestinationTag':420,'Amount':'42000000','Fee':'12',
            'SigningPubKey':pub.hex().upper(),'Account':encode_classic_address(source),'Destination':encode_classic_address(gateway),
            'Memos':[{'Memo':{'MemoData':data.hex().upper()}}]}
        if name=='partial':tx['Flags']|=0x20000
        if name=='issued':tx['Amount']={'currency':'USD','issuer':encode_classic_address(source),'value':'42'}
        if name=='wrong-tag':tx['DestinationTag']=421
        if name=='missing-tag':del tx['DestinationTag']
        if name=='zero-tag':tx['DestinationTag']=0
        if name=='missing-memo':del tx['Memos']
        if name=='zero-amount':tx['Amount']='0'
        # Real native transaction signature for the test owner, using the native signing prefix.
        signing=b'STX\0'+bytes.fromhex(serialize(tx));tx['TxnSignature']=user.sign(HALF(signing),hasher=None).hex().upper()
        transaction=bytes.fromhex(serialize(tx))
        md={'TransactionIndex':0,'AffectedNodes':[],'TransactionResult':'tecPATH_DRY' if name=='failed' else 'tesSUCCESS'}
        if name=='delivered-mismatch':md['DeliveredAmount']='1'
        metadata=bytes.fromhex(serialize(md));key=HALF(b'TXN\0'+transaction)
        leaf=HALF(b'SND\0'+vl(transaction)+vl(metadata)+key)
        children=[bytes(32) for _ in range(16)];children[key[0]>>4]=leaf;root=HALF(b'MIN\0'+b''.join(children))
        header=(1000).to_bytes(4,'big')+(100000000000000000).to_bytes(8,'big')+hashlib.sha256(b'controlled parent').digest()+root+hashlib.sha256(b'controlled state').digest()+(799999990).to_bytes(4,'big')+(800000000).to_bytes(4,'big')+bytes([10,0])
        ledger=HALF(b'LWR\0'+header);validations=[]
        for private,public in zip(keys,pubs):
            val={'Flags':0x80000001,'LedgerSequence':1000,'SigningTime':800000000,'LedgerHash':ledger.hex().upper(),'SigningPubKey':public.hex().upper()}
            val['Signature']=private.sign(HALF(b'VAL\0'+bytes.fromhex(serialize(val))),hasher=None).hex().upper()
            validations.append(bytes.fromhex(serialize(val)))
        (FIX/f'controlled-{name}.bin').write_bytes(encode(BUNDLE,[header,validations,transaction,metadata,[children]]))
    print('PASS: generated PUBLIC TEST-ONLY 5-member/4-quorum native validation and Payment fixtures.')

if __name__=='__main__':main()
