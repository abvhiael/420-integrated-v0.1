#!/usr/bin/env python3
"""Qualify an exact clean foundation head; never certify missing gameplay or live deployment."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import shutil
import sys
from datetime import datetime, timezone

root = Path(__file__).resolve().parents[2]
p = argparse.ArgumentParser()
p.add_argument('--output', required=True)
p.add_argument('--expected-sha', required=True)
p.add_argument('--forge', default='forge')
p.add_argument('--profile', default='default', choices=['default', 'pr', 'ci', 'hardening'])
a = p.parse_args()
out = Path(a.output).resolve()
if out == root or root in out.parents:
    p.error('output must be outside checkout')
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root, text=True).strip()
head = git('rev-parse', 'HEAD')
if head != a.expected_sha or git('status', '--porcelain'):
    p.error('qualification requires the expected SHA and a clean checkout')
out.mkdir(parents=True, exist_ok=True)
env = dict(os.environ, FOUNDRY_PROFILE=a.profile)
# Preserve byte-identical canonical source/test files and compiler settings while
# avoiding unrelated repository tests as compilation roots.
shared = out/'shared-project'
(shared/'test').mkdir(parents=True, exist_ok=True)
if not (shared/'src').exists():
    (shared/'src').symlink_to(root/'contracts/src', target_is_directory=True)
shutil.copyfile(root/'contracts/foundry.toml', shared/'foundry.toml')
shared_inputs = sorted((root/'contracts/test').glob('GamingProtocol420*.t.sol'))
for test in shared_inputs:
    shutil.copyfile(test, shared/'test'/test.name)
scoped_env = dict(env, FOUNDRY_SRC='src/highcountry', FOUNDRY_TEST='test/highcountry',
                  FOUNDRY_SCRIPT='script/highcountry', FOUNDRY_OUT=str(out/'hc-out'),
                  FOUNDRY_CACHE_PATH=str(out/'hc-cache'))
shared_env = dict(env, FOUNDRY_SRC='src/gaming', FOUNDRY_TEST='test', FOUNDRY_SCRIPT='script',
                  FOUNDRY_OUT=str(shared/'out'), FOUNDRY_CACHE_PATH=str(shared/'cache'))
def tests(bases):
    return ['node', '--test'] + [str(x.relative_to(root)) for base in bases
                                for x in sorted((root/base).glob('*.test.js'))]
steps = [
    ('solidity-build-sizes', [a.forge, 'build', 'src/highcountry', '--sizes'], 'contracts', 0),
    ('hc-unit-integration-invariants', [a.forge, 'test', '--match-path', 'test/highcountry/**/*.t.sol', '-vv'], 'contracts', 0),
    ('shared-gaming-contracts', [a.forge, 'test', '--match-path', 'test/GamingProtocol420*.t.sol', '-vv'], 'contracts', 0),
    ('solidity-static-lint', [a.forge, 'lint', 'src/highcountry', '--severity', 'high', 'med', 'low'], 'contracts', 0),
    ('solidity-format', [a.forge, 'fmt', '--check', 'src/highcountry', 'test/highcountry'], 'contracts', 0),
    ('hc-access-sdk', tests(['clients/highcountry-access-v1/test', 'packages/420-gaming-sdk/test']), '.', 0),
    ('shared-runtime-libraries', tests(['packages/420-gaming-client-hardening/test',
                                      'packages/420-gaming-cross-game-qualification/test',
                                      'services/420-gaming-player-profile/test',
                                      'services/420-gaming-query/test']), '.', 0),
    ('runtime-template', ['node', 'scripts/gaming/verify-runtime-manifest.mjs', 'deployments/gaming/testnet.runtime.json'], '.', 0),
    ('live-runtime-blocker', ['node', 'scripts/gaming/qualify-live-testnet.mjs', 'deployments/gaming/testnet.runtime.json'], '.', 2),
    ('patch-whitespace', ['git', 'diff', '--check', head+'^', head], '.', 0),
]
results = []
for name, cmd, cwd, expected in steps:
    print('Running ' + name, flush=True)
    logfile = out/(name+'.log')
    run_env = shared_env if name == 'shared-gaming-contracts' else (scoped_env if cmd[0] == a.forge else env)
    run_cwd = shared if name == 'shared-gaming-contracts' else root/cwd
    with logfile.open('w') as log:
        try:
            code = subprocess.run(cmd, cwd=run_cwd, env=run_env, stdout=log,
                                  stderr=subprocess.STDOUT, timeout=1800).returncode
        except subprocess.TimeoutExpired:
            log.write('\nQUALIFICATION TIMEOUT\n')
            code = 124
    results.append({'name': name, 'command': cmd, 'exitCode': code,
                    'status': 'BLOCKED' if name == 'live-runtime-blocker' and code == 2
                              else ('PASS' if code == expected else 'FAIL'),
                    'sourceRoots': {k: run_env[k] for k in ['FOUNDRY_SRC','FOUNDRY_TEST','FOUNDRY_SCRIPT'] if k in run_env},
                    'log': logfile.name, 'logSha256': hashlib.sha256(logfile.read_bytes()).hexdigest()})
inventory = json.loads((root/'docs/highcountry/FILE-INVENTORY-20261009.json').read_text())
bad = [row['path'] for category in ['owned', 'sharedDependencies'] for row in inventory[category]
       if not (root/row['path']).is_file() or hashlib.sha256((root/row['path']).read_bytes()).hexdigest() != row['sha256']]
results.append({'name': 'reviewed-inventory', 'status': 'FAIL' if bad else 'PASS', 'mismatches': bad})
clean = not git('status', '--porcelain')
unchanged = git('rev-parse', 'HEAD') == head
metadata = {'schema': 'highcountry-exact-head-foundation-qualification-v1', 'implementationSha': head,
            'treeSha': git('rev-parse', 'HEAD^{tree}'), 'timeUtc': datetime.now(timezone.utc).isoformat(),
            'profile': a.profile, 'forgeVersion': subprocess.check_output([a.forge, '--version'], text=True).strip(),
            'nodeVersion': subprocess.check_output(['node', '--version'], text=True).strip(),
            'cleanCheckoutAfter': clean, 'sameHeadAfter': unchanged, 'steps': results,
            'fullApplicationReleaseQualified': False,
            'sharedTestInputs': {str(x.relative_to(root)): hashlib.sha256(x.read_bytes()).hexdigest() for x in shared_inputs},
            'scope': 'Existing HC/Gaming foundations only; compiler configuration retained, all imported dependencies included; unresolved live acceptance is BLOCKED.'}
(out/'qualification.json').write_text(json.dumps(metadata, indent=2)+'\n')
failed = not clean or not unchanged or any(x['status'] == 'FAIL' for x in results)
print(json.dumps({'sha': head, 'executableFoundationChecksPassed': not failed,
                  'liveAcceptance': 'BLOCKED', 'fullApplicationReleaseQualified': False}))
sys.exit(1 if failed else 0)
