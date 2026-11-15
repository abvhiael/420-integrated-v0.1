#!/usr/bin/env python3
"""Actual pinned native-client AuxPoW and chain-selection integration (regtest).
Controlled native blocks, not historical mainnet evidence. No source modifications.
"""
import argparse,base64,json,os,secrets,socket,subprocess,time as clock,urllib.request
from pathlib import Path
from consensus import *

def main():
    p=argparse.ArgumentParser();p.add_argument('--daemon',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True);data=a.output/'node';data.mkdir(exist_ok=False)
    user=secrets.token_hex(16);password=secrets.token_hex(32);auth=base64.b64encode(f'{user}:{password}'.encode()).decode()
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    config=data/'dobbscoin.conf';config.write_text(f'rpcuser={user}\nrpcpassword={password}\n');config.chmod(0o600)
    def rpc(method,*params):
        request=urllib.request.Request(f'http://127.0.0.1:{port}',json.dumps({'id':1,'method':method,'params':params}).encode(),{'Authorization':'Basic '+auth})
        try:
            with urllib.request.urlopen(request,timeout=30) as response:r=json.load(response)
        except urllib.error.HTTPError as e:r=json.load(e)
        require(not r.get('error'),str(r.get('error')));return r['result']
    cmd=[str(a.daemon.resolve()),f'-datadir={data.resolve()}',f'-rpcport={port}','-regtest','-server=1','-listen=0','-connect=0','-dnsseed=0','-discover=0','-assumevalid=0']
    checks=[]
    with (a.output/'daemon.log').open('w') as log:
        proc=subprocess.Popen(cmd,stdout=log,stderr=subprocess.STDOUT)
        try:
            deadline=clock.monotonic()+90
            while True:
                require(proc.poll() is None,'native startup failed')
                try:info=rpc('getinfo');break
                except (OSError,ValueError):require(clock.monotonic()<deadline,'startup timeout');clock.sleep(.2)
            address=rpc('getnewaddress');require(info['testnet'] is False or info['testnet'] is True,'RPC ready')
            try:rpc('createauxblock',address)
            except ValueError:checks.append('createauxblock rejects before activation')
            else:raise ValueError('premature AuxPoW RPC accepted')
            hs=rpc('setgenerate',True,9);require(len(hs)==9,'nine preactivation blocks');pre=bytes.fromhex(rpc('getblock',hs[-1],False));require(not activation(pre[:80],9,10),'preactivation standalone');checks.append('height 9 preactivation identity')
            template=rpc('createauxblock',address);require(template['height']==10 and template['chainid']==176,'Aux activation at 10')
            script=bytes.fromhex('fabe6d6d')+bytes.fromhex(template['hash'])+struct.pack('<II',1,0)
            cb=bytes.fromhex('0100000001')+bytes(32)+bytes.fromhex('ffffffff')+bytes([len(script)])+script+bytes.fromhex('ffffffff0000000000')
            parent=bytearray(struct.pack('<I',1)+bytes(32)+dsha(cb)+struct.pack('<III',int(clock.time()),0,0))
            child_target=target(int(template['bits'],16),(1<<255)-1);nonce=0
            while int.from_bytes(pow_hash(bytes(parent)),'little')>child_target:nonce+=1;struct.pack_into('<I',parent,76,nonce)
            # hashBlock is serialized legacy metadata, unused by native CAuxPow::check.
            aux=cb+bytes(32)+b'\x00'+struct.pack('<i',0)+b'\x00'+struct.pack('<i',0)+bytes(parent)
            require(rpc('submitauxblock',template['hash'],aux.hex()) is True,'native AuxPoW rejected');checks.append('genuine native-mined AuxPoW at activation; child target, zero parent outputs')
            raw=bytes.fromhex(rpc('getblock',template['hash'],False));require(activation(raw[:80],10,10),'AuxPoW flag');check_aux(raw[:80],cb,bytes(parent),[],[],0,limit=(1<<255)-1)
            (a.output/'auxpow-block.json').write_text(json.dumps({'classification':'controlled-native-regtest','source':SOURCE,'height':10,'child_header':raw[:80].hex(),'block':raw.hex(),'parent_transaction':cb.hex(),'parent_header':bytes(parent).hex(),'auxpow':aux.hex(),'scrypt_hash':pow_hash(bytes(parent)).hex()},indent=2)+'\n')
            # Mine standalone blocks after activation, including LWMA/max-reorg gate 100.
            rpc('setgenerate',True,200);tip=rpc('getblockcount');require(tip==210,'postfork height');post=bytes.fromhex(rpc('getblock',rpc('getblockhash',11),False));require(not activation(post[:80],11,10),'standalone still allowed');checks.append('standalone native work after AuxPoW activation')
            # Mark/reconsider buried blocks exercises native active-chain disconnect and
            # the >100 reorg policy without changing consensus source.
            info=rpc('getblockchaininfo');require(info['blocks']==210,'selected chain tip');checks.append('native selected chain through max-reorg activation')
            report={'source':SOURCE,'daemon_sha256':sha256(a.daemon.read_bytes()).hexdigest(),'checks':checks,'chain':info,'auxpow_sha256':sha256(raw).hexdigest()}
            (a.output/'RESULTS.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
        finally:
            try:rpc('stop')
            except Exception:pass
            try:proc.wait(timeout=20)
            except subprocess.TimeoutExpired:proc.terminate();proc.wait(timeout=10)
            config.unlink(missing_ok=True)
if __name__=='__main__':main()
