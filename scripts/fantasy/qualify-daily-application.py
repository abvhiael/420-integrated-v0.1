"""Actual browser/custodian/ERC20 daily-pool flow on isolated Anvil."""
import argparse
import hashlib
import platform
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import threading
import time
import urllib.request
from uuid import uuid4
ROOT=Path(__file__).resolve().parents[2]
APP=ROOT/"clients/420bet-fantasy/daily"
sys.path.insert(0,str(APP));sys.path.insert(0,str(APP.parent))
from local_fixture import LocalFixture
from chain import b32

def port():
    with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]

def main():
    p=argparse.ArgumentParser();p.add_argument('--forge',default='forge');p.add_argument('--anvil',default='anvil');p.add_argument('--solc',default='0.8.30');p.add_argument('--output',required=True);p.add_argument('--allow-dirty',action='store_true');a=p.parse_args()
    sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    dirty=subprocess.check_output(['git','status','--porcelain','--untracked-files=normal','--','clients/420bet-fantasy','contracts/src','contracts/script/fantasy','scripts/fantasy/qualify-daily-application.py','.github/workflows/420bet-daily-application-level2.yml'],cwd=ROOT,text=True).strip()
    if dirty and not a.allow_dirty:raise RuntimeError('scoped source is dirty; commit before qualification or use diagnostic --allow-dirty')
    out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True)
    env=dict(os.environ,FOUNDRY_PROFILE='pr',FOUNDRY_SRC='script/fantasy',FOUNDRY_TEST='test/__daily_empty__',FOUNDRY_SCRIPT='script/fantasy',FOUNDRY_OUT=str(out/'build'),FOUNDRY_CACHE_PATH=str(out/'cache'))
    result=subprocess.run([a.forge,'test','--no-dynamic-test-linking','--no-match-test','.*','--root',str(ROOT/'contracts'),'--use',a.solc],cwd=ROOT/'contracts',env=env,capture_output=True,timeout=300)
    (out/'compile.stdout.log').write_bytes(result.stdout);(out/'compile.stderr.log').write_bytes(result.stderr)
    if result.returncode:raise RuntimeError('actual canonical compilation failed')
    for abi_file in (APP/'abi').glob('*.json'):
        artifact=json.loads((out/'build'/(abi_file.stem+'.sol')/(abi_file.stem+'.json')).read_text())
        if json.loads(abi_file.read_text())!=artifact['abi']:raise RuntimeError('ABI differs from compiled canonical source: '+abi_file.name)
    rpc_port,web_port,control_port=port(),port(),port();rpc=f'http://127.0.0.1:{rpc_port}'
    kwargs={'creationflags':subprocess.CREATE_NO_WINDOW} if os.name=='nt' else {}
    anvil_log=(out/'anvil.log').open('w');node=subprocess.Popen([a.anvil,'--host','127.0.0.1','--port',str(rpc_port),'--chain-id','31337','--silent'],stdout=anvil_log,stderr=anvil_log,**kwargs)
    service=None;control=None
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(urllib.request.Request(rpc,data=b'{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}',headers={'Content-Type':'application/json'}),timeout=1);break
            except Exception:time.sleep(.1)
        private=out/'private'/str(uuid4());fixture=LocalFixture(rpc,out/'build',private);config=fixture.setup();(out/'deployment.json').write_text(json.dumps(config,indent=2)+'\n')
        app_log=(out/'service.log').open('w')
        def start_service():return subprocess.Popen([sys.executable,str(APP/'server.py'),'--config',str(private/'application.json'),'--private-directory',str(private),'--port',str(web_port)],cwd=ROOT,env=os.environ,stdout=app_log,stderr=app_log,**kwargs)
        service=start_service();token=os.urandom(24).hex()
        class Control(BaseHTTPRequestHandler):
            def log_message(self,*_):pass
            def do_POST(self):
                nonlocal service
                if self.headers.get('X-Local-Qualification')!=token:self.send_error(403);return
                try:
                    body=json.loads(self.rfile.read(int(self.headers['Content-Length'])));action=body['action']
                    if action=='advance':fixture.advance(int(body['timestamp']));value={'timestamp':fixture.w3.eth.get_block('latest').timestamp}
                    elif action=='score':value={'scores':fixture.score(body['pool'],int(body.get('revision',1)),body.get('bobWins',False))}
                    elif action=='prepareCorrection':value=fixture.score(body['pool'],2,True,prepare_only=True)
                    elif action=='scopeResolver':
                        scope=fixture.disputes.functions.claimScope(b32(body['claim'])).call();fixture.grant(fixture.accounts[4],fixture.disputes.functions.RESOLVE().call(),scope);value={'granted':True}
                    elif action=='totals':value={'balances':[str(fixture.token.functions.balanceOf(w).call()) for w in fixture.accounts], 'engineBalance':str(fixture.token.functions.balanceOf(fixture.engine.address).call()),'engineLiability':str(fixture.engine.functions.totalLiability().call()),'bondBalance':str(fixture.token.functions.balanceOf(fixture.disputes.address).call()),'bondLiability':str(fixture.disputes.functions.totalLiability().call())}
                    elif action=='restart':service.terminate();service.wait(timeout=10);service=start_service();value={'restarted':True}
                    else:raise ValueError('unknown qualification action')
                    data=json.dumps(value).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
                except Exception as error:
                    data=json.dumps({'error':type(error).__name__+': '+str(error)}).encode();self.send_response(500);self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
        control=ThreadingHTTPServer(('127.0.0.1',control_port),Control);threading.Thread(target=control.serve_forever,daemon=True).start()
        for _ in range(100):
            try:urllib.request.urlopen(f'http://127.0.0.1:{web_port}/api/health',timeout=1);break
            except Exception:time.sleep(.1)
        test_env=dict(os.environ,DAILY_APP_URL=f'http://127.0.0.1:{web_port}',DAILY_RPC=rpc,DAILY_CONTROL=f'http://127.0.0.1:{control_port}',DAILY_CONTROL_TOKEN=token,DAILY_OUTPUT=str(out),DAILY_PRIVATE=str(private))
        result=subprocess.run(['node',str(APP/'test-flow.mjs')],cwd=APP,env=test_env,capture_output=True,timeout=600)
        (out/'browser.stdout.log').write_bytes(result.stdout);(out/'browser.stderr.log').write_bytes(result.stderr)
        if result.returncode:raise RuntimeError('actual browser integration failed; inspect captured logs')
        print(result.stdout.decode())
        ledger=[]
        for number in range(1,fixture.w3.eth.block_number+1):
            for tx in fixture.w3.eth.get_block(number).transactions:
                receipt=fixture.w3.eth.get_transaction_receipt(tx)
                ledger.append({'transactionHash':'0x'+tx.hex().removeprefix('0x'),'blockNumber':receipt.blockNumber,'status':receipt.status,'from':receipt['from'],'to':receipt.to,'contractAddress':receipt.contractAddress,'gasUsed':receipt.gasUsed})
        if any(r['status']!=1 for r in ledger):raise RuntimeError('unexpected reverted local transaction')
        (out/'transactions.json').write_text(json.dumps(ledger,indent=2)+'\n',encoding='utf-8')
        versions={'python':platform.python_version(),'node':subprocess.check_output(['node','--version'],text=True).strip(),'forge':subprocess.check_output([a.forge,'--version'],text=True).strip(),'anvil':subprocess.check_output([a.anvil,'--version'],text=True).strip()}
        (out/'versions.json').write_text(json.dumps(versions,indent=2)+'\n',encoding='utf-8')
        if not dirty:
            if subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()!=sha:raise RuntimeError('source SHA changed during qualification')
            changed=subprocess.check_output(['git','status','--porcelain','--untracked-files=normal','--','clients/420bet-fantasy','contracts/src','contracts/script/fantasy','scripts/fantasy/qualify-daily-application.py','.github/workflows/420bet-daily-application-level2.yml'],cwd=ROOT,text=True).strip()
            if changed:raise RuntimeError('qualified source changed during execution')
            bundle={file.name:hashlib.sha256(file.read_bytes()).hexdigest() for file in sorted((APP/'web-dist').iterdir()) if file.is_file()}
            (out/'bundle-checksums.json').write_text(json.dumps(bundle,indent=2)+'\n',encoding='utf-8')
            source={}
            for base in [APP,ROOT/'contracts/src',ROOT/'contracts/script/fantasy',ROOT/'scripts/fantasy']:
                for file in sorted(base.rglob('*')):
                    if file.is_file() and not any(part in ('node_modules','web-dist','__pycache__') for part in file.parts):source[file.relative_to(ROOT).as_posix()]=hashlib.sha256(file.read_bytes()).hexdigest()
            (out/'source-checksums.json').write_text(json.dumps(source,indent=2)+'\n',encoding='utf-8')
            result=json.loads((out/'browser-result.json').read_text())
            if result['passed']!=len(result['steps']) or result['passed']!=12:raise RuntimeError('mandatory browser scenarios missing')
            files=['bundle-checksums.json','transactions.json','versions.json','source-checksums.json','deployment.json','browser-result.json','conservation.json','browser.stdout.log','browser.stderr.log','compile.stdout.log','compile.stderr.log','daily-pool.png','daily-pool-mobile.png']
            evidence={name:hashlib.sha256((out/name).read_bytes()).hexdigest() for name in files}
            certificate={'schema':'420bet.daily-application.local-level2.v1','qualifiedSHA':sha,'level':2,'scope':'daily application local integration','status':'passed','syntheticSportsData':True,'testnetLiveSettlementQualified':False,'externalWalletExtensionQualified':False,'evidenceSHA256':evidence}
            (out/'qualification.json').write_text(json.dumps(certificate,indent=2)+'\n',encoding='utf-8')
        else:print('DIAGNOSTIC ONLY: dirty source; no qualification certificate issued')
    finally:
        if control:control.shutdown();control.server_close()
        if service:service.terminate();service.wait(timeout=15)
        node.terminate();node.wait(timeout=15);anvil_log.close()
if __name__=='__main__':main()
