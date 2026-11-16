#!/usr/bin/env python3
"""Stream official raw block corpus; verify actual SHA256d linkage and static anchors.
The archive's database/wallet contents are never imported. Index is for fresh native replay.
"""
import argparse,json,struct,hashlib,mmap,time
from pathlib import Path
from consensus import *
ROOT=Path(__file__).resolve().parents[2]
def main():
 p=argparse.ArgumentParser();p.add_argument('--blocks',type=Path,required=True);p.add_argument('--prefix',type=Path,required=True);a=p.parse_args();records=[];byhash={};position=0;previous=bytes(32);height=-1;selected={};start=time.monotonic()
 with a.blocks.open('rb') as f:
  data=mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ)
  while position+8<=len(data):
   require(data[position:position+4]==bytes.fromhex('e4e8e9e5'),'network magic');size=int.from_bytes(data[position+4:position+8],'little');require(80<size<=1000000 and position+8+size<=len(data),'block size')
   header=data[position+8:position+88];h=H(header);parent=header[4:36]
   if parent in byhash:n=byhash[parent]+1
   elif h[::-1].hex()==GENESIS:n=0
   else:raise ValueError('unknown block parent')
   byhash[h]=n;records.append((position,size,h.hex(),n));height=max(height,n)
   if n in (0,1,9688,9689,14060,14061,15000,15001,257310,257321,257322,257323,257324,500000):
    b=data[position+8:position+8+size];count,q=varint(b,80);txs=[]
    for _ in range(count):tx,q=transaction(b,q);txs.append(tx)
    length,q=varint(b,q);require(q+length==len(b),'signature framing');require(merkle([t['id'] for t in txs])==header[36:68],'transaction root')
    selected[str(n)]={'raw':b.hex(),'hash':h[::-1].hex(),'transactions':len(txs)}
   position+=8+size
  require(position==len(data),'trailing bytes')
 a.prefix.mkdir(parents=True,exist_ok=True);(a.prefix/'index.json').write_text(json.dumps(records));(a.prefix/'selected.json').write_text(json.dumps(selected,indent=2)+'\n');print(json.dumps({'blocks':len(records),'max_height':height,'seconds':round(time.monotonic()-start,2),'file_sha256':hashlib.sha256(data).hexdigest(),'selected':{k:v['hash'] for k,v in selected.items()}},indent=2))
if __name__=='__main__':main()
