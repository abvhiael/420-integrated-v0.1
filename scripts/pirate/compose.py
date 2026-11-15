#!/usr/bin/env python3
"""Compose an unsigned inbound proof from a worker receipt and published native
checkpoint membership. This has NO signing or RPC-finality fallback. The EVM
checks the actual governance-approved checkpoint; supplying a root here does
not establish authority. Never pass a viewing key to this process.
"""
import argparse
import hashlib
import json
from pathlib import Path
from eth_abi import encode
from eth_hash.auto import keccak
from evidence import require,equihash

FIELDS = [
 ('genesis','bytes32'),('source','bytes32'),('height','uint64'),('blockHash','bytes32'),('headerSha256','bytes32'),
 ('transactionHash','bytes32'),('rawTransactionSha256','bytes32'),('chainWork','uint256'),('parentWork','uint256'),
 ('saplingRoot','bytes32'),('ironwoodRoot','bytes32'),('recoveryAnchor','bytes32'),
 ('notarizedHeight','uint64'),('notarizedHash','bytes32'),('notarizationTransaction','bytes32'),
 ('notarySetHash','bytes32'),('anchorEvidenceDigest','bytes32'),('nativeExecutionDigest','bytes32'),
 ('gatewayKeyId','bytes32'),('pool','uint8'),('outputIndex','uint32'),('notePosition','uint64'),('noteCommitment','bytes32'),
 ('nullifier','bytes32'),('noteRoot','bytes32'),('memoHash','bytes32'),('recipient','address'),('amount','uint64'),('validation','uint8')]
RECORD = '('+','.join(t for _,t in FIELDS)+')'
PROOF = '('+RECORD+',uint32,bytes32[],bytes,bytes,bytes)'
SOURCE='b14db80bfc1a819b958e36d1e0127e94c395d445'
NETWORK=keccak(b'PIRATE/MAINNET')
def raw(s):
    require(isinstance(s,str),'hex string required')
    return bytes.fromhex(s.removeprefix('0x'))
def value(record,name,typ):
    v=record[name]
    if typ=='bytes32':
        v=raw(v);require(len(v)==32,'bytes32 width')
    elif typ.startswith('uint'):
        require(type(v) is int and 0<=v<2**int(typ[4:]),'integer width')
    return v

def compose(e,receipt,destination_chain,router,route):
    require(set(e)=={'record','index','branch','header','transaction','memo','checkpoint_root','checkpoint_height'},'proof schema')
    r=e['record'];require(set(r)=={n for n,_ in FIELDS},'record schema')
    require(receipt.get('source')==SOURCE and all(receipt.get(x) is True for x in ['shielded_authorization_validated','ownership_validated','witness_validated']),'isolated worker receipt required')
    require(raw(r['source'])==bytes.fromhex(SOURCE)+bytes(12) and r['validation']==127,'qualified native context required')
    require(r['genesis'].removeprefix('0x')=='027e3758c3a65b12aa1046462b486d0a63bfa1beae327897f56c5cfb7daaae71','network identity')
    header,tx,memo=map(raw,(e['header'],e['transaction'],e['memo']))
    require(len(header)==1487 and len(tx)<=4_000_000 and len(memo)==512,'proof bounds')
    require(hashlib.sha256(header).digest()==raw(r['headerSha256']) and hashlib.sha256(tx).digest()==raw(r['rawTransactionSha256']),'raw evidence binding')
    pairs={'key_id':'gatewayKeyId','pool':'pool','output_index':'outputIndex','position':'notePosition','note_commitment':'noteCommitment','nullifier':'nullifier','root':'noteRoot','amount':'amount','recipient':'recipient','raw_sha256':'rawTransactionSha256','memo':'memoHash'}
    for source,target in pairs.items():
        if source=='memo':require(hashlib.sha256(raw(receipt[source])).digest()==raw(r[target]) and raw(receipt[source])==memo,'memo receipt binding')
        elif isinstance(receipt[source],int):require(receipt[source]==r[target],'numeric receipt binding')
        else:require(raw(receipt[source])==raw(r[target]),'worker receipt binding')
    require(raw(receipt['txid'])[::-1]==raw(r['transactionHash']),'native transaction ID byte order')
    domain=keccak(encode(['string','bytes32','uint256','address','bytes32','bytes32','uint8'],['420/ARRR/DEPOSIT/V1',NETWORK,destination_chain,router,raw(route),raw(r['gatewayKeyId']),r['pool']]))
    require(memo[:8]==b'420ARRR1' and memo[8:40]==domain and memo[40:60]==raw(r['recipient']) and int.from_bytes(memo[60:68],'little')==r['amount'] and memo[68:]==bytes(444),'deposit memo domain')
    require(0<r['amount']<=200_000_000*100_000_000 and r['pool'] in (0,1) and r['notePosition']<2**32,'note limits')
    require(raw(r['noteRoot'])==raw(r['saplingRoot'] if r['pool']==0 else r['ironwoodRoot']),'native commitment tree')
    require(0<r['height']<r['notarizedHeight']<=e['checkpoint_height'] and 3<=e['checkpoint_height']-r['height']+1<2**32,'strict notarization and confirmations')
    for f in ['notarizedHash','notarizationTransaction','notarySetHash','anchorEvidenceDigest','nativeExecutionDigest','noteCommitment','nullifier']:
        require(raw(r[f])!=bytes(32),'missing native dependency')
    require(equihash(header)==raw(r['blockHash']).hex(),'native header identity')
    bits=int.from_bytes(header[104:108],'little');size=bits>>24;word=bits&0x7fffff;target=word>>(8*(3-size)) if size<=3 else word<<(8*(size-3))
    require(r['chainWork']>r['parentWork'] and r['chainWork']-r['parentWork']==(1<<256)//(target+1),'native chain selection')
    if r['height']>=4176945:require(raw(r['recoveryAnchor']).hex()=='00000007cf016224dc6e7b7101dc3d7e4cd792f7dbbce18003ff577e399acca1','abandoned fork')
    values=tuple(value(r,n,t) for n,t in FIELDS);root=hashlib.sha256(encode(['string',RECORD],['420/ARRR/NATIVE-SHIELDED-STATE/V1',values])).digest()
    index=e['index'];branch=[raw(x) for x in e['branch']];require(type(index) is int and 0<=index<2**32 and len(branch)<=32,'membership index')
    for sibling in branch:
        require(len(sibling)==32,'membership sibling');root=hashlib.sha256(sibling+root if index&1 else root+sibling).digest();index>>=1
    require(index==0 and root==raw(e['checkpoint_root']),'published checkpoint membership')
    return encode([PROOF],[(values,e['index'],branch,header,tx,memo)])

def main():
    p=argparse.ArgumentParser();p.add_argument('evidence');p.add_argument('receipt');p.add_argument('--chain-id',type=int,required=True);p.add_argument('--router',required=True);p.add_argument('--route',required=True);a=p.parse_args()
    print('0x'+compose(json.loads(Path(a.evidence).read_text()),json.loads(Path(a.receipt).read_text()),a.chain_id,a.router,a.route).hex())
if __name__=='__main__':main()
