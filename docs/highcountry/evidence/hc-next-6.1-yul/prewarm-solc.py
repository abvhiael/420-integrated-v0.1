import pathlib,json,hashlib,subprocess,concurrent.futures,os
folder=pathlib.Path('/tmp/bounded-solc-cache/ba1f7139c6e74112f0b50778f66a8bcadd310b969e212714326794482bc2af94');x=json.loads((folder/'input.json').read_text())
def run(job):
 p,name=job;sel={p:{name:x['settings']['outputSelection'][p]['*']}}
 h=hashlib.sha256(json.dumps(sel,sort_keys=True).encode()).hexdigest();cache=folder/(h+'.json')
 if cache.exists():return {'contract':name,'cached':True}
 inp={**x,'settings':{**x['settings'],'outputSelection':sel}}
 r=subprocess.run(['/root/.svm/0.8.24/solc-0.8.24','--standard-json'],input=json.dumps(inp),capture_output=True,text=True)
 if r.returncode:raise RuntimeError(r.stderr)
 out=json.loads(r.stdout);errs=[e for e in out.get('errors',[]) if e['severity']=='error']
 if errs:raise RuntimeError(json.dumps(errs))
 tmp=cache.with_suffix('.prewarm.json');tmp.write_text(r.stdout);os.replace(tmp,cache)
 return {'contract':name,'cached':False,'output_sha256':hashlib.sha256(r.stdout.encode()).hexdigest()}
jobs=[('test/BetPokerNativeOutcome54.t.sol','PokerNativeOutcome54Test'),('test/BetPokerRecovery54.t.sol','PokerWS5Recovery54Test')]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
 for f in concurrent.futures.as_completed([ex.submit(run,j) for j in jobs]):print(json.dumps(f.result()),flush=True)
