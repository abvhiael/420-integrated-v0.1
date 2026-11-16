#!/usr/bin/env python3
"""Adversarial owned-note checks using only the disposable native harness wallet."""
import argparse
import json
from pathlib import Path
import subprocess
import tempfile

def main():
 p=argparse.ArgumentParser();p.add_argument('--workdir',required=True);p.add_argument('--binary',required=True);p.add_argument('--params',required=True);p.add_argument('--only');a=p.parse_args();root=Path(a.workdir);checks=[]
 with tempfile.TemporaryDirectory(prefix='pirate-owned-negative-') as d:
  request=Path(d)/'request.json'
  for pool in ['sapling','ironwood']:
   baseline=json.loads((root/(pool+'-decrypt.json')).read_text());key=root/(pool+'-fvk.private')
   for name,patch in [('wrong tree root',{'root':'00'*32}),('wrong note position',{'position':baseline['position']^1}),('wrong output',{'output_index':baseline['output_index']^1}),('wrong pool',{'pool':baseline['pool']^1}),('caller-selected nullifier',{'nullifier':'00'*32}),('missing witness',{'siblings':[]})]:
    if a.only and a.only!=pool+': '+name:continue
    candidate=dict(baseline,**patch);request.write_text(json.dumps(candidate))
    r=subprocess.run([str(Path(a.binary).resolve()),str(request),str(key.resolve()),str(Path(a.params).resolve())],capture_output=True,text=True)
    if r.returncode!=2 or r.stdout or r.stderr!='shielded evidence rejected\n':raise RuntimeError('owned-note rejection failure: '+pool+': '+name+'; exit='+str(r.returncode)+'; stderr='+r.stderr)
    checks.append(pool+': '+name);print('PASS '+pool+': '+name,flush=True)
 print(json.dumps({'checks':checks,'passed':len(checks)},indent=2))
if __name__=='__main__':main()
