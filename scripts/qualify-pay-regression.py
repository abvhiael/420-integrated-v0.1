#!/usr/bin/env python3
"""Qualify tracked Pay owners discovered by independent transitive import analysis."""
import argparse
import fnmatch
import hashlib
import json
import os
from pathlib import Path
import posixpath
import re
import subprocess
import tempfile
import tomllib

from pay_regression_inventory import Inventory, REMAPS, load_archive, passed_log, verify_profile, write_inventory

ROOT = Path(__file__).resolve().parents[1]
CONTRACTS = ROOT / 'contracts'


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--profile', choices=['default', 'pr', 'ci'], required=True)
    p.add_argument('--match', action='append', help='Explicit owner selectors only; never used for default discovery')
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--inventory-only', action='store_true', help='Enumerate every tracked owner and exit without Forge')
    p.add_argument('--baseline-archive', type=Path, help='Retained full CI archive; execute only owners not proven by it')
    p.add_argument('--baseline-sha256', help='Trusted SHA-256 of retained archive')
    a = p.parse_args()
    output = a.output.resolve(); output.mkdir(parents=True, exist_ok=True)
    if bool(a.baseline_archive) != bool(a.baseline_sha256):
        p.error('baseline archive and SHA-256 must be supplied together')
    if a.baseline_archive and (a.profile != 'ci' or a.match):
        p.error('baseline comparison requires full CI discovery, without explicit selectors')
    inv = Inventory(ROOT)
    original_config = inv.read('contracts/foundry.toml').decode()
    baseline = None
    if a.baseline_archive:
        baseline = load_archive(a.baseline_archive, a.baseline_sha256)
        if not re.fullmatch(r'[0-9a-f]{40}|[0-9a-f]{64}', baseline['head']):
            raise RuntimeError('invalid retained source SHA')
        old_config = inv.git('show', baseline['head'] + ':contracts/foundry.toml')
        if old_config != original_config.encode():
            raise RuntimeError('Foundry compilation configuration changed; baseline cannot be reused')
        verify_profile(baseline, original_config)
    inventory = write_inventory(inv, output, baseline)
    print('Tracked test owners:', inventory['tracked_test_owners'])
    print('Selected Pay and supporting owners:', len(inventory['selected']))
    if baseline is not None:
        inherited = inventory['baseline']
        print('Recomputed baseline hashes:', len(inherited['recomputed_hashes']), '/', inherited['expected_hashes'])
        print('Mismatched dependency hashes:', inherited['mismatched'])
        print('Previously passed, outside Pay scope:', inherited['previously_executed_outside_scope'])
        print('Reusable owners:', len(inherited['reusable']))
        print('Owners requiring execution:', inherited['missing'])
    if a.inventory_only:
        return

    selected = inventory['selected']
    if a.match:
        selected = []
        for pattern in a.match:
            matches = [path for path in inventory['owners'] if fnmatch.fnmatchcase(Path(path).name, pattern)
                       or fnmatch.fnmatchcase(posixpath.relpath(path, 'contracts'), pattern)]
            if not matches:
                raise RuntimeError('explicit test selector matched no tracked owner: ' + pattern)
            selected.extend(matches)
        selected = sorted(set(selected))
    elif baseline is not None:
        selected = inventory['baseline']['missing']
    if not inventory['selected']:
        raise RuntimeError('no Pay test owners identified')
    retained = inventory['baseline']['reusable'] if baseline is not None else []
    seen = {}
    for owner in selected:
        for path in inventory['owners'][owner]['closure']:
            seen[posixpath.relpath(path, 'contracts')] = hashlib.sha256(inv.read(path)).hexdigest()
    record = {'head': inv.head, 'profile': a.profile,
              'tests': [posixpath.relpath(p, 'contracts') for p in selected],
              'source_sha256': seen, 'retained_tests': retained}
    if baseline is not None:
        record['baseline_head'] = baseline['head']
        record['baseline_archive_sha256'] = a.baseline_sha256
    if not selected:
        if not retained:
            raise RuntimeError('no executed or reusable owners')
        record['effective_fuzz'] = baseline['effective_fuzz']
        record['effective_invariant'] = baseline['effective_invariant']
        (output / 'inputs.json').write_text(json.dumps(record, indent=2) + '\n')
        record['pass'] = True
        (output / 'results.json').write_text(json.dumps(record, indent=2) + '\n')
        return

    # Mirror only the resolved tracked import closure. Preserve relative paths
    # and remappings even for imports which cross the contracts directory.
    with tempfile.TemporaryDirectory(prefix='pay-qualification-') as folder:
        dest = Path(folder) / 'contracts'; dest.mkdir()
        for rel in sorted(seen):
            path = posixpath.normpath('contracts/' + rel)
            target = Path(folder) / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(inv.read(path))
        config = original_config.replace('[profile.default]', '[profile.default]\nremappings = ' +
                      json.dumps([k + '=' + v for k, v in REMAPS.items()]), 1)
        if config == original_config:
            raise RuntimeError('default Foundry profile missing')
        (dest / 'foundry.toml').write_text(config)
        env = dict(os.environ, FOUNDRY_PROFILE=a.profile)
        effective = json.loads(subprocess.check_output(['forge', 'config', '--root', str(dest), '--json'], env=env, text=True))
        configured = tomllib.loads(original_config)
        original = configured['profile'][a.profile]
        if a.profile == 'default':
            original = {**original, 'invariant': configured['invariant']}
        for key in ('fuzz', 'invariant'):
            for field, value in original[key].items():
                actual = effective[key][field]
                if field == 'seed':
                    if int(actual, 16) != int(value, 16):
                        raise RuntimeError('effective fuzz seed drift')
                elif actual != value:
                    raise RuntimeError('profile drift ' + key + '.' + field)
        record['effective_fuzz'] = effective['fuzz']; record['effective_invariant'] = effective['invariant']
        (output / 'inputs.json').write_text(json.dumps(record, indent=2) + '\n')
        for rel in record['tests']:
            result = subprocess.run(['forge', 'test', '--root', str(dest), '--match-path', rel, '-vv'],
                                    env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            print(result.stdout, end='', flush=True)
            (output / (rel.replace('/', '_') + '.log')).write_text(result.stdout)
            if result.returncode:
                raise RuntimeError('qualification failed: ' + rel)
            passed_log(result.stdout, rel)
        record['pass'] = True
        (output / 'results.json').write_text(json.dumps(record, indent=2) + '\n')


if __name__ == '__main__':
    main()
