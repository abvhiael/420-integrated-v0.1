#!/usr/bin/env python3
"""Rebuild the exact upstream Circle creation bytecode; reject source drift."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parents[2]
SOURCE=Path(__file__).resolve().parent/'upstream'
FIX=ROOT/'contracts/test/fixtures/cctp/upstream'
def main():
    p=argparse.ArgumentParser();p.add_argument('--solc',default='solc');args=p.parse_args()
    manifest=json.loads((SOURCE/'manifest.json').read_text())
    for name,expected in manifest['files'].items():
        if hashlib.sha256((SOURCE/name).read_bytes()).hexdigest()!=expected:raise RuntimeError('upstream source drift: '+name)
    version=subprocess.check_output([args.solc,'--version'],text=True)
    if 'Version: 0.7.6+' not in version:raise RuntimeError('upstream requires exact solc 0.7.6')
    command=[str(Path(args.solc).resolve()) if '/' in args.solc else args.solc,'--optimize','--optimize-runs','100000','--base-path','.','--allow-paths',str(SOURCE),'@memview-sol/=lib/memview-sol/','@openzeppelin/=lib/openzeppelin-contracts/','--combined-json','abi,bin,bin-runtime',*manifest['entries']]
    result=subprocess.run(command,cwd=SOURCE,check=True,capture_output=True,text=True);contracts=json.loads(result.stdout)['contracts']
    for entry in manifest['entries']:
        name=Path(entry).stem;actual=contracts[entry+':'+name]['bin'];expected=(FIX/(name+'.creation.hex')).read_text()
        if actual!=expected:raise RuntimeError('upstream bytecode mismatch: '+name)
        if hashlib.sha256(bytes.fromhex(actual)).hexdigest()!=manifest['creation_code_sha256'][name]:raise RuntimeError('artifact checksum mismatch')
    print(json.dumps({'commit':manifest['commit'],'source_files':len(manifest['files']),'exact_native_creation_artifacts':len(manifest['entries'])}))
if __name__=='__main__':main()
