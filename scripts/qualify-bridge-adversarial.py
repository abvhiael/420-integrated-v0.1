#!/usr/bin/env python3
"""Qualify only V.18 gaps against immutable, original verifier import closures."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
LOCK = ROOT / 'contracts/config/bridge/adversarial-sources-v1.json'


def git(*args):
    return subprocess.check_output(['git', '--no-replace-objects', '-C', str(ROOT), *args])


def run(args):
    lock = json.loads(LOCK.read_text())
    family = lock['families'][args.family]
    commit = family['source_commit']
    project = args.workspace.resolve()
    if project == ROOT or project.is_relative_to(ROOT) or ROOT.is_relative_to(project):
        raise ValueError('qualification workspace must be outside the repository')
    marker = project / '.bridge-v18-workspace'
    if project.exists() and any(project.iterdir()) and not marker.exists():
        raise ValueError('refusing to reuse a nonempty workspace not owned by this qualifier')
    project.mkdir(parents=True, exist_ok=True)
    marker.write_text('420-bridge-adversarial-v18\n')
    pending = [family['test']] + args.owners
    copied = {}
    while pending:
        path = pending.pop()
        if path in copied:
            continue
        if path.startswith('contracts/test/adversarial/') or (path in family['patches'] and not args.original):
            physical = ROOT / 'qualification/bridge-adversarial/tests' / Path(path).name if path.startswith('contracts/test/adversarial/') else ROOT / path
            payload = physical.read_bytes()
            source = 'V18_TEST' if path.startswith('contracts/test/') else 'V18_PATCH'
        else:
            payload = git('show', commit + ':' + path)
            source = commit
        destination = project / path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(payload)
        copied[path] = {'sha256': hashlib.sha256(payload).hexdigest(), 'source': source}
        for dep in re.findall(r'(?:from\s+|import\s+)[\"\x27]([^\"\x27]+)[\"\x27]', payload.decode()):
            if dep.startswith('@') or dep.startswith('solidity-bytes-utils/'):
                prefix = 'cadc' if args.family == 'cadc' else 'token-routes'
                target = PurePosixPath('contracts/test/fixtures/' + prefix + '/upstream') / dep
            elif dep.startswith('forge-std/'):
                target = PurePosixPath('contracts') / dep
            else:
                target = PurePosixPath(path).parent / dep
            parts = []
            for part in target.parts:
                if part == '..':
                    if not parts:
                        raise ValueError('import escaped repository')
                    parts.pop()
                elif part != '.':
                    parts.append(part)
            pending.append('/'.join(parts))
    for prefix in family['fixture_prefixes']:
        paths = git('ls-tree', '-r', '--name-only', commit, '--', prefix).decode().splitlines()
        if not paths:
            raise ValueError('missing fixture prefix: ' + prefix)
        for path in paths:
            if path.endswith('.sol'):
                continue
            payload = git('show', commit + ':' + path)
            destination = project / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(payload)
            copied[path] = {'sha256': hashlib.sha256(payload).hexdigest(), 'source': commit}
    # Reused projects keep only the selected closure, never stale source files.
    for path in (project / 'contracts').rglob('*.sol'):
        if path.relative_to(project).as_posix() not in copied:
            path.unlink()
    (project / 'foundry.toml').write_text('''[profile.default]
src="contracts/src"
test="contracts/test"
solc_version="0.8.24"
evm_version="cancun"
optimizer=true
optimizer_runs=200
via_ir=true
ffi=false
gas_limit=9223372036854775807
code_size_limit=1000000
remappings=["forge-std/=contracts/forge-std/","@layerzerolabs/=contracts/test/fixtures/cadc/upstream/@layerzerolabs/","@openzeppelin/=contracts/test/fixtures/cadc/upstream/@openzeppelin/","solidity-bytes-utils/=contracts/test/fixtures/cadc/upstream/solidity-bytes-utils/"]
fs_permissions=[{access="read",path="./contracts/test/fixtures"}]
fuzz={runs=2500,seed="0x42018"}
[invariant]
runs=128
depth=64
fail_on_revert=true
''')
    command = [args.forge, 'test', '--root', str(project), '--use', args.solc,
               '--threads', '2', '--match-contract', args.contract,
               '--match-test', args.match, '-vv']
    record = {'family': args.family, 'source_commit': commit, 'original': args.original,
              'files': dict(sorted(copied.items())), 'command': command,
              'foundry_config_sha256': hashlib.sha256((project / 'foundry.toml').read_bytes()).hexdigest()}
    args.inputs.parent.mkdir(parents=True, exist_ok=True)
    args.log.parent.mkdir(parents=True, exist_ok=True)
    args.inputs.write_text(json.dumps(record, indent=2, sort_keys=True) + '\n')
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    args.log.write_text(result.stdout)
    print(result.stdout, end='')
    passed = re.findall(r'^\[PASS\] ([^\n]+)', result.stdout, re.M)
    if result.returncode == 0 and not passed:
        raise ValueError('zero passing tests')
    raise SystemExit(result.returncode)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--family', required=True, choices=json.loads(LOCK.read_text())['families'])
    parser.add_argument('--workspace', type=Path, required=True)
    parser.add_argument('--forge', default=os.environ.get('BRIDGE_FORGE', 'forge'))
    parser.add_argument('--solc', default='0.8.24')
    parser.add_argument('--match', default='^(testV18|testFuzzV18|invariantV18)')
    parser.add_argument('--contract', default='.*V18.*Test')
    parser.add_argument('--inputs', type=Path, required=True)
    parser.add_argument('--log', type=Path, required=True)
    parser.add_argument('--owners', nargs='*', default=[], help='additional affected original owners; never runs them without an explicit test/contract selection')
    parser.add_argument('--original', action='store_true', help='reproduce with original production source')
    run(parser.parse_args())
