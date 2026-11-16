#!/usr/bin/env python3
"""Extract compact, independently verified fixtures without repeating the full audit."""
import argparse,json,sqlite3,struct
from pathlib import Path
from eth_abi import encode
from consensus import *
STATE='(bytes32,bytes32,uint64,bytes32,bytes32,bytes32,bytes32,bytes32,uint256,uint256,uint32,uint32,uint32)'
AUX='(bytes,bytes32[],uint32,bytes32[],uint32,bytes)'
PROOF=f'({STATE},uint32,bytes32[],bytes,{AUX},bytes,uint32,bytes32[],uint32,uint32,address,bytes32)'
EMPTY_AUX=(b'',[],0,[],0,b'')
def state(sample):
    h=bytes.fromhex(sample['header']);return (bytes.fromhex(GENESIS),bytes.fromhex(SOURCE)+bytes(12),sample['height'],bytes.fromhex(sample['block_hash']),h[4:36][::-1],sha256(h).digest(),sha256(bytes.fromhex(sample.get('work_header',sample['header']))).digest(),bytes.fromhex(sample['scrypt_hash']),int(sample['parent_work'],16),int(sample['chain_work'],16),sample['expected_bits'],sample['parent_time'],sample['median_time_past'])
def leaf(s):return sha256(encode(['string',STATE],['420/BOB/NATIVE-REPLAY-STATE/V1',s])).digest()
def proof(sample):
    a=sample.get('auxpow');aux=EMPTY_AUX if a is None else (bytes.fromhex(a['coinbase']),[bytes.fromhex(x) for x in a['parent_branch']],a['parent_index'],[bytes.fromhex(x) for x in a['chain_branch']],a['chain_index'],bytes.fromhex(a['parent_header']))
    return (state(sample),0,[],bytes.fromhex(sample['header']),aux,b'',0,[],0,0,'0x0000000000000000000000000000000000000000',bytes(32))
def make_branch(ids,index):
    branch=[]
    while len(ids)>1:
        if len(ids)%2:ids=ids+[ids[-1]]
        branch.append(ids[index^1]);index//=2;ids=[dsha(ids[i]+ids[i+1]) for i in range(0,len(ids),2)]
    return branch

def main():
    p=argparse.ArgumentParser();p.add_argument('--history',type=Path,required=True);p.add_argument('--headers',type=Path,required=True);p.add_argument('--index',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--sample',type=int,action='append',default=[]);a=p.parse_args();r=json.loads(a.history.read_text());raw=a.headers.read_bytes();require(sha256(raw).hexdigest()==r['headers_sha256'],'qualified header checksum');headers=[raw[i:i+80] for i in range(0,len(raw),80)];samples={s['height']:s for s in r['samples']};special=r['historical_transaction']['height']
    require(all(0<=h<=r['height'] for h in a.sample),'sample outside qualified history')
    extras={special}|set(a.sample)|{h for h in range(1888888,r['height']+1) if emergency(h,headers[h],headers[h-1])};db=sqlite3.connect(a.index);cumulative=0
    for height,h in enumerate(headers):
        previous=cumulative;cumulative+=work(h)
        if height not in extras or height in samples:continue
        filename,offset,size=db.execute('SELECT file,offset,size FROM blocks WHERE hash=?',(dsha(h),)).fetchone()
        with open(filename,'rb') as stream:stream.seek(offset);block=stream.read(size)
        aux=None;tx_at=80
        if int.from_bytes(h[:4],'little')&256:aux,tx_at=read_aux(block)
        n,at=cs(block,tx_at);transactions=[]
        for _ in range(n):t,at=tx(block,at);transactions.append(t['raw'].hex())
        mtp=sorted(time(headers[i]) for i in range(max(0,height-11),height));ph=pow_hash(h if aux is None else aux['parent_header'])
        samples[height]={'height':height,'block_hash':dsha(h)[::-1].hex(),'header':h.hex(),'scrypt_hash':ph.hex(),'expected_bits':expected(headers,height),'parent_work':hex(previous),'chain_work':hex(cumulative),'parent_time':time(headers[height-1]),'median_time_past':mtp[len(mtp)//2],'transaction_count':n,'transactions':transactions}
        if aux is not None:samples[height]['auxpow']=aux_json(aux);samples[height]['work_header']=aux['parent_header'].hex()
    require(cumulative==int(r['chain_work'],16),'preserved cumulative work');db.close();r['samples']=[samples[h] for h in sorted(samples)]
    settled=[proof(s) for s in r['samples'] if 0<s['height']<=r['height']-287]
    s=samples[special];t=[bytes.fromhex(t) for t in s['transactions']];ids=[dsha(t_) for t_ in t];chosen=1;historical=list(proof(s));historical[5]=t[chosen];historical[6]=chosen;historical[7]=make_branch(ids,chosen)
    result={'classification':'genuine-mainnet; no historical transaction is asserted to be a deployed bridge deposit','tipHeight':r['height'],'tipHash':'0x'+r['tip'],'settledProofs':'0x'+encode([PROOF+'[]'],[settled]).hex(),'historicalOutput':'0x'+encode([PROOF],[tuple(historical)]).hex()}
    a.output.mkdir(parents=True,exist_ok=True);(a.output/'historical.json').write_text(json.dumps(r,indent=2)+'\n');(a.output/'proofs.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'settled_genuine_proofs':len(settled),'emergency_fixture_heights':[h for h in sorted(extras) if h>0 and emergency(h,headers[h],headers[h-1])],'requested_samples':a.sample}))
if __name__=='__main__':main()
