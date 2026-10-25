import json,pathlib,subprocess,hashlib,concurrent.futures
names=['src/bet/fantasy/FantasyContestEngine420.sol','src/bet/fantasy/FantasyAdmission420.sol']
def run(n):
 p=pathlib.Path(f'/tmp/fantasy-shard{n}-input.json');prior=pathlib.Path(f'/tmp/fantasy-shard{n}-sizes.json')
 if prior.exists():
  record=json.loads(prior.read_text())
  if record['compiler_input_sha256']==hashlib.sha256(p.read_bytes()).hexdigest():return record
 x=json.loads(p.read_text());settings=x['settings'];assert settings['viaIR'] and settings['evmVersion']=='cancun' and settings['optimizer']=={'enabled':True,'runs':200}
 selected=[s for s in names if s in x['sources']]
 if not selected:return {'shard':n,'source_count':len(x['sources']),'not_applicable':'changed deployables absent from assigned dependency graph'}
 x['settings']['outputSelection']={s:{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']} for s in selected}
 r=subprocess.run(['/root/.svm/0.8.24/solc-0.8.24','--standard-json'],input=json.dumps(x),text=True,capture_output=True);assert r.returncode==0,r.stderr
 out=json.loads(r.stdout);errors=[e for e in out.get('errors',[]) if e['severity']=='error'];assert not errors,errors
 sizes={}
 for source in selected:
  for name,c in out['contracts'][source].items():
   runtime=len(c['evm']['deployedBytecode']['object'])//2;init=len(c['evm']['bytecode']['object'])//2
   assert runtime<=24576 and init<=49152,(n,name,runtime,init)
   sizes[name]={'runtime':runtime,'initcode':init,'runtime_margin':24576-runtime}
 record={'shard':n,'compiler_input_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'source_count':len(x['sources']),'settings':{k:v for k,v in settings.items() if k!='outputSelection'},'sizes':sizes}
 pathlib.Path(f'/tmp/fantasy-shard{n}-sizes.json').write_text(json.dumps(record,indent=2)+'\n');return record
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
 for f in concurrent.futures.as_completed([ex.submit(run,n) for n in range(4)]):print(json.dumps(f.result()),flush=True)
