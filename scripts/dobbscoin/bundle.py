#!/usr/bin/env python3
"""Build native replay checkpoint Merkle evidence; never signs or publishes it.

The authority must authenticate execution and custody of the pinned native replay.
A JSON receipt or RPC endpoint is not cryptographic proof of running that process.
"""
import argparse,json
from pathlib import Path
from eth_abi import encode,decode
from eth_hash.auto import keccak
from fixtures import STATE,PROOF,proof,leaf
from consensus import SOURCE,GENESIS,require
from hashlib import sha256
TYPE='Checkpoint(uint256 chainId,address registry,bytes32 network,uint256 epoch,uint64 height,bytes32 blockHash,bytes32 stateRoot,bytes32 predecessor)'
def build(history,native):
    require(history.get('source')==SOURCE and history.get('genesis')==GENESIS,'independent source identity')
    require(native.get('source')==SOURCE and native.get('created_fresh_from_raw_only') is True and native.get('assumevalid')=='0' and native.get('connections')==0,'native replay receipt required; RPC-only metadata unsupported')
    if native.get('checkpoints_disabled') is not True:
        coverage=native.get('script_validation',{})
        require(coverage.get('source')==SOURCE and coverage.get('first_height')==1 and coverage.get('last_height')==1847999 and coverage.get('native_checkpoint_height')==1848000 and coverage.get('headers_sha256')==history.get('headers_sha256') and coverage.get('verified_inputs',0)>0 and coverage.get('tampered_historical_signature_rejected') is True,'historical checkpoint-skipped script qualification missing')
    chain=native.get('chain',{});require(chain.get('chain')=='main' and chain.get('blocks')==history['height'] and chain.get('bestblockhash')==history['tip'] and int(chain.get('chainwork','0'),16)==int(history['chain_work'],16),'native/independent selected chain disagreement')
    genesis=native.get('selected',{}).get('0',{});require(genesis.get('hash')==GENESIS,'native genesis')
    ps=[proof(s) for s in history['samples'] if 0<s['height']<=history['height']-287];require(bool(ps),'no settled records');nodes=[leaf(p[0]) for p in ps];branches=[[] for p in ps];indices=list(range(len(ps)))
    while len(nodes)>1:
        if len(nodes)%2:nodes=nodes+[nodes[-1]]
        for i,index in enumerate(indices):branches[i].append(nodes[index^1]);indices[i]//=2
        nodes=[sha256(nodes[i]+nodes[i+1]).digest() for i in range(0,len(nodes),2)]
    encoded=[]
    for i,p in enumerate(ps):p=list(p);p[1]=i;p[2]=branches[i];encoded.append('0x'+encode([PROOF],[tuple(p)]).hex())
    return {'network':'0x'+keccak(b'DOBBSCOIN/MAINNET').hex(),'height':history['height'],'blockHash':'0x'+history['tip'],'root':'0x'+nodes[0].hex(),'proofs':encoded,'source':SOURCE,'trust_model':'governance-selected authenticated native replay authority, not a permissionless light client'}
def signing_digest(bundle,chain_id,registry,epoch,predecessor):
    return keccak(encode(['bytes32','uint256','address','bytes32','uint256','uint64','bytes32','bytes32','bytes32'],[keccak(TYPE.encode()),chain_id,registry,bytes.fromhex(bundle['network'][2:]),epoch,bundle['height'],bytes.fromhex(bundle['blockHash'][2:]),bytes.fromhex(bundle['root'][2:]),bytes.fromhex(predecessor.removeprefix('0x'))]))
def main():
    p=argparse.ArgumentParser();p.add_argument('--history',type=Path,required=True);p.add_argument('--native',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();history=json.loads(a.history.read_text());native=json.loads(a.native.read_text());result=build(history,native)
    result['abiProofs']='0x'+encode([PROOF+'[]'],[[decode([PROOF],bytes.fromhex(x[2:]))[0] for x in result['proofs']]]).hex()
    result['independent_receipt_sha256']=sha256(a.history.read_bytes()).hexdigest();result['native_receipt_sha256']=sha256(a.native.read_bytes()).hexdigest();a.output.write_text(json.dumps(result,indent=2)+'\n');print('checkpoint root',result['root'],'settled records',len(result['proofs']))
if __name__=='__main__':main()
