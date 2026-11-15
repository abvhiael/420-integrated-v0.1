#!/usr/bin/env python3
"""Independent native XRPL publisher, manifest, validation and SHAMap verification."""
import base64
import hashlib
import json
from pathlib import Path
from coincurve import PublicKey
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from eth_abi import encode
from eth_hash.auto import keccak
from xrpl.core.binarycodec import decode, encode as serialize
from xrpl.core.addresscodec import decode_classic_address

ROOT = Path(__file__).resolve().parents[2]
FIX = ROOT/'contracts/test/fixtures/xrpl'
HALF = lambda b: hashlib.sha512(b).digest()[:32]
PUBLISHERS = {'ripple-vl.json':'ED2677ABFFD1B33AC6FBC3062B71F1E8397C1505E1C42C64D11AD1B28FF73F4734',
              'foundation-vl.json':'ED42AEC58B701EEBB77356FFFEC26F83C1F0407263530F068C7C73D392C7E06FD1'}

def require(ok,msg):
    if not ok: raise ValueError(msg)

def verify(key,sig,message):
    key=bytes.fromhex(key) if isinstance(key,str) else key
    sig=bytes.fromhex(sig) if isinstance(sig,str) else sig
    if key[0]==0xed:
        Ed25519PublicKey.from_public_bytes(key[1:]).verify(sig,message)
    else:
        require(PublicKey(key).verify(sig,HALF(message),hasher=None),'secp signature')

def manifest(encoded):
    raw=base64.b64decode(encoded,validate=True);d=decode(raw.hex())
    require(bytes.fromhex(serialize(d))==raw,'manifest canonical roundtrip')
    require(d['Sequence']!=0xffffffff,'revoked manifest')
    sig=d.pop('Signature');master=d.pop('MasterSignature')
    message=b'MAN\0'+bytes.fromhex(serialize(d))
    verify(d['PublicKey'],master,message);verify(d['SigningPubKey'],sig,message)
    return d

def vl(b):
    n=len(b)
    if n<=192:p=bytes([n])
    elif n<=12480:
        x=n-193;p=bytes([193+(x>>8),x&255])
    elif n<=918744:
        x=n-12481;p=bytes([241+(x>>16),(x>>8)&255,x&255])
    else:raise ValueError('VL size')
    return p+b

def main():
    reference=(FIX/'upstream-validators-example.txt').read_text()
    for pin in PUBLISHERS.values():require(pin in reference,'publisher pin missing from upstream mainnet reference')
    lists=[]
    for name,pin in PUBLISHERS.items():
        doc=json.loads((FIX/name).read_bytes());m=manifest(doc['manifest'])
        require(m['PublicKey']==pin==doc['public_key'],'pinned publisher identity')
        blob=base64.b64decode(doc['blob'],validate=True)
        verify(m['SigningPubKey'],doc['signature'],blob)
        data=json.loads(blob);members={}
        for v in data['validators']:
            entry=manifest(v['manifest'])
            require(entry['PublicKey']==v['validation_public_key'],'validator master binding')
            key=entry['SigningPubKey'];pub=PublicKey(bytes.fromhex(key)).format(compressed=False)
            require(key not in members,'duplicate signing key')
            members[key]={'master':entry['PublicKey'],'address':'0x'+keccak(pub[1:])[-20:].hex()}
        require(len({x['master'] for x in members.values()})==len(members),'duplicate master')
        lists.append((data,members))
    require(set(lists[0][1])==set(lists[1][1]),'publisher roster disagreement')
    data,members=lists[0]
    response=json.loads((FIX/'ledger.json').read_bytes())['result'];ledger=response['ledger']
    header=bytes.fromhex(ledger['ledger_data']);require(len(header)==118,'ledger header length')
    ledger_hash=HALF(b'LWR\0'+header);require(ledger_hash.hex()==response['ledger_hash'].lower(),'ledger hash')
    sequence=int.from_bytes(header[:4],'big');close=int.from_bytes(header[112:116],'big')
    require(close<data['expiration'],'list expiry')
    votes={}
    for message in json.loads((FIX/'validations.json').read_bytes()):
        raw=bytes.fromhex(message['data']);d=decode(raw.hex());key=d['SigningPubKey']
        if key not in members or d['LedgerHash'].lower()!=ledger_hash.hex():continue
        require(bytes.fromhex(serialize(d))==raw,'validation canonical roundtrip')
        require(d['Flags']&1 and d['LedgerSequence']==sequence,'full validation binding')
        require(abs(d['SigningTime']-close)<=300,'validation signing time')
        sig=d.pop('Signature');verify(key,sig,b'VAL\0'+bytes.fromhex(serialize(d)))
        votes.setdefault(key,raw)
    quorum=(4*len(members)+4)//5
    require(len(votes)>=quorum,'genuine trusted validator quorum unavailable')
    transactions=ledger['transactions'];leaves={};payloads={}
    for item in transactions:
        tx=bytes.fromhex(item['tx_blob']);meta=bytes.fromhex(item['meta']);key=HALF(b'TXN\0'+tx)
        require(key not in leaves,'duplicate transaction ID')
        payload=vl(tx)+vl(meta);leaves[key]=HALF(b'SND\0'+payload+key);payloads[key]=(tx,meta)
    paths={key:[] for key in leaves}
    def tree(keys,depth):
        if len(keys)==1 and depth>0:return leaves[keys[0]]
        require(depth<64,'SHAMap key collision')
        groups=[[] for _ in range(16)]
        for key in keys:groups[(key[depth//2]>>(4 if depth%2==0 else 0))&15].append(key)
        children=[tree(g,depth+1) if g else bytes(32) for g in groups]
        for key in keys:paths[key].insert(0,children)
        return HALF(b'MIN\0'+b''.join(children))
    root=tree(list(leaves),0);require(root==header[44:76],'transaction+metadata SHAMap root')
    # A successful native payment with an explicit destination tag and independently checked balance credit.
    chosen=transactions[69];tx=bytes.fromhex(chosen['tx_blob']);meta=bytes.fromhex(chosen['meta']);d=decode(tx.hex());md=decode(meta.hex());key=HALF(b'TXN\0'+tx)
    require(d['TransactionType']=='Payment' and isinstance(d['Amount'],str) and not d.get('Flags',0)&0x20000,'direct native payment')
    require(md['TransactionResult']=='tesSUCCESS','committed result')
    credit=False
    for a in md['AffectedNodes']:
        node=a.get('ModifiedNode',{})
        if node.get('FinalFields',{}).get('Account')==d['Destination']:
            credit=int(node['FinalFields']['Balance'])-int(node['PreviousFields']['Balance'])==int(d['Amount'])
    require(credit,'delivered gateway balance delta')
    ordered=sorted(members);masters=[HALF(bytes.fromhex(members[k]['master'])) for k in ordered]
    keys=[hashlib.sha256(bytes.fromhex(k)).digest() for k in ordered];addresses=[members[k]['address'] for k in ordered]
    snapshot=hashlib.sha256((FIX/'ripple-vl.json').read_bytes()).digest()
    profile_type='(bytes32,bytes32,uint32,uint32,uint32,uint32,uint16,bytes32[],bytes32[],address[])'
    profile=(keccak(b'XRPL/MAINNET'),snapshot,sequence,sequence,close-300,min(data['expiration'],close+300),quorum,masters,keys,addresses)
    (FIX/'historical-profile.bin').write_bytes(encode([profile_type],[profile]))
    (FIX/'historical-header.bin').write_bytes(header)
    (FIX/'historical-validations.bin').write_bytes(encode(['bytes[]'],[[votes[k] for k in ordered if k in votes]]))
    (FIX/'historical-payment.bin').write_bytes(encode(['bytes','bytes','bytes32[16][]'],[tx,meta,paths[key]]))
    expected={'ledger_index':sequence,'ledger_hash':ledger_hash.hex(),'transaction_root':root.hex(),'full_ledger_transactions':len(leaves),
        'authenticated_publisher_lists':2,'trusted_validators':len(members),'genuine_unique_validations':len(votes),'quorum':quorum,
        'transaction_hash':key.hex(),'amount_drops':int(d['Amount']),'destination_tag':d['DestinationTag'],
        'source':decode_classic_address(d['Account']).hex(),'gateway':decode_classic_address(d['Destination']).hex(),'proof_depth':len(paths[key])}
    (FIX/'expected.json').write_text(json.dumps(expected,indent=2)+'\n')
    print(json.dumps(expected,indent=2));print('PASS: authenticated publisher lists/manifests, native validated-ledger quorum, ledger hash, complete SHAMap root and successful native tagged payment/balance credit.')

if __name__=='__main__':main()
