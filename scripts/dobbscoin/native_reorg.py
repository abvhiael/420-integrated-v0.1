#!/usr/bin/env python3
"""Targeted real-client fork selection: 101 buried blocks rejected, 100 allowed.
Continues the already-qualified controlled native regtest; never repeats its tests.
"""
import argparse,base64,json,os,secrets,socket,subprocess,time as clock,urllib.request
from pathlib import Path
from consensus import *
def main():
    p=argparse.ArgumentParser();p.add_argument('--daemon',type=Path,required=True);p.add_argument('--regtest',type=Path,required=True);a=p.parse_args();data=a.regtest/'node';prior=json.loads((a.regtest/'RESULTS.json').read_text());require(prior['daemon_sha256']==sha256(a.daemon.read_bytes()).hexdigest(),'native lineage')
    auth=base64.b64encode(secrets.token_bytes(32).hex().encode()+b':'+secrets.token_bytes(32).hex().encode()).decode();user,password=base64.b64decode(auth).decode().split(':');config=data/'dobbscoin.conf';config.write_text(f'rpcuser={user}\nrpcpassword={password}\n');config.chmod(0o600)
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    def rpc(method,*params):
        request=urllib.request.Request(f'http://127.0.0.1:{port}',json.dumps({'id':1,'method':method,'params':params}).encode(),{'Authorization':'Basic '+auth})
        try:
            with urllib.request.urlopen(request,timeout=40) as response:r=json.load(response)
        except urllib.error.HTTPError as e:r=json.load(e)
        require(not r.get('error'),str(r.get('error')));return r['result']
    cmd=[str(a.daemon.resolve()),f'-datadir={data.resolve()}',f'-rpcport={port}','-regtest','-server=1','-listen=0','-connect=0','-dnsseed=0','-discover=0','-assumevalid=0']
    def fork(fork_height,tag):
        parent=rpc('getblockhash',fork_height);parent_time=rpc('getblock',parent)['time'];records=[]
        for height in range(fork_height+1,212):
            number=height.to_bytes((height.bit_length()+7)//8,'little');number+=b'\0' if number[-1]&128 else b''
            script=bytes([len(number)])+number+tag
            coinbase=bytes.fromhex('0100000001')+bytes(32)+bytes.fromhex('ffffffff')+bytes([len(script)])+script+bytes.fromhex('ffffffff01')+bytes(8)+bytes.fromhex('015100000000')
            h=bytearray(struct.pack('<I',(176<<16)|3)+bytes.fromhex(parent)[::-1]+dsha(coinbase)+struct.pack('<III',parent_time+1,0x207fffff,0));nonce=0
            while int.from_bytes(pow_hash(bytes(h)),'little')>target(0x207fffff,(1<<255)-1):nonce+=1;struct.pack_into('<I',h,76,nonce)
            result=rpc('submitblock',(bytes(h)+b'\x01'+coinbase).hex());parent=dsha(h)[::-1].hex();parent_time+=1;records.append({'height':height,'hash':parent,'result':result})
            if height<211:require(result in (None,'inconclusive','duplicate-inconclusive'),'fork prefix rejected '+str(records[-1]));require(rpc('getblock',parent)['height']==height,'fork ancestor not stored')
        return records
    with (a.regtest/'reorg-daemon.log').open('w') as log:
        proc=subprocess.Popen(cmd,stdout=log,stderr=subprocess.STDOUT)
        try:
            deadline=clock.monotonic()+90
            while True:
                require(proc.poll() is None,'startup failed')
                try:info=rpc('getblockchaininfo');break
                except (OSError,ValueError):require(clock.monotonic()<deadline,'startup timeout');clock.sleep(.2)
            require(info['blocks']==210 and info['bestblockhash']==prior['chain']['bestblockhash'],'prior selected tip')
            rejected=fork(109,b'depth-101');require(rejected[-1]['result']=='bad-reorg-depth','101 reorg not rejected');require(rpc('getbestblockhash')==info['bestblockhash'],'rejected fork changed active tip')
            rpc('invalidateblock',rejected[0]['hash'])
            accepted=fork(110,b'reorg-100');require(accepted[-1]['result'] is None,'100 reorg rejected');require(rpc('getbestblockhash')==accepted[-1]['hash'],'higher-work fork not selected')
            report={'source':SOURCE,'prior_results_sha256':sha256((a.regtest/'RESULTS.json').read_bytes()).hexdigest(),'daemon_sha256':prior['daemon_sha256'],'rejected_depth':101,'accepted_depth':100,'rejected_final':rejected[-1],'accepted_final':accepted[-1],'selected':rpc('getblockchaininfo')}
            (a.regtest/'REORG-RESULTS.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
        finally:
            try:rpc('stop')
            except Exception:pass
            try:proc.wait(timeout=20)
            except subprocess.TimeoutExpired:proc.terminate();proc.wait(timeout=10)
            config.unlink(missing_ok=True)
if __name__=='__main__':main()
