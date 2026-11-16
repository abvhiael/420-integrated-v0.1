#!/usr/bin/env python3
"""Independent BSC fixture oracle. Python/py_ecc is not the Solidity implementation.
Default checks every recorded output. --write regenerates derived binary fixtures.
"""
import argparse,json,rlp,hashlib,zipfile
from pathlib import Path
from eth_hash.auto import keccak
from eth_abi import encode
from eth_keys import keys as secp
from trie import HexaryTrie
from py_ecc.bls import G2ProofOfPossession as BLS
from py_ecc.bls.g2_primitives import pubkey_to_G1,signature_to_G2
from py_ecc.bls.hash_to_curve import hash_to_field_FQ2
from py_ecc.optimized_bls12_381.optimized_swu import optimized_swu_G2,iso_map_G2
from py_ecc.optimized_bls12_381 import normalize,multiply,add
from py_ecc.optimized_bls12_381.constants import H_EFF_G2
from hashlib import sha256
r=Path(__file__).resolve().parent
write=argparse.ArgumentParser();write.add_argument('--write',action='store_true');write=write.parse_args().write
archive=zipfile.ZipFile(r/'historical-source.zip')
def source(name):return json.loads(archive.read(name))
def emit(name,data):
 p=r/name
 if write:p.write_bytes(data)
 else:assert p.read_bytes()==data, 'derived output mismatch: '+name
f=lambda n:(int(n)>>256,int(n)%2**256)
f2=lambda v:tuple(f(c) for c in v.coeffs)
F='(uint256,uint256)';F2='('+F+','+F+')';W='('+F+'[],'+F2+','+F2+'[2])'
hb=lambda v:bytes.fromhex(v.removeprefix('0x'))
num=lambda v:int(v,16) if isinstance(v,str) and v.startswith('0x') else int(v)
def require(ok,message):assert ok,message
fields=['parentHash','sha3Uncles','miner','stateRoot','transactionsRoot','receiptsRoot','logsBloom','difficulty','number','gasLimit','gasUsed','timestamp','extraData','mixHash','nonce','baseFeePerGas','withdrawalsRoot','blobGasUsed','excessBlobGas','parentBeaconBlockRoot','requestsHash']
ints={'difficulty','number','gasLimit','gasUsed','timestamp','baseFeePerGas','blobGasUsed','excessBlobGas'}
headers={}
for name in archive.namelist():
 if not name.startswith('header_'):continue
 h=source(name);parts=[]
 for k in fields:
  if k not in h:break
  parts.append(num(h[k]) if k in ints else hb(h[k]))
 raw=rlp.encode(parts);assert keccak(raw)==hb(h['hash']);emit(name.replace('.json','.rlp'),raw)
 extra=hb(h['extraData']);sealed=parts.copy();sealed[12]=extra[:-65];seal=keccak(rlp.encode([56]+sealed))
 assert secp.Signature(extra[-65:]).recover_public_key_from_msg_hash(seal).to_canonical_address()==hb(h['miner'])
 headers[num(h['number'])]=h
for n,h in headers.items():
 if n-1 in headers:assert h['parentHash']==headers[n-1]['hash']
print('PASS',len(headers),'historical header hashes, mainnet-domain secp256k1 seals and ancestry')
def bls_vector(name,pks,message,signature):
 ts=hash_to_field_FQ2(message,2,b'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_',sha256)
 roots=[f2(y/z) for x,y,z in [optimized_swu_G2(t) for t in ts]]
 witness=([f(pubkey_to_G1(k)[1]) for k in pks],f2(signature_to_G2(signature)[1]),roots)
 emit(name,encode(['bytes[]','bytes32','bytes',W],[pks,message,signature,witness]))
 return ts
message=sha256(b'420/BNB/BLS/CANCUN/V1').digest();pk=BLS.SkToPk(123);signature=BLS.Sign(123,message)
ts=bls_vector('bls-vector.bin',[pk],message,signature)
mapped=[iso_map_G2(*optimized_swu_G2(t)) for t in ts];q=add(*mapped);x,y=normalize(q);x2,y2=normalize(multiply(q,H_EFF_G2));emit('bls-hash-oracle.bin',encode([F2,F2,F2,F2],[f2(x),f2(y),f2(x2),f2(y2)]))
wrong=sha256(b'WRONG MESSAGE').digest();assert not BLS.FastAggregateVerify([pk],wrong,signature);bls_vector('bls-wrong-message.bin',[pk],wrong,signature)
for target,epoch in [(116664000,116663000),(116664001,116663000),(116664090,116664000),(116664091,116664000)]:
 e=hb(headers[epoch]['extraData']);n=e[32];roster=sorted([(e[33+i*68:53+i*68],e[53+i*68:101+i*68]) for i in range(n)])
 extra=hb(headers[target+1]['extraData']);vote=extra[32:-65];v=rlp.decode(vote);mask=int.from_bytes(v[0]);selected=[k for i,(a,k) in enumerate(roster) if mask>>i&1];message=keccak(rlp.encode(v[2]));signature=v[1]
 assert len(selected)>=(2*n+2)//3 and mask>>n==0 and int.from_bytes(v[2][2])==target
 assert BLS.FastAggregateVerify(selected,message,signature)
 emit(f'vote_{target}.rlp',vote);bls_vector(f'vote_{target}.bin',selected,message,signature)
 print('PASS historical BLS quorum',target,len(selected),'of',n)
def tx_bytes(t):
    typ=num(t.get('type','0x0'));to=hb(t['to']) if t.get('to') else b''
    data=hb(t.get('input',t.get('data','0x')))
    access=[[hb(a['address']),[hb(s) for s in a['storageKeys']]] for a in t.get('accessList',[])]
    n=lambda k:num(t[k]);sig=[num(t.get('yParity',t.get('v','0x0'))),n('r'),n('s')]
    if typ==0:fields=[n('nonce'),n('gasPrice'),n('gas'),to,n('value'),data,n('v'),n('r'),n('s')]
    elif typ==1:fields=[n('chainId'),n('nonce'),n('gasPrice'),n('gas'),to,n('value'),data,access]+sig
    elif typ in (2,3,4):
        fields=[n('chainId'),n('nonce'),n('maxPriorityFeePerGas'),n('maxFeePerGas'),n('gas'),to,n('value'),data,access]
        if typ==3:fields += [n('maxFeePerBlobGas'),[hb(h) for h in t['blobVersionedHashes']]]
        if typ==4:fields += [[[num(a['chainId']),hb(a['address']),num(a['nonce']),num(a['yParity']),num(a['r']),num(a['s'])] for a in t['authorizationList']]]
        fields += sig
    else:raise ValueError('unsupported transaction envelope')
    raw=(bytes([typ]) if typ else b'')+rlp.encode(fields)
    require(keccak(raw)==hb(t['hash']),'transaction identity mismatch')
    return raw

def receipt_bytes(r):
    typ=num(r.get('type','0x0'))
    logs=[[hb(l['address']),[hb(t) for t in l['topics']],hb(l['data'])] for l in r['logs']]
    body=rlp.encode([num(r['status']),num(r['cumulativeGasUsed']),hb(r['logsBloom']),logs])
    return (bytes([typ]) if typ else b'')+body


b=source('block_116663999.json');v=source('receipts_116663999.json')
txs=[tx_bytes(t) for t in b['transactions']];rs=[receipt_bytes(t) for t in v];assert len(txs)==len(rs)
tt=HexaryTrie(db={});rt=HexaryTrie(db={})
for i,(t,s) in enumerate(zip(txs,rs)):
 assert v[i]['transactionHash']==b['transactions'][i]['hash'];assert num(v[i]['transactionIndex'])==i
 tt[rlp.encode(i)]=t;rt[rlp.encode(i)]=s
assert tt.root_hash==hb(b['transactionsRoot']);assert rt.root_hash==hb(b['receiptsRoot'])
indices=[('native',next(i for i,t in enumerate(b['transactions']) if num(t['value'])>0 and t['input']=='0x' and num(v[i]['status'])==1))]
log=next((i,j) for i,rec in enumerate(v) for j,l in enumerate(rec['logs']) if len(l['topics'])==3 and l['topics'][0]=='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef')
indices.append(('token',log[0]));out=[]
for name,i in indices:
 assert num(v[i]["status"])==1, "historical selected transaction reverted"
 tp=[rlp.encode(n) for n in tt.get_proof(rlp.encode(i))];rp=[rlp.encode(n) for n in rt.get_proof(rlp.encode(i))];tp=[n for j,n in enumerate(tp) if j==0 or len(n)>=32];rp=[n for j,n in enumerate(rp) if j==0 or len(n)>=32]
 assert HexaryTrie.get_from_proof(tt.root_hash,rlp.encode(i),tuple(rlp.decode(n) for n in tp))==txs[i]
 assert HexaryTrie.get_from_proof(rt.root_hash,rlp.encode(i),tuple(rlp.decode(n) for n in rp))==rs[i]
 args=((r/'header_116663999.rlp').read_bytes(),i,txs[i],tp,rs[i],rp,log[1] if name=='token' else 0)
 emit(f'historical-{name}.bin',encode(['(bytes,uint64,bytes,bytes[],bytes,bytes[],uint32)'],[args]));out.append({'kind':name,'index':i,'transactionHash':b['transactions'][i]['hash']})
emit('transactions-expected.json',(json.dumps({'block':116663999,'count':len(txs),'transactionsRoot':b['transactionsRoot'],'receiptsRoot':b['receiptsRoot'],'vectors':out},indent=2)+'\n').encode())
print('PASS',len(txs),'genuine transactions and receipts, both roots, native and token inclusion')
