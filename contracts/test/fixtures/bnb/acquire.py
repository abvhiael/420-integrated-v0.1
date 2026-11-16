#!/usr/bin/env python3
"""Recapture immutable mainnet JSON into a separate reviewable archive.
The recorded archive is never overwritten by default. Run verify.py against the
recorded archive for qualification; compare hashes before replacing any evidence.
"""
import argparse,json,subprocess,zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--rpc',default='https://bsc-mainnet.public.blastapi.io');p.add_argument('--out',type=Path,required=True);a=p.parse_args()
if a.out.exists():raise SystemExit('Refusing to overwrite an existing capture; choose a new --out path')
def post(request):
 response=subprocess.run(['curl','--fail','--silent','--show-error','--max-time','45','-H','Content-Type: application/json','-H','User-Agent: 420-BNB-fixture-capture/1','--data-binary',json.dumps(request),a.rpc],check=True,capture_output=True,text=True)
 return json.loads(response.stdout)
def rpc(method,params):
 v=post({'jsonrpc':'2.0','id':1,'method':method,'params':params})
 if 'error' in v:raise RuntimeError(v['error'])
 if v.get('result') is None:raise RuntimeError('Missing RPC result: '+method)
 return v['result']
assert int(rpc('eth_chainId',[]),16)==56,'wrong network'
headers=[116662000,116663000,*range(116663998,116664093)]
files={}
for start in range(0,len(headers),40):
 nums=headers[start:start+40];batch=post([{'jsonrpc':'2.0','id':n,'method':'eth_getBlockByNumber','params':[hex(n),False]} for n in nums])
 assert isinstance(batch,list) and len(batch)==len(nums)
 for v in batch:
  assert isinstance(v.get('result'),dict),v
  h=v['result'];assert int(h['number'],16)==v['id'];files[f"header_{v['id']}.json"]=h
block=rpc('eth_getBlockByNumber',[hex(116663999),True]);files['block_116663999.json']=block
receipts={}
for start in range(0,len(block['transactions']),40):
 txs=block['transactions'][start:start+40];batch=post([{'jsonrpc':'2.0','id':start+i,'method':'eth_getTransactionReceipt','params':[t['hash']]} for i,t in enumerate(txs)])
 assert isinstance(batch,list) and len(batch)==len(txs)
 for v in batch:
  assert isinstance(v.get('result'),dict),v
  receipts[v['id']]=v['result']
files['receipts_116663999.json']=[receipts[i] for i in range(len(receipts))]
a.out.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(a.out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for name,obj in sorted(files.items()):z.writestr(name,json.dumps(obj,indent=2)+'\n')
print('Captured',len(headers),'headers and',len(receipts),'receipts at',a.out)
