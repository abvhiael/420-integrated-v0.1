"""Scoped Level 1: execute domain frameworks, preserving inherited client checks."""
import argparse
from datetime import datetime,timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[2]
SCOPE=['clients/420bet-fantasy','scripts/fantasy/qualify-format-frameworks.py','.github/workflows/420bet-fantasy-formats-level1.yml']


def git(*args): return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);args=parser.parse_args()
    out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True);cert=out/'qualification.json';cert.unlink(missing_ok=True)
    if git('status','--porcelain','--',*SCOPE): raise RuntimeError('scoped files must be tracked and clean')
    sha=git('rev-parse','HEAD');env=dict(os.environ)
    env.pop('SPORTRADAR_API_KEY',None);env.pop('SPORTRADAR_API_KEY_FILE',None)
    cases={}
    for name,command,expected in [
        ('formats',[sys.executable,'clients/420bet-fantasy/formats/check_frameworks.py'],56),
        ('inherited',[sys.executable,'-m','unittest','discover','-s','clients/420bet-fantasy','-p','test_*.py','-v'],77)]:
        result=subprocess.run(command,cwd=ROOT,env=env,capture_output=True)
        (out/(name+'.stdout.log')).write_bytes(result.stdout);(out/(name+'.stderr.log')).write_bytes(result.stderr)
        log=result.stderr.decode('utf-8').replace('\r\n','\n')
        if result.returncode or not re.search(rf'Ran {expected} tests\b',log) or '\nOK\n' not in log or 'skipped=' in log or 'expected failures=' in log: raise RuntimeError('actual complete execution required: '+name)
        cases[name]=expected
    paths=git('ls-files','--',*SCOPE).splitlines();sources={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in paths}
    if not paths or sha!=git('rev-parse','HEAD') or git('status','--porcelain','--',*SCOPE): raise RuntimeError('source drift')
    evidence={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in out.iterdir() if p.is_file() and p.name!='qualification.json'}
    report={'level':1,'qualifiedSHA':sha,'tree':git('rev-parse','HEAD^{tree}'),'scope':'Draft fantasy domain frameworks; no chain custody or oracle acceptance',
            'testsPassed':cases,'officialNetworkAccepted':False,'fundedLevel2Accepted':False,'productionApproved':False,
            'sourceSHA256':sources,'evidenceSHA256':evidence,'completedAt':datetime.now(timezone.utc).isoformat()}
    cert.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:report[k] for k in ('level','qualifiedSHA','testsPassed','fundedLevel2Accepted')}))


if __name__=='__main__':main()
