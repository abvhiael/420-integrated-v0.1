#!/usr/bin/env python3
"""Run unchanged Pay test owners in a temporary, remapped import closure."""
import argparse
import fnmatch
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import tomllib

ROOT=Path(__file__).resolve().parents[1]
CONTRACTS=ROOT/'contracts'
PATTERNS=('*Pay*.t.sol','Payment*.t.sol','InvoiceRegistry420*.t.sol',
          'SettlementRouter420*.t.sol','RefundManager420*.t.sol','GasSponsor420*.t.sol',
          'MerchantRegistry420*.t.sol','CanonicalSettlementAdapter420*.t.sol',
          'CanonicalSwapHealthAdapter420*.t.sol','ReplayProtectionConsumer420*.t.sol')
REMAPS={'forge-std/':'forge-std/',
        '@layerzerolabs/':'test/fixtures/cadc/upstream/@layerzerolabs/',
        '@openzeppelin/':'test/fixtures/cadc/upstream/@openzeppelin/',
        'solidity-bytes-utils/':'test/fixtures/cadc/upstream/solidity-bytes-utils/'}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--profile',choices=['pr','ci'],required=True)
    p.add_argument('--match',action='append')
    p.add_argument('--output',type=Path,required=True)
    a=p.parse_args()
    output=a.output.resolve();output.mkdir(parents=True,exist_ok=True)
    tests=sorted(t for t in (CONTRACTS/'test').rglob('*.t.sol')
                 if any(fnmatch.fnmatchcase(t.name,pat) for pat in (a.match or PATTERNS)))
    if not tests:raise RuntimeError('no Pay test owners')
    # Discover imported Pay implementation tests too, regardless of filename.
    if not a.match:
        for t in sorted((CONTRACTS/'test').rglob('*.t.sol')):
            if t not in tests and re.search(r'(?:src/pay/|PayIds420|ReplayDomainIds420)',t.read_text()):
                tests.append(t)
        tests.sort()
    with tempfile.TemporaryDirectory(prefix='pay-qualification-') as folder:
        dest=Path(folder);pending=list(tests);seen={}
        while pending:
            source=pending.pop().resolve();rel=source.relative_to(CONTRACTS)
            if str(rel) in seen:continue
            raw=source.read_bytes();seen[str(rel)]=hashlib.sha256(raw).hexdigest()
            target=dest/rel;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
            for dep in re.findall(r'(?:from\s+|import\s+)["\x27]([^"\x27]+)["\x27]',raw.decode()):
                path=next((CONTRACTS/(v+dep[len(k):]) for k,v in REMAPS.items() if dep.startswith(k)),None)
                pending.append(path if path is not None else source.parent/dep)
        # Preserve exact compiler and fuzz/invariant settings of the chosen repository profile.
        config=(CONTRACTS/'foundry.toml').read_text()
        config=config.replace('[profile.default]','[profile.default]\nremappings = '+json.dumps([k+'='+v for k,v in REMAPS.items()]),1)
        (dest/'foundry.toml').write_text(config)
        env=dict(os.environ,FOUNDRY_PROFILE=a.profile)
        effective=json.loads(subprocess.check_output(['forge','config','--root',folder,'--json'],env=env,text=True))
        original=tomllib.loads((CONTRACTS/'foundry.toml').read_text())['profile'][a.profile]
        for key in ('fuzz','invariant'):
            for field,value in original[key].items():
                if field=='seed':continue # Foundry normalizes seed to a 32-byte value.
                if effective[key][field]!=value:raise RuntimeError('profile drift '+key+'.'+field)
        record={'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
                'profile':a.profile,'tests':[str(t.relative_to(CONTRACTS)) for t in tests],
                'source_sha256':seen,'effective_fuzz':effective['fuzz'],'effective_invariant':effective['invariant']}
        (output/'inputs.json').write_text(json.dumps(record,indent=2)+'\n')
        # Each selected owner must report actual passing tests, not a zero-match success.
        for t in tests:
            rel=str(t.relative_to(CONTRACTS))
            result=subprocess.run(['forge','test','--root',folder,'--match-path',rel,'-vv'],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
            print(result.stdout,end='',flush=True)
            (output/(rel.replace('/','_')+'.log')).write_text(result.stdout)
            if result.returncode or not re.search(r'[1-9][0-9]* tests? passed',result.stdout):
                raise RuntimeError('qualification failed: '+rel)
        record['pass']=True
        (output/'results.json').write_text(json.dumps(record,indent=2)+'\n')

if __name__=='__main__':main()
