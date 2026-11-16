#!/usr/bin/env python3
"""Independent historical kernel/modifier/header/UTXO projection and proof extraction.
All ordinary script/reward validation remains the pinned fresh native replay's job.
"""
import argparse,hashlib,json,mmap,struct,time,bisect
from pathlib import Path
from coincurve import PublicKey,ecdsa
from eth_abi import encode
from consensus import *
from generate_controlled import STATE,PROOF
ROOT=Path(__file__).resolve().parents[2]
ANCHORS={0:GENESIS,1:'000000002f4984003de245a1666d8a8271ddf4236cf190bb9a2595dc4e7d4696',11000:'ea83da9e532a4e5e5b0fabea3e427c06b0e8b8b59e4ee3d926a2b0757b60d529',130000:'1a42c44f40a1ffe6539d37175559c307340811c9c43277cd99ba8e6370d46bb5',148000:'6eff6bbe6b2f5f6282b8628f6d7185e454c715f89a6d9a250df1fc0f6e0ed4e7',180646:'9cbc41346470862c61a2acba7b4773128339fe9ffd6c1da6e566657a4eb6f2c5',208090:'7c0b71191e9419f0ac6a0dad5a4fedb056f190dd0c3aa67628e51c8bf2e7d943',250000:'9466a840d8f31e7100a6669db27e965f0b5d8d27a3a2e4708f11f424d9224c46',257310:'bc7a3cecea050289c2b8eb67a7ba64fd0b6926728d3d8339a7026224ba64fbf1',500000:'e7ef734c9072344412d94493fcf13aa13d2b94f3344bba2c9cda100872d9505d'}
CHECKSUMS={0:0x0e00670b,1:0x5189c78a,11000:0x97a10217,130000:0xf3878d42,148000:0x111af91c,180646:0xb85b7dd1,208090:0x5bcb7d1b,250000:0x1c511315,257310:0x2b0c04b1,500000:0x2f99c0d4}
SAMPLES={0,1,9688,9689,14060,14061,15000,15001,257310,257321,257322,257323,257324,500000}
def verify_sig(digest,sig,pub):
    parsed=ecdsa.der_to_cdata(sig);_,normal=ecdsa.signature_normalize(parsed)
    require(PublicKey(pub).verify(ecdsa.cdata_to_der(normal),digest,hasher=None),'native block signature')
def stake_key(script):
    require(len(script) in (35,67) and script[0]==len(script)-2 and script[-1]==0xac,'coinstake output1 P2PK');return script[1:-1]
def modifier(previous,records):
    if previous is None:return 0,True
    last=previous
    while not records[last]['generated']:last-=1
    old=records[last]['modifier'];last_time=records[last]['time'];parent=records[previous]
    if last_time//21600>=parent['time']//21600:return old,False
    start=parent['time']//21600*21600-SELECTION_INTERVAL;cursor=previous;candidates=[]
    while cursor>=0 and records[cursor]['time']>=start:
        r=records[cursor];candidates.append((r['time'],int.from_bytes(r['hash'],'little'),cursor));cursor-=1
    candidates.sort();used=set();value=0;stop=start;scores={}
    for _,_,index in candidates:
        r=records[index];score=int.from_bytes(H((r['proof'] if r['pos'] else r['hash'])+struct.pack('<Q',old)),'little');scores[index]=score>>32 if r['pos'] else score
    for round_ in range(min(64,len(candidates))):
        stop+=21600*63//(63+(63-round_)*2);best=None;chosen=None
        for timestamp,_,index in candidates:
            if best is not None and timestamp>stop:break
            if index in used:continue
            score=scores[index]
            if best is None or score<best:best=score;chosen=index
        require(chosen is not None,'modifier candidate');used.add(chosen);value|=records[chosen]['entropy']<<round_
    return value,True

def main():
 p=argparse.ArgumentParser();p.add_argument('--blocks',type=Path,required=True);p.add_argument('--index',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--tip',default=ANCHORS[500000]);p.add_argument('--height',type=int,default=500000);p.add_argument('--sample',type=int,action='append',default=[]);p.add_argument('--transaction-index',type=int);p.add_argument('--output-index',type=int);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
 rows=json.loads(a.index.read_text());lookup={r[2]:r for r in rows};tip=bytes.fromhex(a.tip)[::-1];chain=[]
 with a.blocks.open('rb') as f:
  data=mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ)
  while True:
   row=lookup[tip.hex()];chain.append(row)
   if row[3]==0:break
   tip=data[row[0]+12:row[0]+44]
  chain.reverse();require(len(chain)==a.height+1,'complete canonical ancestry')
  utxo={};records=[];types={False:[],True:[]};mint_age=30*86400;total=0;pos_count=0;sample_info={};normal_selected=False;generated_heights=[];started=time.monotonic()
  for height,row in enumerate(chain):
   offset,size,_,_=row;raw=data[offset+8:offset+8+size];header=raw[:80];hash_=H(header);ntime,bits=struct.unpack_from('<II',header,68);count,q=varint(raw,80);txs=[]
   for _ in range(count):
    tx_offset=q;tx,q=transaction(raw,q);tx['offset']=tx_offset;txs.append(tx)
   sig_len,q=varint(raw,q);require(q+sig_len==len(raw),'block framing');sig=raw[q:];pos=len(txs)>1 and txs[1]['stake'];require(eligible_kind(height,pos),'PoW transition')
   require(header[36:68]==merkle([t['id'] for t in txs]),'transaction root');require(len({t['id'] for t in txs})==len(txs),'duplicate transaction')
   require(0<decode_target(bits)<=limit(height,pos),'target limit');require(compact(decode_target(bits))==bits,'compact canonicality')
   previous=types[pos];expected=compact(limit(height,pos)) if len(previous)<2 or previous[-2]==0 else next_bits(records[previous[-1]]['bits'],records[previous[-1]]['time'],records[previous[-2]]['time'],pos,height,previous[-1])
   require(bits==expected,f'retarget height {height}: {bits:08x}!={expected:08x}')
   if height:
    require(header[4:36]==records[-1]['hash'],'ancestry');median=sorted(r['time'] for r in records[-11:])[len(records[-11:])//2];require(ntime>median and ntime+7200>=records[-1]['time'],'timestamp')
    version=int.from_bytes(header[:4],'little');require(1<=version<=4 and (height<=14060 or version>=3),'version')
   else:median=0
   new_modifier,generated=modifier(height-1 if height else None,records);proof=bytes(32);origin=None;chosen_modifier=0;state=None
   if pos:
    stake=txs[1];key=stake['inputs'][0][:2];require(key in utxo,'stake spent/missing origin');origin=utxo[key];amount,script,origin_height,origin_block_time,txprev_time,txprev_offset,txprev_raw,mint=origin
    require(stake['time']==ntime and (not mint or height-origin_height>=10),'stake time/maturity');require(origin_block_time+mint_age<=ntime and txprev_time<=ntime,'minimum age')
    cursor=bisect.bisect_right(generated_heights,origin_height)
    while cursor<len(generated_heights) and records[generated_heights[cursor]]['time']<origin_block_time+SELECTION_INTERVAL:cursor+=1
    require(cursor<len(generated_heights),'future kernel modifier missing');c=generated_heights[cursor]
    chosen_modifier=records[c]['modifier'];proof=kernel(chosen_modifier,origin_block_time,txprev_offset,txprev_time,key[1],ntime)
    age=min(ntime-txprev_time,90*86400)-mint_age;w=amount*age//COIN//86400;require(w>=0 and int.from_bytes(proof,'little')<=w*decode_target(bits),f'weighted kernel height {height}')
    verify_sig(hash_,sig,stake_key(stake['outputs'][1][1]));pos_count+=1
   else:require(int.from_bytes(hash_,'little')<=decode_target(bits),'proof of work')
   entropy=(hash_[0]&1) if height>=9689 else hashlib.new('ripemd160',hashlib.sha256(sig).digest()).digest()[-1]>>7
   flags=int(pos)|(entropy<<1)|(int(generated)<<2);checksum=int.from_bytes(H((struct.pack('<I',records[-1]['checksum']) if height else b'')+struct.pack('<I',flags)+proof+struct.pack('<Q',new_modifier)),'little')>>224
   total+=trust(bits,pos);r={'hash':hash_,'time':ntime,'bits':bits,'pos':pos,'proof':proof,'modifier':new_modifier,'generated':generated,'entropy':entropy,'checksum':checksum,'trust':total};records.append(r);types[pos].append(height)
   if generated:generated_heights.append(height)
   if height in ANCHORS:require(hash_[::-1].hex()==ANCHORS[height],'hardened anchor')
   if height in CHECKSUMS:require(checksum==CHECKSUMS[height],f'modifier checksum {height}: {checksum:08x}')
   take=height in SAMPLES|set(a.sample) or (height>257324 and count>2 and not normal_selected)
   if take:
    if height>257324 and count>2 and not normal_selected:normal_selected=True
    name=f'block-{height}.bin';(a.output/name).write_bytes(raw);entry={'height':height,'hash':hash_[::-1].hex(),'time':ntime,'bits':f'{bits:08x}','pos':pos,'chain_trust':str(total),'modifier':f'{new_modifier:016x}','modifier_checksum':f'{checksum:08x}','transactions':count,'classification':'GENUINE OFFICIAL ARCHIVE; independently checked; ordinary scripts/rewards require native replay'}
    if pos:
     state=[bytes.fromhex(GENESIS),bytes.fromhex(SOURCE)+bytes(12),height,hash_[::-1],hashlib.sha256(header).digest(),records[-2]['trust'],total,min(2,len(previous)-1),records[previous[-2]]['bits'] if len(previous)>1 else 0,records[previous[-2]]['time'] if len(previous)>1 else 0,records[previous[-3]]['time'] if len(previous)>2 else 0,median,records[-2]['time'],chosen_modifier,key[0],key[1],amount,hashlib.sha256(script).digest(),origin_height,origin_block_time,txprev_time,txprev_offset,mint,True,mint_age]
     selected_index=a.transaction_index if height in a.sample and a.transaction_index is not None else (2 if count>2 else 1);require(0<=selected_index<count,'transaction index');selected=txs[selected_index];leaves=[t['id'] for t in txs];proof_packet=[state,0,[],header,txs[1]['raw'],sig,txprev_raw,count,branch(leaves,1),selected['raw'],selected_index,branch(leaves,selected_index),a.output_index if height in a.sample and a.output_index is not None else next((i for i,(value,_) in enumerate(selected['outputs']) if value>0),0),bytes(32)]
     (a.output/f'stake-{height}.bin').write_bytes(encode([PROOF],[proof_packet]));entry['state_leaf']=hashlib.sha256(encode(['string',STATE],['420/CURE/NATIVE-REPLAY-STATE/V1',state])).hexdigest();entry['kernel_raw']=proof.hex();entry['kernel_modifier']=f'{chosen_modifier:016x}';entry['minimum_stake_age']=mint_age
    sample_info[str(height)]=entry
   for tx in txs:
    if not tx['coinbase']:
     for inp in tx['inputs']:require(inp[:2] in utxo,'spent input/missing value');del utxo[inp[:2]]
    for index,(amount,script) in enumerate(tx['outputs']):
     if amount:utxo[(tx['id'],index)]=(amount,script,height,ntime,tx['time'],tx['offset'],tx['raw'],tx['coinbase'] or tx['stake'])
   # Exact fresh canonical replay mutation: GetCoinAge executes after the kernel check.
   if pos and height-1>HF:mint_age=4*86400
   if height%50000==0:print('checked',height,'blocks',round(time.monotonic()-started,2),'seconds',flush=True)
  (a.output/'historical.json').write_text(json.dumps({'source':SOURCE,'canonical_blocks':len(chain),'pos_blocks':pos_count,'tip':a.tip,'chain_trust':str(total),'source_raw_sha256':hashlib.sha256(data).hexdigest(),'samples':sample_info},indent=2)+'\n');print('PASS independent historical consensus, kernels, modifiers, signatures and UTXO projection')
if __name__=='__main__':main()
