#!/usr/bin/env python3
"""One bounded seed-phase contract closeout; no unrelated Solidity qualification."""
import hashlib,json,os,re,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def main():
 reports=[]
 for name in ['closeout','genome','rare','pack','opening','payment']:
  runner=ROOT/('scripts/highcountry/run_seed_'+name+'_contracts.py');result=subprocess.run([sys.executable,str(runner)],cwd=ROOT,capture_output=True,text=True);print(result.stdout);print(result.stderr)
  passed=re.findall(r'Suite result: ok\. (\d+) passed; 0 failed;',result.stdout)
  if result.returncode or not passed:raise RuntimeError('actual contract suite failed or evidence absent: '+name)
  reports.append({'suite':name,'passed':sum(map(int,passed)),'stdoutSha256':hashlib.sha256(result.stdout.encode()).hexdigest()})
 expected={'closeout':3,'genome':9,'rare':8,'pack':7,'opening':14,'payment':11}
 if {r['suite']:r['passed'] for r in reports}!=expected:raise ValueError('bounded canonical suite drift')
 result={'schema':'HC.SEED.PHASE_CONTRACTS.V1','environment':'DISPOSABLE_CONTRACT_TEST','implementationSha':os.environ.get('HC_SEED_CLOSEOUT_HEAD'),'liveRegistration':False,'passed':52,'suites':reports}
 out=ROOT/'artifacts/highcountry/hc-seed-10-contracts.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,indent=2)+'\n');print('HC_SEED_CONTRACTS_JSON='+json.dumps(result))
if __name__=='__main__':main()
