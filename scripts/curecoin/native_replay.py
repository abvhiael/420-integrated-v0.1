#!/usr/bin/env python3
"""Fresh offline reference-daemon replay, with assumevalid explicitly disabled.
Never copies archive indexes/wallets; only raw block bytes enter the new data directory.
"""
import argparse,base64,re,hashlib,json,os,secrets,socket,subprocess,time,urllib.request,shutil
from pathlib import Path
from consensus import SOURCE,GENESIS,require

def export_report(rpc,a,lineage):
    info=rpc('getinfo');require(info['blocks']==a.height and rpc('getblockhash',a.height)==a.tip,'canonical tip mismatch')
    require(info['testnet'] is False and info['connections']==0 and rpc('getblockhash',0)==GENESIS,'offline mainnet')
    selected={}
    for h in sorted(set((0,1,9688,9689,14060,14061,15000,15001,257310,257321,257322,257323,257324,500000)+tuple(a.sample))):
     if h<=a.height:selected[str(h)]=rpc('getblock',rpc('getblockhash',h))
    report={'validation_lineage':lineage,'source':SOURCE,'daemon_sha256':a.sha256,'assumevalid':'0','copied_databases':False,'mainnet':True,'connections':info['connections'],'height':a.height,'tip':a.tip,'selected':selected,'bootstrap_sha256':hashlib.sha256(a.bootstrap.read_bytes()).hexdigest()}
    log_paths=[a.output/('daemon-resume.log' if lineage else 'daemon.log')]
    if lineage:
     for name,checksum in lineage.get('retained_native_trace_sha256',{}).items():
      path=a.output/name;require(path.parent==a.output and hashlib.sha256(path.read_bytes()).hexdigest()==checksum,'retained native trace checksum');log_paths.append(path)
    matched=[]
    for log_path in log_paths:
     if log_path.exists():
      rows=re.findall(r'SetBestChain: new best=.*?height=(\d+)\s+trust=(\d+).*?block hash= ([0-9a-f]{64})',log_path.read_text(errors='replace'))
      matched.extend(r for r in rows if int(r[0])==a.height and r[2]==a.tip)
    require(bool(matched),'native canonical trust observation missing');require(len({r[1] for r in matched})==1,'native trust disagreement');report['chain_trust']=matched[-1][1]
    (a.output/'native-replay.json').write_text(json.dumps(report,indent=2)+'\n')
    return report

def main():
 p=argparse.ArgumentParser();p.add_argument('--daemon',type=Path,required=True);p.add_argument('--sha256',required=True);p.add_argument('--bootstrap',type=Path,required=True);p.add_argument('--height',type=int,required=True);p.add_argument('--tip',required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--timeout',type=int,default=7200);p.add_argument('--resume-lineage',type=Path);p.add_argument('--resume-lineage-sha256');p.add_argument('--sample',type=int,action='append',default=[]);a=p.parse_args()
 require(hashlib.sha256(a.daemon.read_bytes()).hexdigest()==a.sha256,'daemon hash');require(a.bootstrap.stat().st_size>8,'raw bootstrap required');a.output.mkdir(parents=True,exist_ok=True);datadir=a.output/'fresh-node';lineage=None
 if a.resume_lineage:
  require(hashlib.sha256(a.resume_lineage.read_bytes()).hexdigest()==a.resume_lineage_sha256,'resume lineage checksum');lineage=json.loads(a.resume_lineage.read_text());require(lineage['source']==SOURCE and lineage['daemon_sha256']==a.sha256 and lineage['bootstrap_sha256']==hashlib.sha256(a.bootstrap.read_bytes()).hexdigest() and lineage['created_fresh_from_raw_only'] is True,'unqualified node data');require(datadir.is_dir(),'resume node missing')
 else:datadir.mkdir(exist_ok=False)
 user=secrets.token_hex(16);password=secrets.token_hex(32)
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 (datadir/'curecoin.conf').write_text(f'rpcuser={user}\nrpcpassword={password}\nrpcallowip=127.0.0.1\n');os.chmod(datadir/'curecoin.conf',0o600);
 if not (datadir/'bootstrap.dat').exists():os.link(a.bootstrap.resolve(),datadir/'bootstrap.dat')
 auth=base64.b64encode(f'{user}:{password}'.encode()).decode()
 def rpc(method,*params):
  req=urllib.request.Request(f'http://127.0.0.1:{port}',json.dumps({'id':1,'method':method,'params':params}).encode(),{'Authorization':'Basic '+auth,'Content-Type':'application/json'})
  with urllib.request.urlopen(req,timeout=10) as response:r=json.load(response)
  require(not r.get('error'),str(r.get('error')));return r['result']
 command=[str(a.daemon.resolve()),f'-datadir={datadir.resolve()}',f'-rpcport={port}','-connect=0','-dnsseed=0','-discover=0','-listen=0','-staking=0','-gen=0','-server=1','-daemon=0','-assumevalid=0','-dbcache=512','-printtoconsole=1']
 with (a.output/('daemon-resume.log' if lineage else 'daemon.log')).open('w') as log:
  child_env=os.environ.copy()
  if child_env.get('CURE_PROFILE_LIBRARY'):
   child_env.update(LD_PRELOAD=child_env['CURE_PROFILE_LIBRARY'],CPUPROFILE=str((a.output/'native.prof').resolve()),CPUPROFILESIGNAL='12')
  proc=subprocess.Popen(command,stdout=log,stderr=subprocess.STDOUT,env=child_env)
  try:
   deadline=time.monotonic()+a.timeout
   while True:
    require(proc.poll() is None,'native daemon exited; inspect daemon.log')
    try:
     info=rpc('getinfo')
     if info['blocks']==a.height and rpc('getblockhash',a.height)==a.tip:break
    except (OSError,ValueError):pass
    require(time.monotonic()<deadline,'native replay timeout');time.sleep(.5)
   export_report(rpc,a,lineage);print('PASS full native replay',a.height,a.tip,flush=True)
  finally:
   try:rpc('stop')
   except Exception:pass
   try:proc.wait(timeout=15)
   except subprocess.TimeoutExpired:proc.kill();proc.wait()
   (datadir/'curecoin.conf').unlink(missing_ok=True)
if __name__=='__main__':main()
