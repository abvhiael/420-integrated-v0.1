#!/usr/bin/env python3
"""Bound Solc peak memory by compiling every requested output in smaller batches."""
import sys,subprocess,json,hashlib,pathlib,os
native='/root/.svm/0.8.24/solc-0.8.24'
if '--standard-json' not in sys.argv:
 sys.exit(subprocess.call([native,*sys.argv[1:]]))
x=json.load(sys.stdin);settings=x['settings'];original=settings['outputSelection']
assert settings['viaIR'] is True and settings['evmVersion']=='cancun'
assert settings['optimizer']=={'enabled':True,'runs':200}
key=hashlib.sha256(json.dumps(x,sort_keys=True).encode()).hexdigest()
folder=pathlib.Path('/tmp/bounded-solc-cache')/key;folder.mkdir(parents=True,exist_ok=True)
(folder/'input.json').write_text(json.dumps(x))
progress=pathlib.Path('/tmp/bounded-progress.log')
def note(s):
 with progress.open('a') as f:f.write(s+'\n')
 note_dummy=None

def run(selection,label):
 args={**x,'settings':{**settings,'outputSelection':selection}}
 h=hashlib.sha256(json.dumps(selection,sort_keys=True).encode()).hexdigest()
 cache=folder/(h+'.json')
 if cache.exists():return json.loads(cache.read_text())
 note('START '+label)
 r=subprocess.run([native,*sys.argv[1:]],input=json.dumps(args),text=True,capture_output=True)
 if r.returncode:sys.stderr.write(r.stderr);sys.exit(r.returncode)
 result=json.loads(r.stdout)
 cache.write_text(r.stdout)
 note('END '+label+' errors='+str(sum(e['severity']=='error' for e in result.get('errors',[]))))
 return result
pre=run({p:{'*':['abi']} for p in original},'ABI inventory')
if any(e['severity']=='error' for e in pre.get('errors',[])):
 print(json.dumps(pre));sys.exit(0)
units=[];production={}
for p,contracts in pre.get('contracts',{}).items():
 for name in contracts:
  fields=original[p].get(name,original[p].get('*',[]))
  if not fields:continue
  if p.startswith('test/'):
   units.append(({p:{name:fields}},p+':'+name))
  else:production.setdefault(p,{})[name]=fields
if production:units.insert(0,(production,'production outputs'))
combined={'contracts':{},'sources':pre.get('sources',{}),'errors':[]};warnings=set()
for sel,label in units:
 out=run(sel,label)
 for e in out.get('errors',[]):
  sig=json.dumps(e,sort_keys=True)
  if sig not in warnings:combined['errors'].append(e);warnings.add(sig)
 if any(e['severity']=='error' for e in out.get('errors',[])):
  print(json.dumps(out));sys.exit(0)
 for p,contracts in out.get('contracts',{}).items():combined['contracts'].setdefault(p,{}).update(contracts)
 for p,source in out.get('sources',{}).items():combined['sources'][p]=source
expected={(p,n) for sel,label in units for p,cs in sel.items() for n in cs}
actual={(p,n) for p,cs in combined['contracts'].items() for n in cs}
assert expected==actual,(expected-actual,actual-expected)
manifest={'input_sha256':key,'native_solc':native,'contract_outputs':len(actual),'batches':len(units),'sources':len(x['sources']),'settings':{k:v for k,v in settings.items() if k!='outputSelection'}}
(folder/'manifest.json').write_text(json.dumps(manifest,indent=2));note('COMPLETE '+json.dumps(manifest))
print(json.dumps(combined))
