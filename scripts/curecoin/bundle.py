#!/usr/bin/env python3
"""Create an UNSIGNED replay-state checkpoint candidate; never signs or activates routes."""
import argparse,hashlib,json
from pathlib import Path
from eth_abi import encode,decode
from consensus import SOURCE,GENESIS,require
from generate_controlled import PROOF,STATE

def destination_comment(chain_id,router,route,recipient):
    require(chain_id>0 and len(route)==32 and route!=bytes(32),'destination domain')
    require(len(bytes.fromhex(router.removeprefix('0x')))==20 and int(router,16)>0,'router')
    target=bytes.fromhex(recipient.removeprefix('0x'));require(len(target)==20 and int.from_bytes(target,'big')>0,'recipient')
    return b'420CUREV1'+hashlib.sha256(encode(['string','uint256','address','bytes32'],['420/CURE/DESTINATION/V1',chain_id,router,route])).digest()+target

def candidate(proof_raw,replay,history):
    p=decode([PROOF],proof_raw)[0];state=p[0]
    require(encode([PROOF],[p])==proof_raw,'noncanonical proof encoding')
    require(replay['source']==history['source']==SOURCE and replay['assumevalid']=='0' and replay['mainnet'] is True and replay['connections']==0,'unqualified native replay')
    require(replay['height']+1==history['canonical_blocks'] and replay['tip']==history['tip'] and replay['chain_trust']==history['chain_trust'],'replay/canonical-chain disagreement')
    require(state[0]==bytes.fromhex(GENESIS) and state[1]==bytes.fromhex(SOURCE)+bytes(12),'proof network/source')
    h=str(state[2]);sample=history['samples'][h];require(state[3].hex()==sample['hash'],'proof canonical hash')
    require(state[3][::-1]==hashlib.sha256(hashlib.sha256(p[3]).digest()).digest(),'header hash')
    require(state[-1]==sample['minimum_stake_age'] and state[13]==int(sample['kernel_modifier'],16),'replay stake context')
    for height,native in replay['selected'].items():
        independent=history['samples'][height]
        require(native['hash']==independent['hash'] and native['modifier']==independent['modifier'] and native['modifierchecksum']==independent['modifier_checksum'],'native/independent state disagreement')
        if independent['pos']:require(native['proofhash']==bytes.fromhex(independent['kernel_raw'])[::-1].hex(),'native/independent kernel disagreement')
    root=hashlib.sha256(encode(['string',STATE],['420/CURE/NATIVE-REPLAY-STATE/V1',state])).hexdigest()
    require(root==sample['state_leaf'],'proof state differs from qualified replay projection')
    return {'classification':'UNSIGNED; requires configured AuthenticatedCheckpoint420 authority, not a native consensus certificate','source':SOURCE,'network':'CURECOIN/MAINNET','height':replay['height'],'block_hash':replay['tip'],'state_root':root,'proof_height':state[2],'confirmations':replay['height']-state[2]+1,'proof_sha256':hashlib.sha256(proof_raw).hexdigest()}

def main():
    p=argparse.ArgumentParser();p.add_argument('--proof',type=Path,required=True);p.add_argument('--native-report',type=Path,required=True);p.add_argument('--native-report-sha256',required=True);p.add_argument('--history',type=Path,required=True);p.add_argument('--history-sha256',required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--route');p.add_argument('--chain-id',type=int);p.add_argument('--router');p.add_argument('--gateway-script-sha256');a=p.parse_args()
    require(hashlib.sha256(a.native_report.read_bytes()).hexdigest()==a.native_report_sha256,'native report hash');require(hashlib.sha256(a.history.read_bytes()).hexdigest()==a.history_sha256,'history hash')
    proof_raw=a.proof.read_bytes();method='verifyFinalizedBlock(bytes)'
    if a.route:
        from consensus import transaction
        p_=list(decode([PROOF],proof_raw)[0]);route=bytes.fromhex(a.route.removeprefix('0x'));tx,end=transaction(p_[9]);require(end==len(p_[9]) and p_[10]>=2,'deposit transaction')
        require(a.chain_id and a.router and a.gateway_script_sha256,'deployment domain and gateway binding required')
        require(tx['comment']==destination_comment(a.chain_id,a.router,route,'0x'+tx['comment'][41:].hex()),'signed destination comment')
        require(p_[12]<len(tx['outputs']) and tx['outputs'][p_[12]][0]>0 and hashlib.sha256(tx['outputs'][p_[12]][1]).hexdigest()==a.gateway_script_sha256.removeprefix('0x'),'gateway output')
        p_[-1]=route;proof_raw=encode([PROOF],[p_]);method='verifyFinalizedTransfer(bytes)'
    out=candidate(proof_raw,json.loads(a.native_report.read_text()),json.loads(a.history.read_text()));from eth_hash.auto import keccak
    out['verification_calldata']='0x'+(keccak(method.encode())[:4]+encode(['bytes'],[proof_raw])).hex()
    a.out.with_suffix('.proof.bin').write_bytes(proof_raw);a.out.write_text(json.dumps(out,indent=2)+'\n');print('PASS unsigned canonical replay candidate; no signing or activation')
if __name__=='__main__':main()
