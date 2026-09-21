#!/usr/bin/env python3
"""Inventory legacy Genesis address consumers before a coordinated W14.7.4 migration.

This is an evidence collector, NOT a migration, freeze-exception approval, or
release gate. Run against the exact integration branch to enumerate all tracked
text files that still mention an address whose contract identity is moving.
No automated string replacement of Solidity, storage words or genesis images.
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CANDIDATE = 'contracts/config/w14-7-4-global-address-reconciliation.json'
EXCLUDE = {CANDIDATE, 'scripts/audit-wallet-w14-7-4-consumers.py'}
TEXT_SUFFIXES = {'.sol', '.json', '.jsonl', '.md', '.py', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.go', '.rs', '.swift', '.kt', '.kts', '.java', '.yml', '.yaml', '.toml', '.env', '.sh', '.html', '.css', '.txt'}


def address(value):
    if not isinstance(value, str) or not re.fullmatch(r'0x[0-9a-fA-F]{1,40}', value):
        raise ValueError('invalid address %r' % value)
    return '0x' + format(int(value[2:], 16), '040x')


def moving_claims(candidate):
    """Map old 20-byte addresses to the identities moving away from them."""
    old = {}
    new = {}
    for name, addr in candidate['preservedSystemAssignments']:
        new[name] = address(addr)
    for item in candidate['migratedExistingPredeploys']:
        name = item['name']
        old.setdefault(address(item['from']), []).append(name)
        new[name] = address(item['to'])
    for key, name, addr in candidate['canonicalAuthorities']:
        new[name] = address(addr)
        # The current canonical registry uses conflicting entries at 0x0420..
        # 0x043b. The names and identities here are resolved by the caller
        # supplying the *current* canonical registry, never by slot guessing.
    for name, addr in candidate['bridgeCandidates']:
        new[name] = address(addr)
    return old, new


def claims_from_authorities(candidate, canonical, bridge):
    old, new = moving_claims(candidate)
    canonical_by_id = {entry['id']: entry for entry in canonical['anchors']}
    for identity, name, target in candidate['canonicalAuthorities']:
        source = canonical_by_id[identity]['address']
        if address(source) != address(target):
            old.setdefault(address(source), []).append(name)
    bridge_by_name = {entry['name']: entry for entry in bridge['assignments']}
    for name, target in candidate['bridgeCandidates']:
        source = bridge_by_name[name]['address']
        if address(source) != address(target):
            old.setdefault(address(source), []).append(name)
    return {slot: sorted(set(names)) for slot, names in old.items()}, new


def tracked_files(root):
    try:
        output = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root)
        return [root / path.decode('utf-8') for path in output.split(b'\0') if path]
    except (OSError, subprocess.CalledProcessError):
        # Unit-test fixture roots may not have Git metadata. In the real
        # repository prefer git ls-files so generated/untracked files do not
        # become silently authoritative.
        return [p for p in root.rglob('*') if p.is_file() and '.git' not in p.parts]


def inventory(root, old, paths=None):
    findings = []
    paths = tracked_files(root) if paths is None else paths
    for path in paths:
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        try:
            relative = path.relative_to(root).as_posix()
        except ValueError:
            continue
        if relative in EXCLUDE or '/node_modules/' in '/' + relative or '/vendor/' in '/' + relative:
            continue
        if path.stat().st_size > 2_000_000:
            continue
        try:
            lines = path.read_text(encoding='utf-8').splitlines()
        except (OSError, UnicodeError):
            continue
        for number, line in enumerate(lines, 1):
            for match in re.finditer(r'(?<![0-9A-Za-z])0x[0-9a-fA-F]{40}(?![0-9A-Za-z])', line):
                addr = match.group().lower()
                if addr in old:
                    findings.append({'path': relative, 'line': number, 'oldAddress': addr,
                                     'claimedMigratingIdentities': old[addr],
                                     'context': line.strip()[:200]})
    return sorted(findings, key=lambda item: (item['path'], item['line'], item['oldAddress']))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=pathlib.Path, default=ROOT)
    parser.add_argument('--strict', action='store_true', help='exit nonzero if any legacy consumer remains')
    args = parser.parse_args(argv)
    root = args.root.resolve()
    try:
        candidate = json.loads((root / CANDIDATE).read_text(encoding='utf-8'))
        canonical = json.loads((root / 'contracts/config/genesis-canonical-addresses.json').read_text(encoding='utf-8'))
        bridge = json.loads((root / 'config/swap-bridge-extension-addresses.json').read_text(encoding='utf-8'))
        old, target = claims_from_authorities(candidate, canonical, bridge)
        findings = inventory(root, old)
        result = {'phase': 'W14.7.4', 'status': 'LEGACY_CONSUMER_INVENTORY_NOT_DEPLOYMENT_ATTESTATION',
                  'legacySlotCount': len(old), 'matchCount': len(findings), 'matches': findings,
                  'readyForLiveTestnet': False}
        print(json.dumps(result, indent=2))
        return int(args.strict and bool(findings))
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print('W14.7.4 consumer audit blocked: %s' % exc, file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
