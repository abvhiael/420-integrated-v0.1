"""Read-only finalized tournament recovery observation; never signs or submits transactions."""
import argparse,hashlib,json,os,urllib.request
from pathlib import Path
from Crypto.Hash import keccak

class UnsafeObservation(RuntimeError):pass

def k256(data):
 h=keccak.new(digest_bits=256);h.update(data);return h.hexdigest()

def config_hash(config):return hashlib.sha256(json.dumps(config,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def observe(rpc,config,previous=None):
 chain=int(rpc('eth_chainId',[]),16)
 if chain!=config['chainId']:raise UnsafeObservation('Wrong chain')
 genesis=rpc('eth_getBlockByNumber',['0x0',False])
 if genesis['hash'].lower()!=config['genesisHash'].lower():raise UnsafeObservation('Wrong genesis')
 confirmations=config['confirmations']
 if not isinstance(confirmations,int)or isinstance(confirmations,bool)or not 1<=confirmations<=128:raise UnsafeObservation('Invalid confirmation bound')
 head=int(rpc('eth_blockNumber',[]),16)
 if head<confirmations:raise UnsafeObservation('Insufficient confirmations')
 at=head-confirmations;tag=hex(at);block=rpc('eth_getBlockByNumber',[tag,False])
 if not block or int(block['number'],16)!=at:raise UnsafeObservation('Missing finalized block')
 identity=config_hash(config)
 if previous:
  if previous['configurationSHA256']!=identity:raise UnsafeObservation('Changed deployment configuration')
  if previous['blockNumber']>at:raise UnsafeObservation('Finality regressed')
  old=rpc('eth_getBlockByNumber',[hex(previous['blockNumber']),False])
  if not old or old['hash']!=previous['blockHash']:raise UnsafeObservation('Canonical checkpoint reorged; review before reset')
 bindings={}
 for name in ['coordinator','bank','host','engine','entropy']:
  binding=config['bindings'][name];address=binding['address']
  if len(address)!=42 or int(address,16)==0:raise UnsafeObservation('Invalid '+name+' address')
  code=rpc('eth_getCode',[address,tag]);raw=bytes.fromhex(code.removeprefix('0x'))
  if not raw or k256(raw)!=binding['runtimeKeccak256'].removeprefix('0x').lower():raise UnsafeObservation('Runtime mismatch: '+name)
  bindings[name]={'address':address.lower(),'runtimeKeccak256':k256(raw)}
 event=config['eventId'];table=config.get('table',0)
 if len(event)!=66 or int(event,16)==0 or not isinstance(table,int)or not 0<=table<=64:raise UnsafeObservation('Invalid event/table')
 data='0x'+k256(b'snapshot(bytes32,uint32)')[:8]+event.removeprefix('0x')+format(table,'064x')
 snapshot=rpc('eth_call',[{'to':bindings['coordinator']['address'],'data':data},tag])
 if len(snapshot)!=66 or int(snapshot,16)==0:raise UnsafeObservation('Invalid canonical snapshot')
 again=rpc('eth_getBlockByNumber',[tag,False])
 if again['hash']!=block['hash']:raise UnsafeObservation('Reorg during observation')
 return {'schema':'420-poker-5c8-observation-v1','configurationSHA256':identity,'chainId':chain,'genesisHash':genesis['hash'],'blockNumber':at,'blockHash':block['hash'],'confirmations':confirmations,'eventId':event,'table':table,'snapshot':snapshot,'bindings':bindings,'transactionSubmissionEnabled':False,'officialTestnetAccepted':False}

def consensus(rpcs,config,previous=None):
 if len(rpcs)<2:raise UnsafeObservation('Two RPC observations required')
 rows=[observe(rpc,config,previous)for rpc in rpcs]
 if any(row!=rows[0]for row in rows[1:]):raise UnsafeObservation('RPC disagreement')
 return rows[0]

def client(url):
 def rpc(method,params):
  req=urllib.request.Request(url,json.dumps({'jsonrpc':'2.0','id':1,'method':method,'params':params}).encode(),{'Content-Type':'application/json'})
  with urllib.request.urlopen(req,timeout=20)as response:d=json.load(response)
  if d.get('error')or d.get('id')!=1 or'result'not in d:raise UnsafeObservation('RPC failed: '+method)
  return d['result']
 return rpc

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--config',required=True);p.add_argument('--rpc',action='append',required=True);p.add_argument('--checkpoint',required=True);a=p.parse_args()
 if len(set(a.rpc))<2:raise UnsafeObservation('Distinct RPC endpoints required')
 cfg=json.loads(Path(a.config).read_text(encoding='utf-8'));path=Path(a.checkpoint);previous=json.loads(path.read_text(encoding='utf-8'))if path.exists()else None
 row=consensus([client(url)for url in a.rpc],cfg,previous);temp=path.with_suffix(path.suffix+'.tmp');temp.write_text(json.dumps(row,indent=2)+'\n',encoding='utf-8');os.replace(temp,path);print(json.dumps(row))
if __name__=='__main__':main()
