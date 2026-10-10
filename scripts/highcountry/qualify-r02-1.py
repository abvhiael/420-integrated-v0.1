#!/usr/bin/env python3
"""Level 1 qualification for R02.1; no full-app or deployment certification."""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[2]
p = argparse.ArgumentParser()
p.add_argument('--expected-sha', required=True)
p.add_argument('--output', required=True)
p.add_argument('--forge', default='forge')
a = p.parse_args()
out = Path(a.output).resolve()
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root, text=True).strip()
if git('rev-parse', 'HEAD') != a.expected_sha or git('status', '--porcelain'):
    p.error('expected clean exact SHA required')
if out == root or root in out.parents:
    p.error('output must be outside checkout')
out.mkdir(parents=True, exist_ok=True)
env = dict(os.environ, FOUNDRY_PROFILE='default', FOUNDRY_SRC='src/highcountry',
           FOUNDRY_TEST='test/highcountry', FOUNDRY_SCRIPT='script/highcountry',
           FOUNDRY_OUT=str(out/'hc-out'), FOUNDRY_CACHE_PATH=str(out/'hc-cache'))
contracts = 'RealCapabilityGenesisTest|RealCapabilityWiringTest|GenesisRegistryTest|HighCountryAuthorizationTest|GenomeRegistryTest|CultivationEngineTest|HighCountryMigration420Test|HighCountrySessionAccess420Test|GenesisRegistryInvariantTest|GenomeRegistryInvariantTest|CultivationInvariantTest|ProgressiveSessionAccessInvariantTest'
steps = [
    ('build-sizes', [a.forge, 'build', 'src/highcountry', '--sizes'], root/'contracts'),
    ('targeted-contracts', [a.forge, 'test', '--match-contract', '^('+contracts+')$', '-vv'], root/'contracts'),
    ('format', [a.forge, 'fmt', '--check', 'test/highcountry/integration/RealCapabilityGenesis.t.sol'], root/'contracts'),
    ('static-lint', [a.forge, 'lint', 'src/highcountry', '--severity', 'high', 'med', 'low'], root/'contracts'),
    ('source-specification', ['python3', 'scripts/highcountry/verify-r01.py'], root),
    ('patch-whitespace', ['git', 'diff', '--check', 'HEAD^', 'HEAD'], root),
]
results = []
for name, cmd, cwd in steps:
    print('Running '+name, flush=True)
    with (out/(name+'.log')).open('w') as log:
        r = subprocess.run(cmd, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT, timeout=1800)
    content = (out/(name+'.log')).read_bytes()
    results.append(dict(name=name, command=cmd, exitCode=r.returncode, status='PASS' if r.returncode == 0 else 'FAIL', log=name+'.log', logSha256=hashlib.sha256(content).hexdigest()))
test_log = (out/'targeted-contracts.log').read_text()
summary = re.search(r'Ran (\d+) test suites[^\n]*: (\d+) tests passed, (\d+) failed, (\d+) skipped', test_log)
coverage = summary is not None and int(summary[1]) == len(contracts.split('|')) and int(summary[2]) >= 51 and summary[3] == '0' and summary[4] == '0'
for contract in contracts.split('|'):
    coverage = coverage and (':'+contract+'\n') in test_log
results.append(dict(name='required-suite-coverage', status='PASS' if coverage else 'FAIL', summary=summary.group(0) if summary else None))
clean = not git('status', '--porcelain') and git('rev-parse','HEAD') == a.expected_sha
record = dict(step='R02.1', qualificationLevel=1, implementationSha=a.expected_sha, treeSha=git('rev-parse','HEAD^{tree}'),
              cleanSameHeadAfter=clean, profile='default', steps=results,
              forgeVersion=subprocess.check_output([a.forge,'--version'],text=True).strip(),
              scope='Five audit-fix regressions and real CapabilityRegistry wiring only; budgets and account deployment provenance remain separate roadmap steps.')
(out/'r02-1-results.json').write_text(json.dumps(record,indent=2)+'\n')
passed = clean and all(x['status']=='PASS' for x in results)
print(json.dumps(dict(implementationSha=a.expected_sha, passed=passed)))
raise SystemExit(0 if passed else 1)
