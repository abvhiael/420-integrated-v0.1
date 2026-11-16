#!/usr/bin/env python3
"""Reconstruct and independently validate genuine mainnet raw blocks, without chainstate.
Tip must come from the separately replayed pinned native client; this script is
not a replacement for native scripts/UTXOs, checkpoints or reorg selection.
"""
import argparse,concurrent.futures,json,mmap,os,sqlite3,struct,time as clock
from pathlib import Path
from hashlib import sha256
from consensus import *

def hashes(batch):return [pow_hash(h) for h in batch]
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--blocks',type=Path,required=True);ap.add_argument('--work',type=Path,required=True);ap.add_argument('--tip',required=True);ap.add_argument('--height',type=int,required=True);ap.add_argument('--workers',type=int,default=2);ap.add_argument('--sample',type=int,action='append',default=[]);a=ap.parse_args();a.work.mkdir(parents=True,exist_ok=True)
    db=sqlite3.connect(a.work/'raw-index.sqlite');db.execute('CREATE TABLE IF NOT EXISTS blocks (hash BLOB PRIMARY KEY,header BLOB,file TEXT,offset INTEGER,size INTEGER)')
    if not db.execute('SELECT count(*) FROM blocks').fetchone()[0]:
        for f in sorted(a.blocks.glob('blk*.dat')):
            batch=[]
            with f.open('rb') as stream:
                while True:
                    prefix=stream.read(8)
                    if not prefix or prefix==b'\0'*8:break
                    require(len(prefix)==8 and prefix[:4]==MAGIC,'record magic');size=struct.unpack('<I',prefix[4:])[0];require(80<size<=1000000,'block size');offset=stream.tell();header=stream.read(80);stream.seek(size-80,1)
                    batch.append((dsha(header),header,str(f.resolve()),offset,size))
                    if len(batch)==10000:db.executemany('INSERT OR IGNORE INTO blocks VALUES (?,?,?,?,?)',batch);batch=[]
            db.executemany('INSERT OR IGNORE INTO blocks VALUES (?,?,?,?,?)',batch);db.commit();print('indexed',f.name,flush=True)
    headers=[None]*(a.height+1);locations=[None]*(a.height+1);current=bytes.fromhex(a.tip)[::-1]
    for height in range(a.height,-1,-1):
        row=db.execute('SELECT header,file,offset,size FROM blocks WHERE hash=?',(current,)).fetchone();require(row is not None,'missing ancestor '+str(height));headers[height]=row[0];locations[height]=row[1:];current=row[0][4:36]
    require(current==bytes(32),'genesis parent');db.close()
    (a.work/'headers.bin').write_bytes(b''.join(headers))
    selected={0,1,2015,2016,2017,13578,13579,13580,31596,31597,31598,68424,68425,68426,1888807,1888808,1888809,1888867,1888868,1888869,1888887,1888888,1888889,1999999,2000000,2000001,a.height-287,a.height}|set(a.sample)
    require(all(0<=h<=a.height for h in a.sample),'sample height outside qualified history')
    work_headers=headers.copy();auxes=[None]*len(headers);tx_offsets=[80]*len(headers)
    for height,h in enumerate(headers):
        if int.from_bytes(h[:4],'little')&256:
            filename,offset,size=locations[height]
            with open(filename,'rb') as stream:stream.seek(offset);raw=stream.read(size)
            auxes[height],tx_offsets[height]=read_aux(raw);work_headers[height]=auxes[height]['parent_header']
    samples=[];total_work=0;counts={};emergencies=0;started=clock.monotonic();txcount=0;streams={};native_tx_sample=None
    try:
        with concurrent.futures.ProcessPoolExecutor(a.workers) as pool:
            batches=[work_headers[i:i+1000] for i in range(0,len(work_headers),1000)]
            # map buffers only the compact headers, not raw block payloads.
            for batch_id,pows in enumerate(pool.map(hashes,batches)):
                for j,ph in enumerate(pows):
                    height=batch_id*1000+j;h=headers[height];check_header(h,headers,height,ph,auxes[height]);previous=total_work;total_work+=work(h);m=mode(height);counts[str(m)]=counts.get(str(m),0)+1
                    if height and emergency(height,h,headers[height-1]):emergencies+=1
                    filename,offset,size=locations[height]
                    if filename not in streams:streams[filename]=open(filename,'rb')
                    stream=streams[filename];stream.seek(offset);raw=stream.read(size);require(len(raw)==size,'truncated raw block');n,at=cs(raw,tx_offsets[height]);transactions=[]
                    for _ in range(n):t,at=tx(raw,at);transactions.append(t)
                    require(at==len(raw),'block trailing bytes');require(merkle([t['id'] for t in transactions])==h[36:68],'transaction root');txcount+=n
                    if height in selected or (height and emergency(height,h,headers[height-1])):
                        mtp=0 if height==0 else sorted(time(headers[i]) for i in range(max(0,height-11),height))[min(11,height)//2]
                        sample={'height':height,'block_hash':dsha(h)[::-1].hex(),'header':h.hex(),'scrypt_hash':ph.hex(),'expected_bits':bits(h) if height==0 else expected(headers,height),'parent_work':hex(previous),'chain_work':hex(total_work),'parent_time':0 if height==0 else time(headers[height-1]),'median_time_past':mtp,'transaction_count':n,'transactions':[t['raw'].hex() for t in transactions]}
                        if auxes[height] is not None:sample['auxpow']=aux_json(auxes[height]);sample['work_header']=work_headers[height].hex()
                        samples.append(sample)
                    if native_tx_sample is None and height>68425 and len(transactions)>1:
                        native_tx_sample={'height':height,'block':raw.hex(),'block_hash':dsha(h)[::-1].hex()}
                if batch_id%100==0:print('verified',height,'elapsed',round(clock.monotonic()-started),flush=True)
    finally:
        for stream in streams.values():stream.close()
    result={'source':SOURCE,'genesis':GENESIS,'height':a.height,'tip':a.tip,'blocks':len(headers),'transactions':txcount,'difficulty_modes':counts,'emergency_blocks':emergencies,'chain_work':hex(total_work),'headers_sha256':sha256(b''.join(headers)).hexdigest(),'samples':samples,'historical_transaction':native_tx_sample}
    (a.work/'history.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ('samples','historical_transaction')}),flush=True)
if __name__=='__main__':main()
