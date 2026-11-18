#!/usr/bin/env python3
"""Read-only live Stake snapshot collector and deployment-evidence structure check.

Never signs, sends transactions, kills a process or changes canonical state.
A collected snapshot/complete evidence structure is NOT a live acceptance GO.
"""
import argparse, datetime, hashlib, ipaddress, json, os, pathlib, re, subprocess, urllib.parse, urllib.request
HEX=re.compile(r'^[0-9a-f]{64}$');ROOT=re.compile(r'^0x[0-9a-f]{64}$')
ROLES={'execution','settlement','signer','validator','indexer','monitor'}
SCENARIOS={'consensus-restart','execution-restart','simultaneous-restart','pre-journal-crash','interrupted-write','signer-unavailable','engine-unavailable','stale-sequence','checkpoint-mismatch','duplicate-replay','bounded-reorg','finalized-conflict','accounting-discrepancy','indexer-rebuild','alarm-retry-recovery','backup-restore','exit-withdrawal'}
class Invalid(Exception):pass

def require(ok):
 if not ok:raise Invalid('OPERATIONAL_EVIDENCE_INVALID')
def unique(pairs):
 out={}
 for k,v in pairs:
  require(k not in out);out[k]=v
 return out
def decode(raw):return json.loads(raw,object_pairs_hook=unique)
def digest(raw):return hashlib.sha256(raw).hexdigest()
def root(v):
 require(isinstance(v,list) and len(v)==32 and all(type(x)==int and 0<=x<=255 for x in v));return '0x'+bytes(v).hex()
def endpoint(value):
 u=urllib.parse.urlsplit(value);require(u.scheme in ['http','https'] and u.hostname and not u.username and not u.password and not u.query and not u.fragment)
 if u.scheme=='http':
  try:require(ipaddress.ip_address(u.hostname).is_loopback)
  except ValueError:raise Invalid('OPERATIONAL_ENDPOINT_INVALID')
 return value
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):raise Invalid('OPERATIONAL_REDIRECT_REJECTED')
def request(url,body=None):
 url=endpoint(url);data=None if body is None else json.dumps(body).encode()
 req=urllib.request.Request(url,data=data,headers={'Content-Type':'application/json'})
 with urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect()).open(req,timeout=15) as r:
  raw=r.read(2*1024*1024+1);require(len(raw)<=2*1024*1024);return decode(raw)
def rpc(url,method,params):
 r=request(url,{'jsonrpc':'2.0','id':1,'method':method,'params':params});require(r.get('id')==1 and not r.get('error') and 'result' in r);return r['result']
def config(raw,approved):
 require(HEX.fullmatch(approved) and digest(raw)==approved);c=decode(raw)
 require(c['schema']=='420-stake-live-config-v1' and c['environment']=='public-testnet' and re.fullmatch(r'[a-zA-Z0-9_-]{1,64}',c['deploymentId']))
 require(re.fullmatch('[0-9a-f]{40}',c['releaseSHA']) and ROOT.fullmatch(c['genesisHash']) and HEX.fullmatch(c['trustSHA256']))
 require(c['independentWitness'] is True and c['witnessBackupDomain'] and c['witnessBackupDomain']!=c['deploymentId'])
 for k in ['rpcURL','engineURL','monitorURL']:endpoint(c[k])
 require(set(c['processes'])==ROLES)
 for p in c['processes'].values():require(type(p['pid'])==int and p['pid']>1 and HEX.fullmatch(p['sha256']))
 require(HEX.fullmatch(c['reconciler']['sha256']))
 require(set(c['runtimeSHA256'])=={'0x0000000000000000000000000000000000000423','0x000000000000000000000000000000000000043c'})
 require(all(HEX.fullmatch(x) for x in c['runtimeSHA256'].values()))
 return c
def process_evidence(c):
 out={}
 for role,p in c['processes'].items():
  os.kill(p['pid'],0);exe=pathlib.Path('/proc')/str(p['pid'])/'exe'
  require(digest(exe.read_bytes())==p['sha256'])
  require('fixture' not in os.readlink(exe).lower())
  out[role]={'pid':p['pid'],'binarySHA256':p['sha256']}
 require(len({p['pid'] for p in out.values()})==len(ROLES));return out

def sequence_anchor(raw,anchor):
 s=decode(raw);keys=['schema','chainId','executionBlock','blockHash','lastSequence','checksum'];require(set(s)==set(keys))
 require(s['schema']=='420-stake-systemcall-sequence-v2')
 for k in ['chainId','executionBlock','lastSequence']:require(type(s[k])==int and 0<=s[k]<2**64)
 require(ROOT.fullmatch(s['blockHash']) and HEX.fullmatch(s['checksum']))
 normalized={k:('' if k=='checksum' else s[k]) for k in keys}
 require(digest(json.dumps(normalized,separators=(',',':')).encode())==s['checksum'])
 require(s['chainId']==anchor['ChainID']==420 and s['executionBlock']==anchor['ExecutionBlock'] and s['blockHash']==root(anchor['BlockHash']) and s['lastSequence']==anchor['LastSequence'])
 return s

def collect(c,approved):
 # Require a stable canonical boundary. The existing approved Go binary owns all
 # BLS/QC/PoP/ancestry/finality/native-log/accounting verification; Python does
 # not reinterpret RPC claims as consensus authority.
 processes=process_evidence(c);trust=pathlib.Path(c['trustFile']).read_bytes();require(digest(trust)==c['trustSHA256'])
 directory=pathlib.Path(c['consensusDir']);before={n:(directory/n).read_bytes() for n in ['history.json','checkpoint.json','sequence.json']}
 binary=pathlib.Path(c['reconciler']['path']);require(binary.resolve()==binary.absolute() and binary.is_file() and binary.stat().st_mode&0o022==0);require(digest(binary.read_bytes())==c['reconciler']['sha256'])
 args=[str(binary),'--trust',c['trustFile'],'--trust-sha256',c['trustSHA256'],'--consensus-dir',c['consensusDir'],'--indexer-store',c['indexerStore'],'--engine',c['engineURL'],'--rpc',c['rpcURL'],'--jwt-secret',c['engineJWTFile']]
 run=subprocess.run(args,capture_output=True,timeout=90);require(run.returncode==0 and len(run.stdout)<=8*1024*1024)
 report=decode(run.stdout);require(report['schema']=='420-stake-accounting-reconciliation-v1' and report['status']=='RECONCILED' and report['chainId']==420 and report['canonicalAuthority'] is False and not report['discrepancies'])
 cp=decode(before['checkpoint.json']);history=decode(before['history.json']);anchor=cp['Settlement'];sequence=sequence_anchor(before['sequence.json'],anchor)
 require(root(cp['Head']['Root'])==report['consensusRoot'] and root(cp['Finalized']['Root'])==report['finalizedRoot'])
 require(anchor['ExecutionBlock']==report['block'] and root(anchor['BlockHash'])==report['blockHash'])
 require(sequence['schema']=='420-stake-systemcall-sequence-v2' and sequence['lastSequence']==anchor['LastSequence'])
 require(rpc(c['rpcURL'],'eth_chainId',[])=='0x1a4')
 require(rpc(c['rpcURL'],'eth_getBlockByNumber',['0x0',False])['hash']==c['genesisHash'])
 pin={'blockHash':report['blockHash'],'requireCanonical':True}
 word=rpc(c['rpcURL'],'eth_call',[{'to':'0x000000000000000000000000000000000000043c','data':'0x3bc684e9'},pin])
 require(isinstance(word,str) and re.fullmatch('0x[0-9a-fA-F]{64}',word) and int(word,16)<=2**64-1 and int(word,16)==anchor['LastSequence'])
 for address,sha in c['runtimeSHA256'].items():
  code=rpc(c['rpcURL'],'eth_getCode',[address,pin]);require(isinstance(code,str) and len(code)>2);require(digest(bytes.fromhex(code[2:]))==sha)
 health=request(c['monitorURL'].rstrip('/')+'/health');require(health.get('schema')=='420-stake-monitor-v1' and health.get('ready') is True and health.get('canonicalAuthority') is False)
 alarms=request(c['monitorURL'].rstrip('/')+'/v1/alarms');public=[]
 for r in alarms:
  a=r['alarm'];require(re.fullmatch('[0-9a-f]{64}',a['id']) and re.fullmatch('[a-z_]{1,64}',a['rule']) and a['transition'] in ['FIRING','RECOVERED'])
  require(type(a['episode'])==int and a['episode']>0)
  public.append({'id':a['id'],'rule':a['rule'],'transition':a['transition'],'episode':a['episode'],'status':r['status']})
 require(all((directory/n).read_bytes()==v for n,v in before.items()))
 require(process_evidence(c)==processes)
 require(rpc(c['rpcURL'],'eth_getBlockByNumber',[hex(report['block']),False])['hash']==report['blockHash'])
 # Every entry/root is already reverified by the approved reconciliation binary.
 entries={root(r['Certificate']['BlockRoot']):root(r['Certificate']['ParentRoot']) for r in history['Entries']}
 genesis=root(decode(trust)['Genesis']['Root']);at=report['consensusRoot'];ancestry=[]
 while at!=genesis:
  require(at in entries and at not in ancestry);ancestry.append(at);at=entries[at]
 ancestry.append(genesis);require(report['finalizedRoot'] in ancestry)
 return {'schema':'420-stake-live-snapshot-v1','kind':'COLLECTED','environment':'public-testnet','liveAcceptance':False,'deploymentId':c['deploymentId'],'releaseSHA':c['releaseSHA'],'genesisHash':c['genesisHash'],'configSHA256':approved,'trustSHA256':c['trustSHA256'],'runtimeSHA256':c['runtimeSHA256'],'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'processes':processes,'block':report['block'],'blockHash':report['blockHash'],'sequence':anchor['LastSequence'],'consensusRoot':report['consensusRoot'],'finalizedRoot':report['finalizedRoot'],'finalizedSlot':cp['Finalized']['Slot'],'canonicalRoots':ancestry,'accounting':'RECONCILED','monitorReady':True,'alarms':public}

def artifact(base,record):
 require(set(record)=={'path','sha256'} and HEX.fullmatch(record['sha256']))
 p=(base/record['path']).resolve();require(p.is_relative_to(base.resolve()) and p.is_file());raw=p.read_bytes();require(digest(raw)==record['sha256']);return raw

def check_bundle(base,manifest):
 require(manifest['schema']=='420-stake-live-drill-bundle-v1' and manifest['environment']=='public-testnet' and manifest.get('simulation') is False)
 scenarios=manifest['scenarios'];require(len(scenarios)==len(SCENARIOS) and {s['id'] for s in scenarios}==SCENARIOS)
 for s in scenarios:
  before,after=[decode(artifact(base,s[k])) for k in ['before','after']]
  for v in [before,after]:
   require(v['schema']=='420-stake-live-snapshot-v1' and v['kind']=='COLLECTED' and v['environment']=='public-testnet' and v['accounting']=='RECONCILED')
   require(v['deploymentId']==manifest['deploymentId'] and v['releaseSHA']==manifest['releaseSHA'] and v['genesisHash']==manifest['genesisHash'])
   require(set(v['processes'])==ROLES and type(v['block'])==int and type(v['sequence'])==int)
  require(before['trustSHA256']==after['trustSHA256'] and before['runtimeSHA256']==after['runtimeSHA256'])
  require(all(v['configSHA256'] in manifest['approvedConfigSHA256'] and HEX.fullmatch(v['configSHA256']) for v in [before,after]))
  require(before['finalizedRoot'] in after['canonicalRoots'] and after['finalizedSlot']>=before['finalizedSlot'])
  require(datetime.datetime.fromisoformat(after['observedAt'])>=datetime.datetime.fromisoformat(before['observedAt']))
  # Do not accept self-reported PASS booleans or fixture counters as drill proof.
  require(s['evidenceFiles'] and s['operatorReviewSHA256'] and HEX.fullmatch(s['operatorReviewSHA256']))
  require(s['operatorReviewSHA256'] in {f['sha256'] for f in s['evidenceFiles']})
  for f in s['evidenceFiles']:artifact(base,f)
  if s['id'] in {'duplicate-replay','finalized-conflict','checkpoint-mismatch','accounting-discrepancy'}:require(before['block']==after['block'] and before['blockHash']==after['blockHash'] and before['sequence']==after['sequence'])
  if s['id'] in {'consensus-restart','execution-restart','simultaneous-restart','pre-journal-crash','interrupted-write','backup-restore'}:
   roles={'execution'} if s['id']=='execution-restart' else {'execution','settlement'} if s['id']=='simultaneous-restart' else {'settlement'}
   require(all(before['processes'][r]['pid']!=after['processes'][r]['pid'] for r in roles))
  if s['id'] in {'signer-unavailable','engine-unavailable','stale-sequence','checkpoint-mismatch','accounting-discrepancy','alarm-retry-recovery'}:
   events=s['alarmEvidence'];require(events)
   rules={'signer-unavailable':{'signing_protection_failure','signing_health_unavailable'},'engine-unavailable':{'engine_errors'},'stale-sequence':{'sequence_state_mismatch','sequence_state_unavailable'},'checkpoint-mismatch':{'consensus_evidence_unavailable','execution_divergence'},'accounting-discrepancy':{'accounting_discrepancy','accounting_evidence_unavailable'},'alarm-retry-recovery':{'delivery_failure'}}[s['id']]
   groups={}
   for f in events:
    observed=decode(artifact(base,f))['alarms']
    for a in observed:
     require(HEX.fullmatch(a['id']) and a['transition'] in ['FIRING','RECOVERED'] and type(a['episode'])==int and a['episode']>0)
     if a['rule'] in rules and a['status']=='delivered':groups.setdefault((a['rule'],a['episode']),set()).add(a['transition'])
   require(any(v=={'FIRING','RECOVERED'} for v in groups.values()))
 return {'schema':'420-stake-live-bundle-check-v1','structuralEvidenceComplete':True,'liveAcceptance':False,'scenarios':len(scenarios),'reviewRequired':'Independent deployment/operations review of referenced process, interrupted-state, RPC, alarm delivery and lifecycle receipts remains mandatory.'}

def main():
 p=argparse.ArgumentParser(description=__doc__);sub=p.add_subparsers(dest='mode',required=True)
 c=sub.add_parser('collect');c.add_argument('--config',type=pathlib.Path,required=True);c.add_argument('--config-sha256',required=True);c.add_argument('--output',type=pathlib.Path,required=True)
 b=sub.add_parser('check-bundle');b.add_argument('--manifest',type=pathlib.Path,required=True);b.add_argument('--manifest-sha256',required=True);b.add_argument('--output',type=pathlib.Path,required=True)
 a=p.parse_args();result={'schema':'420-stake-live-operation-result-v1','pass':False,'liveAcceptance':False}
 try:
  if a.mode=='collect':result=collect(config(a.config.read_bytes(),a.config_sha256),a.config_sha256)
  else:
   raw=a.manifest.read_bytes();require(HEX.fullmatch(a.manifest_sha256) and digest(raw)==a.manifest_sha256);result=check_bundle(a.manifest.parent,decode(raw))
 except Exception:result={'schema':'420-stake-live-operation-result-v1','pass':False,'liveAcceptance':False,'code':'OPERATIONAL_EVIDENCE_INVALID'}
 # Exclusive output: never overwrite or downgrade a previous acceptance record.
 with a.output.open('x') as f:os.chmod(a.output,0o600);f.write(json.dumps(result,indent=2)+'\n');f.flush();os.fsync(f.fileno())
 parent=os.open(str(a.output.parent),os.O_RDONLY)
 try:os.fsync(parent)
 finally:os.close(parent)
 print(json.dumps({'liveAcceptance':False,'collected':result.get('kind')=='COLLECTED','structuralEvidenceComplete':result.get('structuralEvidenceComplete',False),'code':result.get('code','')}))
 return 1 if result.get('pass') is False else 0
if __name__=='__main__':raise SystemExit(main())
