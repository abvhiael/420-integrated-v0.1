import json,sys,time,subprocess,pathlib,os
x=json.load(open('/tmp/main-shard0-input.json'));keys=list(x['settings']['outputSelection']);sel=[p for p in keys if any(a in p for a in sys.argv[1:])]
x['settings']['outputSelection']={p:x['settings']['outputSelection'][p] for p in sel}

if os.environ.get('ISOLATE_CONTRACTS'):
 x['settings']['outputSelection']={p:{n:['evm.bytecode.object'] for n in os.environ['ISOLATE_CONTRACTS'].split(',')} for p in sel}

if os.environ.get('ISOLATE_OVERRIDE'):
 x['sources']['test/BetPokerNLHEBetting54.t.sol']['content']=pathlib.Path(os.environ['ISOLATE_OVERRIDE']).read_text()
t=time.time();r=subprocess.run(['/root/.svm/0.8.24/solc-0.8.24','--standard-json'],input=json.dumps(x),capture_output=True,text=True)
try:o=json.loads(r.stdout)
except: print(r.stderr);sys.exit(2)
errors=[e for e in o.get('errors',[]) if e['severity']=='error'];print(json.dumps({'selected':sel,'seconds':time.time()-t,'errors':errors}),flush=True)
pathlib.Path('/tmp/exact-output.json').write_text(r.stdout)
