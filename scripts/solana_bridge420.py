#!/usr/bin/env python3
"""Public proof encoding and verification; never signs keys or treats RPC labels as finality.
A validator/stake manifest remains an external trust input and must match the root
already approved on the destination. This module cannot manufacture that approval.
"""
import hashlib,json
from pathlib import Path
from eth_abi import encode
from eth_hash.auto import keccak
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
GENESIS=bytes.fromhex('45296998a6f8e2a784db5d9f95e18fc23f70441a1039446801089879b08c7ef0')
E='(bytes32,bytes32,uint64,bytes32,bytes32,bytes32,bytes32,address,uint64,uint64,uint256,address,bytes32,uint32,bool,bytes32[],bytes32[],bytes,uint32)'
C='(uint64,uint64,bytes32,bytes32,bytes32)'
V='(bytes32,bytes32,uint64,uint32,bytes32[],bytes)'
P='('+E+',bytes)'
sha=lambda b:hashlib.sha256(b).digest()
def prime_point(raw):
    if len(raw)!=32:return False
    p=2**255-19;l=2**252+27742317777372353535851937790883648493;d=-121665*pow(121666,p-2,p)%p
    value=int.from_bytes(raw,'little');y=value&((1<<255)-1);sign=value>>255
    if y>=p:return False
    den=(d*y*y+1)%p
    if den==0:return False
    x2=(y*y-1)*pow(den,p-2,p)%p;x=pow(x2,(p+3)//8,p)
    if x*x%p!=x2:x=x*pow(2,(p-1)//4,p)%p
    if x*x%p!=x2 or (x==0 and sign):return False
    if x&1!=sign:x=p-x
    if x==0 and y==1:return False
    def add(a,b):
        x,y,z,t=a;u,v,w,s=b;aa=(y-x)*(v-u)%p;bb=(y+x)*(v+u)%p;cc=2*d*t*s%p;dd=2*z*w%p;e=(bb-aa)%p;f=(dd-cc)%p;g=(dd+cc)%p;h=(bb+aa)%p
        return(e*f%p,g*h%p,f*g%p,e*h%p)
    a=(x,y,1,x*y%p);q=(0,1,1,0)
    while l:
        if l&1:q=add(q,a)
        a=add(a,a);l//=2
    return q[0]==0 and (q[1]-q[2])%p==0

def merkle_manifest(epoch,records):
    records=sorted(records,key=lambda r:r[0])
    assert records and len({r[0] for r in records})==len(records),'duplicate vote account'
    assert all(len(a)==32 and a!=bytes(32) and prime_point(k) and 0<s<2**64 for a,k,s in records)
    total=sum(r[2] for r in records);assert total<2**64
    layers=[[sha(encode(['bytes32','uint64','bytes32','bytes32','uint64'],[GENESIS,epoch,a,k,s])) for a,k,s in records]]
    while len(layers[-1])>1:
        level=layers[-1];layers.append([sha(level[i]+level[min(i+1,len(level)-1)]) for i in range(0,len(level),2)])
    proofs=[]
    for i in range(len(records)):
        at=i;proof=[]
        for level in layers[:-1]:proof.append(level[min(at^1,len(level)-1)]);at//=2
        proofs.append(proof)
    return records,total,layers[-1][0],proofs

def claim(proof):
    execution,raw=proof
    return (execution[2]//432000,execution[2],execution[1],sha(raw),sha(encode([E],[execution])))

def digest(claim_,chain,quorum,root,snapshot,total):
    assert len(root)==len(snapshot)==32 and root!=bytes(32) and snapshot!=bytes(32)
    return sha(encode(['string','bytes32','uint256','address',C,'bytes32','bytes32','uint64'],['420/SOLANA/VALIDATOR-ATTESTATION/V1',GENESIS,chain,quorum,claim_,root,snapshot,total]))

def verify_certificate(proof,votes,chain,quorum,root,snapshot,total):
    c=claim(proof);assert proof[0][0]==GENESIS and c[0]>0 and c[1]>0 and c[2]!=bytes(32)
    h=digest(c,chain,quorum,root,snapshot,total);seen=set();weight=0
    for account,key,stake,index,branch,signature in votes:
        assert account not in seen and stake>0 and stake<=total and len(branch)<=32
        seen.add(account);leaf=sha(encode(['bytes32','uint64','bytes32','bytes32','uint64'],[GENESIS,c[0],account,key,stake]));at=index
        for sibling in branch:leaf=sha(leaf+sibling) if at&1==0 else sha(sibling+leaf);at//=2
        assert at==0 and leaf==root,'invalid stake membership'
        assert prime_point(key) and len(signature)==64 and prime_point(signature[:32]) and int.from_bytes(signature[32:],'little')<2**252+27742317777372353535851937790883648493
        Ed25519PublicKey.from_public_bytes(key).verify(signature,h);weight+=stake;assert weight<=total
    assert weight*3>total*2,'insufficient stake'
    return h

def calldata(proof,votes):
    c=claim(proof)
    return {'submit_votes':['0x'+(keccak(('submitVote('+C+','+V+')').encode())[:4]+encode([C,V],[c,v])).hex() for v in votes],
            'verify_finalized_transfer':'0x'+(keccak(b'verifyFinalizedTransfer(bytes)')[:4]+encode(['bytes'],[encode([P],[proof])])).hex()}

if __name__=='__main__':
    import argparse
    from eth_abi import decode
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--bundle',type=Path,required=True);p.add_argument('--expected-bundle-sha256',required=True);p.add_argument('--quorum',required=True);p.add_argument('--chain-id',type=int,required=True);p.add_argument('--trusted-root',required=True);p.add_argument('--snapshot-hash',required=True);p.add_argument('--total-stake',type=int,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
    raw=a.bundle.read_bytes();assert sha(raw).hex()==a.expected_bundle_sha256.lower().removeprefix('0x'),'unexpected certificate bundle'
    proof,c,votes,root,snapshot,total=decode([P,C,V+'[]','bytes32','bytes32','uint64'],raw);assert tuple(c)==claim(proof)
    assert root.hex()==a.trusted_root.lower().removeprefix('0x') and snapshot.hex()==a.snapshot_hash.lower().removeprefix('0x') and total==a.total_stake, 'bundle does not match approved trust anchors'
    digest_=verify_certificate(proof,votes,a.chain_id,a.quorum,root,snapshot,total)
    result=calldata(proof,votes);result['claim_digest']='0x'+digest_.hex();result['trust']='Conditional on the exact quorum address and governance-approved validator/stake snapshot; this does not authenticate the manifest by itself.'
    a.out.write_text(json.dumps(result,indent=2)+'\n')
