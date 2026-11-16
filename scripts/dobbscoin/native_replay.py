#!/usr/bin/env python3
"""Fresh pinned native replay (or checksum-qualified continuation), offline.
Only raw blk files enter the fresh datadir. A completed replay receipt, not a
remote RPC 'confirmations' assertion, is required for the checkpoint bundle.
"""
import argparse,base64,json,os,secrets,socket,subprocess,time as clock,urllib.request,re
from pathlib import Path
from hashlib import sha256
from consensus import SOURCE,GENESIS,require

def import_complete(paths):
    for path in paths:
        with path.open('rb') as stream:
            stream.seek(max(0,path.stat().st_size-32768))
            if b'Reindexing finished' in stream.read():return True
    return False

def main():
    p=argparse.ArgumentParser();p.add_argument('--daemon',type=Path,required=True);p.add_argument('--sha256',required=True);p.add_argument('--raw',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--height',type=int,required=True);p.add_argument('--tip',required=True);p.add_argument('--timeout',type=int,default=14400);p.add_argument('--resume-lineage',type=Path);p.add_argument('--resume-sha256');p.add_argument('--sample',type=int,action='append',default=[]);a=p.parse_args()
    require(sha256(a.daemon.read_bytes()).hexdigest()==a.sha256,'native executable hash');a.output.mkdir(parents=True,exist_ok=True);data=a.output/'node';lineage=None
    if a.resume_lineage:
        require(sha256(a.resume_lineage.read_bytes()).hexdigest()==a.resume_sha256,'resume lineage checksum');lineage=json.loads(a.resume_lineage.read_text());require(lineage['source']==SOURCE and lineage['daemon_sha256']==a.sha256 and lineage['created_fresh_from_raw_only'] is True and lineage['assumevalid']=='0','unqualified replay lineage')
        for filename,digest in lineage['traces'].items():require(sha256(Path(filename).read_bytes()).hexdigest()==digest,'retained native trace checksum')
        # Datadir path is explicitly recorded; no arbitrary imported database accepted.
        data=Path(lineage['datadir']);require(data.is_dir(),'resume data missing')
    else:
        data.mkdir(exist_ok=False);(data/'blocks').mkdir();files=list(a.raw.glob('blk*.dat'));require(bool(files),'raw blocks required')
        for f in files:
            # Native reindex owns its files: hard links must not mutate the archive.
            import shutil;shutil.copyfile(f,data/'blocks'/f.name)
    user=secrets.token_hex(16);password=secrets.token_hex(32);config=data/'dobbscoin.conf';config.write_text(f'rpcuser={user}\nrpcpassword={password}\n');config.chmod(0o600);auth=base64.b64encode(f'{user}:{password}'.encode()).decode()
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    def rpc(method,*params):
        request=urllib.request.Request(f'http://127.0.0.1:{port}',json.dumps({'id':1,'method':method,'params':params}).encode(),{'Authorization':'Basic '+auth})
        try:
            with urllib.request.urlopen(request,timeout=30) as response:r=json.load(response)
        except urllib.error.HTTPError as e:r=json.load(e)
        require(not r.get('error'),str(r.get('error')));return r['result']
    cmd=[str(a.daemon.resolve()),f'-datadir={data.resolve()}',f'-rpcport={port}','-server=1','-listen=0','-connect=0','-dnsseed=0','-discover=0','-upnp=0','-natpmp=0','-assumevalid=0','-dbcache=512','-par=2','-printtoconsole=1']
    checkpoints_disabled=not lineage or lineage.get('checkpoints_disabled') is True
    if checkpoints_disabled:cmd+=['-checkpoints=0']
    if not lineage:cmd+=['-reindex']
    log_path=a.output/('daemon-resume.log' if lineage else 'daemon.log')
    with log_path.open('w') as log:
        proc=subprocess.Popen(cmd,stdout=log,stderr=subprocess.STDOUT)
        try:
            deadline=clock.monotonic()+a.timeout;last_report=0
            while True:
                require(proc.poll() is None,'native exited; inspect daemon log')
                try:
                    info=rpc('getblockchaininfo')
                    if clock.monotonic()-last_report>60:print('native height',info['blocks'],flush=True);last_report=clock.monotonic()
                    if info['blocks']==a.height and info['bestblockhash']==a.tip and import_complete([log_path]+([Path(x) for x in lineage['traces']] if lineage else [])):break
                except (OSError,ValueError):pass
                require(clock.monotonic()<deadline,'native replay timeout');clock.sleep(1)
            require(info['chain']=='main' and rpc('getconnectioncount')==0 and rpc('getblockhash',0)==GENESIS,'offline mainnet identity')
            selected={}
            for h in sorted(set([0,1,2016,13579,31597,68425,1888808,1888868,1888888,a.height]+a.sample)):
                if h<=a.height:selected[str(h)]=rpc('getblock',rpc('getblockhash',h))
            report={'source':SOURCE,'daemon_sha256':a.sha256,'created_fresh_from_raw_only':True,'assumevalid':'0','connections':0,'lineage':lineage,'import_completed':True,'checkpoints_disabled':checkpoints_disabled,'chain':info,'selected':selected}
            (a.output/'native-replay.json').write_text(json.dumps(report,indent=2)+'\n');print('PASS full native replay',a.height,a.tip,flush=True)
        finally:
            try:rpc('stop')
            except Exception:pass
            try:proc.wait(timeout=30)
            except subprocess.TimeoutExpired:proc.terminate();proc.wait(timeout=20)
            config.unlink(missing_ok=True)
if __name__=='__main__':main()
