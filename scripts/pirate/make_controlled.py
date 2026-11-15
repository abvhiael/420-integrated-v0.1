"""Create disposable native regtest proof fixtures. Never use a production wallet."""
from pathlib import Path
import argparse,hashlib
import subprocess,urllib.request,urllib.error,json,secrets,socket,time,os,base64
a=argparse.ArgumentParser();a.add_argument('--node',required=True);a.add_argument('--workdir',required=True);args=a.parse_args()
exe=Path(args.node).resolve()
if hashlib.sha256(exe.read_bytes()).hexdigest()!='82a14e5ab1f544d360b43459b4fa99440e056e3dd9fe320dcf9eafd8d4ac93fa':raise SystemExit('unqualified native binary')
root=Path(args.workdir).resolve()
if root.exists() and any(root.iterdir()):raise SystemExit('disposable workdir must be empty')
os.umask(0o077);root.mkdir(parents=True,exist_ok=True);root.chmod(0o700);data=root/'node';data.mkdir();data.chmod(0o700)
user=secrets.token_hex(16);password=secrets.token_hex(32);(data/'PIRATE.conf').write_text(f'rpcuser={user}\nrpcpassword={password}\n');(data/'komodo.conf').write_text(f'rpcuser={user}\nrpcpassword={password}\n')
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
auth=base64.b64encode((user+':'+password).encode()).decode()
def rpc(method,*params):
 req=urllib.request.Request(f'http://127.0.0.1:{port}',json.dumps({'id':1,'method':method,'params':params}).encode(),{'Authorization':'Basic '+auth})
 try:r=json.load(urllib.request.urlopen(req,timeout=600))
 except urllib.error.HTTPError as e:r=json.load(e)
 if r.get('error'):raise RuntimeError(str(r['error']))
 return r['result']
with (root/'daemon.log').open('w') as log:
 p=subprocess.Popen([str(exe),f'-datadir={data}','-regtest',f'-rpcport={port}','-nuparams=5ba81b19:1','-nuparams=76b809bb:1','-nuparams=37a5165b:5','-server=1','-listen=0','-connect=0','-dnsseed=0','-discover=0','-checkpoints=0','-printtoconsole=1','-noconsole=1','-debug=0'],stdout=log,stderr=subprocess.STDOUT)
 try:
  for _ in range(300):
   if p.poll() is not None:raise RuntimeError('node exited '+str(p.returncode))
   try:info=rpc('getblockchaininfo');break
   except Exception:time.sleep(.5)
  else:raise RuntimeError('startup timed out')
  print('native started',flush=True)
  rpc('generate',10)
  (root/'methods.txt').write_text(rpc('help'))
  (root/'chain.json').write_text(json.dumps(rpc('getblockchaininfo'),indent=2))
  sa=rpc('z_getnewaddress','sapling');ia=rpc('z_getnewaddress','ironwood')
  print('created both pools',flush=True)
  def wait(op):
   for _ in range(2400):
    status=rpc('z_getoperationstatus',[op])
    if status and status[0]['status']=='success':return status[0]['result']['txid']
    if status and status[0]['status']=='failed':raise RuntimeError(json.dumps(status[0]['error']))
    time.sleep(.25)
   raise RuntimeError('operation timed out')
  shield=rpc('z_shieldcoinbase','*',sa,0.0001,10);txid=wait(shield['opid']);rpc('generate',2)
  print('sapling funded',flush=True)
  def memo_for(amount):return (b'420ARRR1'+bytes.fromhex('11'*32)+bytes.fromhex('22'*20)+(amount).to_bytes(8,'little')+(0).to_bytes(4,'little')).ljust(512,b'\0').hex()
  source=sa
  for pool,addr in [('sapling',rpc('z_getnewaddress','sapling')),('ironwood',ia)]:
   amount=3 if pool=='sapling' else 1;memo=memo_for(amount*100000000)
   txid=wait(rpc('z_sendmany',source,[{'address':addr,'amount':amount,'memo':memo}],1,0.0001))
   rpc('generate',2);raw=rpc('getrawtransaction',txid)
   (root/(pool+'-tx.bin')).write_bytes(bytes.fromhex(raw))
   (root/(pool+'-tx.json')).write_text(json.dumps(rpc('getrawtransaction',txid,1),indent=2))
   (root/(pool+'-viewing.private')).write_text(rpc('z_exportviewingkey',addr))
   source=addr
   print(pool,'native transaction accepted',txid,flush=True)
  extra=rpc('z_getnewaddress','ironwood');txid=wait(rpc('z_sendmany',ia,[{'address':extra,'amount':0.5}],1,0.0001));rpc('generate',2)
  (root/'ironwood-spend.bin').write_bytes(bytes.fromhex(rpc('getrawtransaction',txid)))
  (root/'ironwood-spend.json').write_text(json.dumps(rpc('getrawtransaction',txid,1),indent=2))
  print('native subsequent Ironwood spend accepted',txid,flush=True)
  for height in range(rpc('getblockcount')+1):
   block=rpc('getblockhash',height);(root/('block-'+str(height)+'.bin')).write_bytes(bytes.fromhex(rpc('getblock',block,False)));(root/('block-'+str(height)+'.json')).write_text(json.dumps(rpc('getblock',block),indent=2))
  (root/'chain-final.json').write_text(json.dumps(rpc('getblockchaininfo'),indent=2))
  print('native controlled complete',flush=True)

 finally:
  try:rpc('stop')
  except Exception:pass
  try:p.wait(timeout=30)
  except subprocess.TimeoutExpired:p.kill();p.wait(timeout=20)
