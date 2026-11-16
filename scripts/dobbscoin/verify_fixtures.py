#!/usr/bin/env python3
"""Offline verification of retained genuine and controlled evidence (no downloads)."""
import json
from pathlib import Path
from eth_abi import decode
from consensus import *
from fixtures import STATE,PROOF,state,leaf
ROOT=Path(__file__).resolve().parents[2];F=ROOT/'contracts/test/fixtures/dobbscoin'
def main():
    r=json.loads((F/'historical.json').read_text());require(r['source']==SOURCE and r['genesis']==GENESIS,'fixture source identity');require(r['blocks']==1914746 and r['transactions']==2140134 and r['emergency_blocks']==4,'retained qualification counts')
    for sample in r['samples']:
        h=bytes.fromhex(sample['header']);ph=pow_hash(h);require(ph.hex()==sample['scrypt_hash'],'scrypt fixture')
        require(dsha(h)[::-1].hex()==sample['block_hash'],'header identifier');target_=target(bits(h));require(sample['height']==0 or int.from_bytes(ph,'little')<=target_,'historical work')
        if sample['height']==0:require(sample['block_hash']==GENESIS and ph[::-1].hex()==GENESIS_POW,'genesis work exception')
        require(int(sample['chain_work'],16)==int(sample['parent_work'],16)+work(h),'chain work')
        ts=[bytes.fromhex(t) for t in sample['transactions']];ids=[]
        for raw in ts:t,end=tx(raw);require(end==len(raw),'transaction boundary');ids.append(t['id'])
        require(merkle(ids)==h[36:68],'transaction root')
    bundle=json.loads((F/'proofs.json').read_text());proofs=decode([PROOF+'[]'],bytes.fromhex(bundle['settledProofs'][2:]))[0];require(len(proofs)==28,'settled fixture count');samples={s['height']:s for s in r['samples']}
    for p in proofs:require(leaf(p[0])==leaf(state(samples[p[0][2]])),'state ABI schema');require(bundle['tipHeight']-p[0][2]+1>=288,'settled count')
    controlled=json.loads((F/'native-regtest-auxpow.json').read_text());require(controlled['classification']=='controlled-native-regtest','do not relabel controlled evidence as mainnet')
    child=bytes.fromhex(controlled['child_header']);parent=bytes.fromhex(controlled['parent_header']);check_aux(child,bytes.fromhex(controlled['parent_transaction']),parent,[],[],0,limit=(1<<255)-1)
    require(pow_hash(parent).hex()==controlled['scrypt_hash'],'native parent scrypt result');print('PASS',len(r['samples']),'genuine mainnet records,',len(proofs),'settled ABI records, controlled native AuxPoW')
if __name__=='__main__':main()
