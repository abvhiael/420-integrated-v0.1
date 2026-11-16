#!/usr/bin/env python3
"""Offline full-native replay and UNSIGNED proof export. Never trust remote RPC status.
Requires the complete raw bootstrap corpus, pinned source, and explicitly pinned daemon.
The authority must review the replay report; this utility does not sign checkpoints.
"""
import argparse,base64,hashlib,json,os,secrets,socket,struct,subprocess,tempfile,time,urllib.request,shutil
from pathlib import Path
from consensus import *
from native_hash import build,hasher

def blocks(path,x13):
    raw=path.read_bytes();p=0;out={}
    while p<len(raw):
        require(raw[p:p+4]==b'MOTA' and p+8<=len(raw),'bootstrap framing');n=int.from_bytes(raw[p+4:p+8],'little');p+=8
        require(80<n<=1000000 and p+n<=len(raw),'bootstrap block size');b=raw[p:p+n];p+=n;header=b[:80];count,q=varint(b,80);txs=[]
        for _ in range(count):
            offset=q;tx,q=transaction(b,q);tx['offset']=offset;txs.append(tx)
        size,q=varint(b,q);require(q+size==len(b),'block signature framing')
        require(merkle([t['id'] for t in txs])==header[36:68],'transaction root')
        h=x13(header);out[h[::-1].hex()]={'raw':b,'header':header,'txs':txs,'signature':b[q:],'time':int.from_bytes(header[68:72],'little'),'bits':int.from_bytes(header[72:76],'little')}
    require(bool(out),'empty bootstrap corpus');return out

def run(args):
    binary=args.daemon.resolve();require(hashlib.sha256(binary.read_bytes()).hexdigest()==args.daemon_sha256,'daemon checksum')
    require(args.expected_height>=0 and len(args.expected_tip)==64,'expected canonical tip')
    with tempfile.TemporaryDirectory(prefix='potcoin-native-replay-') as folder:
        d=Path(folder);x13=hasher(build(args.source,d/'x13'));corpus=blocks(args.bootstrap,x13)
        require(args.expected_tip in corpus or args.expected_height==0,'tip absent from raw corpus')
        user=secrets.token_hex(16);password=secrets.token_hex(32)
        with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
        datadir=d/'node';datadir.mkdir();shutil.copyfile(args.bootstrap,datadir/'bootstrap.dat');(datadir/'PotCoin.conf').write_text(f'rpcuser={user}\nrpcpassword={password}\nrpcallowip=127.0.0.1\n');os.chmod(datadir/'PotCoin.conf',0o600)
        auth=base64.b64encode(f'{user}:{password}'.encode()).decode()
        def rpc(method,*params):
            req=urllib.request.Request(f'http://127.0.0.1:{port}',json.dumps({'id':1,'method':method,'params':params}).encode(),{'Authorization':'Basic '+auth,'Content-Type':'application/json'})
            with urllib.request.urlopen(req,timeout=5) as response:r=json.load(response)
            if r.get('error'):raise ValueError(r['error'])
            return r['result']
        log=(d/'node.log').open('w');proc=subprocess.Popen([str(binary),f'-datadir={datadir}',f'-rpcport={port}','-testnet=0','-connect=0','-dnsseed=0','-discover=0','-listen=0','-staking=0','-gen=0','-server=1','-daemon=0'],stdout=log,stderr=subprocess.STDOUT)
        try:
            deadline=time.monotonic()+args.timeout
            while True:
                if proc.poll() is not None:raise ValueError('native daemon exited before replay completed: '+((d/'node.log').read_text()+((datadir/'debug.log').read_text() if (datadir/'debug.log').exists() else 'no debug log'))[-3000:].replace(password,'[redacted]').replace(user,'[redacted]'))
                try:
                    info=rpc('getinfo')
                    if info['blocks']==args.expected_height and rpc('getbestblockhash')==args.expected_tip:break
                except (OSError,ValueError):pass
                require(time.monotonic()<deadline,'native replay did not reach expected tip');time.sleep(.25)
            require(info['testnet'] is False and info['connections']==0 and rpc('getblockhash',0)==GENESIS,'offline mainnet identity')
            canonical=[];unspent={};origin_for_selected=None;total=0
            for height in range(args.expected_height+1):
                h=rpc('getblockhash',height);meta=rpc('getblock',h);require(h in corpus or height==0,'canonical raw block missing')
                if height==0 and h not in corpus:raise ValueError('genesis raw block missing')
                b=corpus[h];pos=len(b['txs'])>1 and b['txs'][1]['stake'];require(eligible_kind(height,pos),'consensus transition')
                require(height==0 or b['header'][4:36]==bytes.fromhex(canonical[-1]['hash'])[::-1],'canonical ancestry')
                total+=trust(b['bits'],pos);require(int(meta['chaintrust'],16)==total,'native cumulative chain trust')
                b.update(hash=h,height=height,meta=meta,pos=pos,trust=total)
                for index,tx in enumerate(b['txs']):
                    if height==args.height and index==1:
                        origin_for_selected=unspent.get(tx['inputs'][0][:2]);require(origin_for_selected is not None,'stake origin missing or spent')
                    if not tx['coinbase']:
                        for inp in tx['inputs']:require(inp[:2] in unspent,'native replay UTXO disagreement');del unspent[inp[:2]]
                    for output in range(len(tx['outputs'])):unspent[(tx['id'],output)]=(b,tx,output)
                canonical.append(b)
            report={'classification':'UNSIGNED FULL NATIVE REPLAY; not an authorized checkpoint','consensus_source':SOURCE,'daemon_sha256':args.daemon_sha256,'bootstrap_sha256':hashlib.sha256(args.bootstrap.read_bytes()).hexdigest(),'mainnet':True,'genesis':GENESIS,'tip_height':args.expected_height,'tip':args.expected_tip,'chain_trust':str(total),'historical_post_bootstrap_replayed':args.expected_height>500}
            args.output.mkdir(parents=True,exist_ok=True)
            if args.height is not None:
                from eth_abi import encode
                from generate_controlled import STATE,PROOF
                require(500<args.height<=args.expected_height and origin_for_selected is not None,'post-bootstrap stake height required')
                b=canonical[args.height];origin,tx,out=origin_for_selected;selected=b['txs'][args.transaction_index];require(args.transaction_index>=2 and args.output_index<len(selected['outputs']),'deposit index')
                require(args.chain_id and args.router and args.route,'destination binding required')
                previous=[c for c in canonical[:args.height] if c['pos']];modifier_index=origin['height'];modifier_time=origin['time']
                while modifier_time<origin['time']+SELECTION_INTERVAL:
                    modifier_index+=1;require(modifier_index<args.height,'kernel modifier not yet available')
                    if 'stake-modifier' in canonical[modifier_index]['meta']['flags']:modifier_time=canonical[modifier_index]['time']
                modifier=int(canonical[modifier_index]['meta']['modifier'],16);amount,script=tx['outputs'][out]
                check_kernel(b['bits'],modifier,origin['time'],tx['offset'],tx['time'],out,b['time'],amount)
                state=[bytes.fromhex(GENESIS)[::-1],bytes.fromhex(SOURCE)+bytes(12),args.height,bytes.fromhex(b['hash'])[::-1],hashlib.sha256(b['header']).digest(),canonical[args.height-1]['trust'],b['trust'],min(2,len(previous)),previous[-1]['bits'] if previous else 0,previous[-1]['time'] if previous else 0,previous[-2]['time'] if len(previous)>1 else 0,sorted(c['time'] for c in canonical[max(0,args.height-11):args.height])[min(args.height,11)//2],canonical[args.height-1]['time'],modifier,tx['id'],out,amount,hashlib.sha256(script).digest(),origin['height'],origin['time'],tx['time'],tx['offset'],tx['coinbase'] or tx['stake'],True]
                leaves=[t['id'] for t in b['txs']];proof=[state,0,[],b['header'],b['txs'][1]['raw'],b['signature'],tx['raw'],len(leaves),branch(leaves,1),selected['raw'],args.transaction_index,branch(leaves,args.transaction_index),args.output_index,bytes.fromhex(args.route.removeprefix('0x'))]
                (args.output/'proof.bin').write_bytes(encode([PROOF],[proof]));report['state_root']=hashlib.sha256(encode(['string',STATE],['420/POT/NATIVE-REPLAY-STATE/V1',state])).hexdigest();report['destination_chain_id']=args.chain_id;report['destination_router']=args.router
            (args.output/'replay.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
        finally:
            try:rpc('stop')
            except Exception:pass
            try:proc.wait(timeout=10)
            except subprocess.TimeoutExpired:proc.kill();proc.wait()
            log.close()

def main():
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--daemon',type=Path,required=True);p.add_argument('--daemon-sha256',required=True);p.add_argument('--bootstrap',type=Path,required=True);p.add_argument('--expected-tip',required=True);p.add_argument('--expected-height',type=int,required=True);p.add_argument('--timeout',type=int,default=120);p.add_argument('--output',type=Path,required=True);p.add_argument('--height',type=int);p.add_argument('--transaction-index',type=int,default=2);p.add_argument('--output-index',type=int,default=0);p.add_argument('--chain-id',type=int);p.add_argument('--router');p.add_argument('--route');run(p.parse_args())
if __name__=='__main__':main()
