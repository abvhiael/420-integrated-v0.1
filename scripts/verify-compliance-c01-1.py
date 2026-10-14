#!/usr/bin/env python3
"""Verify the pinned C01.1 discovery evidence without qualifying absent runtime."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASE = 'c5a4f220d1fbda01f707d359aa9bb32921a138b1'
TREE = 'fe398a6d95f701f0db86115005c60b5adc6b4706'
ALLOWED = {
    'docs/compliance/420COMPLIANCE-ROADMAP.md',
    'docs/compliance/C01.1-INVENTORY.json',
    'docs/compliance/C01.1-INVENTORY-REUSE-GAPS.md',
    'docs/compliance/qualification/C01.1-level1.json',
    'scripts/verify-compliance-c01-1.py',
    'scripts/test-compliance-c01-1.py',
    '.github/workflows/420compliance-c01-level1.yml',
}
REQUIRED_SOURCES = {
    'contracts/src/apps/Identity420.sol',
    'contracts/src/interfaces/genesis/IIdentityCredential420.sol',
    'docs/apps/identity/architecture.md',
    'docs/apps/verify/architecture.md',
    'docs/apps/registry/architecture.md',
    'docs/apps/oracle/index.md',
    'location/geo/index.go',
    'location/privacy/policy.go',
    'location/verify/adapter.go',
    'location/registry/adapter.go',
    'genesis/svc3/travelapp/COMPATIBILITY.md',
    'config/genesis-applications.json',
    'config/genesis-consumer-services.json',
    'contracts/config/genesis-dapp-contract-map.json',
    'contracts/config/genesis-address-namespace.json',
    '.github/workflows/contracts-foundry.yml',
    '.github/workflows/genesis-address-authority.yml',
    '.github/workflows/docs-qualify.yml',
    '.github/workflows/qualification.yml',
}

def check(condition, message):
    if not condition:
        raise ValueError(message)

def git(*args, root=ROOT):
    return subprocess.check_output(['git', *args], cwd=root)

def digest(value):
    return hashlib.sha256(value).hexdigest()

def canonical_digest(value):
    return digest(json.dumps(value, sort_keys=True, separators=(',', ':')).encode())

def unique(records, key):
    values = [r[key] for r in records]
    check(len(set(values)) == len(values), f'duplicate {key}')

def validate_metadata(data):
    check(data['schema'] == '420compliance-c01.1-inventory/v1', 'schema')
    check(data['step'] == 'C01.1' and data['qualification_level'] == 1, 'step/level')
    check(data['base_sha'] == BASE and data['tree_sha'] == TREE, 'wrong base/tree')
    check(data['tree_entry_count'] == 7207, 'incomplete baseline tree')
    check(data['agents_paths'] == [], 'instruction inventory mismatch')
    check(data['dedicated_path_matches'] == [] and data['exact_content_matches'] == [], 'absence claim changed')
    unique(data['sources'], 'path')
    check(len(data['sources']) == 52, 'source inventory incomplete')
    check(REQUIRED_SOURCES <= {s['path'] for s in data['sources']}, 'required source omitted')
    for source in data['sources']:
        check(re.fullmatch(r'[0-9a-f]{40}', source['blob_sha']) is not None, 'invalid blob SHA')
        check(re.fullmatch(r'[0-9a-f]{64}', source['sha256']) is not None, 'invalid content digest')
    for field, count, key in [('branches', 'branch_count', 'branch'), ('open_prs', 'open_pr_count', 'number')]:
        unique(data[field], key)
        check(len(data[field]) == data[count], f'{field} count mismatch')
        check(canonical_digest(data[field]) == data[field + '_sha256'], f'{field} snapshot changed')
    check(data['branch_count'] == 637 and data['open_pr_count'] == 67, 'snapshot coverage')
    check(not any('compliance' in x['branch'].lower() for x in data['branches']), 'prior Compliance branch')
    by_number = {x['number']: x for x in data['open_prs']}
    unique(data['active_dependency_prs'], 'number')
    expected = {x['number'] for x in data['open_prs'] if re.search(
        r'compliance|doobr|bnb|travel|location|maps|identity|verify|registry|oracle',
        x['title'] + ' ' + x['branch'], re.I)}
    check({x['number'] for x in data['active_dependency_prs']} == expected, 'active dependency PR omitted')
    for p in data['active_dependency_prs']:
        check(all(p[k] == v for k, v in by_number[p['number']].items()), 'PR snapshot inconsistent')
    doobr = next(p for p in data['active_dependency_prs'] if p['number'] == 601)
    check(doobr['head'] == '18009040cb6c76f1f96c0da744171d0d9e4b0c16', 'DOOBR head')
    check(doobr['ahead_main'] == 2 and doobr['behind_main'] == 0, 'DOOBR divergence')
    check(len(data['branch_artifacts']) == 2, 'branch artifact coverage')
    unique(data['branch_artifacts'], 'path')

def verify(data, root=ROOT, expected_sha=None):
    validate_metadata(data)
    actual = git('rev-parse', 'HEAD', root=root).decode().strip()
    if expected_sha is not None:
        check(re.fullmatch(r'[0-9a-f]{40}', expected_sha) is not None and actual == expected_sha, 'exact implementation SHA mismatch')
    tree = git('ls-tree', '-r', '--full-tree', BASE, root=root)
    check(digest(tree) == data['tree_listing_sha256'], 'baseline listing digest mismatch')
    check(git('rev-parse', BASE + '^{tree}', root=root).decode().strip() == TREE, 'baseline tree mismatch')
    entries = {}
    for line in tree.decode().splitlines():
        meta, path = line.split('\t', 1)
        entries[path] = meta.split()[2]
    check(len(entries) == data['tree_entry_count'], 'tree entry mismatch')
    check([p for p in entries if p.endswith('AGENTS.md')] == data['agents_paths'], 'AGENTS inventory')
    check(sorted(p for p in entries if re.search(r'compliance|jurisdiction', p, re.I)) == data['dedicated_path_matches'], 'dedicated path inventory')
    for key, patterns in [('exact_content_matches', ['420Compliance', 'jurisdiction_policy']),
                          ('related_content_matches', ['jurisdiction', 'regulatory', 'compliance'])]:
        result = subprocess.run(['git', 'grep', '-I', '-l', '-i',
                                 *[v for p in patterns for v in ('-e', p)], BASE, '--'],
                                cwd=root, capture_output=True, text=True)
        check(result.returncode in (0, 1), 'content scan failed')
        matches = sorted(l.split(':', 1)[1] for l in result.stdout.splitlines())
        check(matches == data[key], 'content inventory mismatch')
    for source in data['sources']:
        path = source['path']
        check(entries.get(path) == source['blob_sha'], 'source blob mismatch: ' + path)
        check(digest(git('show', BASE + ':' + path, root=root)) == source['sha256'], 'source baseline digest: ' + path)
        check(digest((root / path).read_bytes()) == source['sha256'], 'protected source changed: ' + path)
    for p in data['active_dependency_prs']:
        counts = git('rev-list', '--left-right', '--count', BASE + '...' + p['head'], root=root).decode().split()
        check([int(v) for v in counts] == [p['behind_main'], p['ahead_main']], 'PR divergence mismatch')
    for artifact in data['branch_artifacts']:
        target = artifact['ref'] + ':' + artifact['path']
        check(git('rev-parse', target, root=root).decode().strip() == artifact['blob_sha'], 'branch artifact blob mismatch')
        check(digest(git('show', target, root=root)) == artifact['sha256'], 'branch artifact digest mismatch')
    changed = git('diff', '--name-only', BASE, 'HEAD', root=root).decode().splitlines()
    check(set(changed) <= ALLOWED, 'unauthorized changed path')
    roadmap = (root / 'docs/compliance/420COMPLIANCE-ROADMAP.md').read_text()
    for step in ['C01.1', 'C01.2', 'C01.8', 'C08.5', 'C09', 'C10', 'C11']:
        check(step in roadmap, 'canonical step missing: ' + step)
    check('Maps' in roadmap, 'Maps consumer absent')
    audit = (root / 'docs/compliance/C01.1-INVENTORY-REUSE-GAPS.md').read_text()
    for required in ['637', '67', '7,207', 'ANY', 'REGULATED', 'bytecode',
                     'C01.8', 'C08.5', 'TESTNET/EXTERNAL', 'COMP-G13', 'C01.2']:
        check(required in audit, 'audit requirement missing: ' + required)
    return {'step': 'C01.1', 'level': 1, 'implementation_sha': actual,
            'base_sha': BASE, 'result': 'PASS', 'source_count': len(data['sources']),
            'runtime_qualification': 'NOT_APPLICABLE'}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--expected-sha', required=True)
    parser.add_argument('--output')
    args = parser.parse_args()
    data = json.loads((ROOT / 'docs/compliance/C01.1-INVENTORY.json').read_text())
    result = verify(data, expected_sha=args.expected_sha)
    content = json.dumps(result, indent=2) + '\n'
    if args.output:
        Path(args.output).write_text(content)
    print(content, end='')

if __name__ == '__main__':
    main()
