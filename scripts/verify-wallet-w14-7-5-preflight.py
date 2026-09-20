#!/usr/bin/env python3
"""W14.7.5 preflight: evidence inventory only, NEVER a deployment attestation.

Default mode reports blockers without breaking development CI. --strict exits nonzero
until approved addresses, pinned compiled artifacts and constructor storage exist.
The W14.7.2 generator and W14.7.3 verifier remain separate release gates.
"""
import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
HEX_RUNTIME = re.compile(r'0x(?:[0-9a-fA-F]{2})+\Z')
HEX_WORD = re.compile(r'0x[0-9a-fA-F]{64}\Z')


def check(plan, canonical, inventory, storage_init, artifacts, generated_storage, source_root):
    blockers = []
    entries = plan.get('predeploys', [])
    if plan.get('status') != 'FROZEN_ADDRESS_MAP_ARTIFACTS_READY':
        blockers.append('predeploy plan has not been qualified/frozen with actual artifacts')
    if inventory.get('releaseGates', {}).get('canonicalAddressConflictResolved') is not True:
        blockers.append('W14.7.4 global address migration is not approved and qualified')
    if not isinstance(entries, list) or not entries:
        blockers.append('predeploy inventory is empty or invalid')
        entries = []
    if not isinstance(artifacts, pathlib.Path) or not artifacts.is_dir():
        blockers.append('compiled runtime artifact directory is missing')
    if not isinstance(generated_storage, dict):
        blockers.append('independently generated explicit storage map is missing')
    if not isinstance(storage_init, dict):
        blockers.append('constructor/post-init input specification is missing')
        storage_init = {}
    if not isinstance(canonical, dict):
        blockers.append('canonical authority registry is missing')
        canonical = {}
    source_root = pathlib.Path(source_root)
    anchors = {x.get('contract', '').removesuffix('.sol'): x.get('address', '').lower()
               for x in canonical.get('anchors', []) if isinstance(x, dict)}
    slots = {}
    names = set()
    for entry in entries:
        if not isinstance(entry, dict):
            blockers.append('invalid predeploy entry')
            continue
        name = entry.get('name')
        address = entry.get('address', '')
        if not isinstance(name, str) or not name or name in names:
            blockers.append('duplicate or invalid planned identity: %r' % name)
            continue
        names.add(name)
        if not isinstance(address, str) or not re.fullmatch(r'0x[0-9a-fA-F]{40}', address):
            blockers.append('%s has invalid placement address' % name)
            continue
        address = address.lower()
        if address in slots and slots[address] != name:
            blockers.append('address collision: %s / %s' % (slots[address], name))
        slots[address] = name
        if name in anchors and anchors[name] != address:
            blockers.append('%s differs from canonical authority address' % name)
        source = entry.get('source')
        if not isinstance(source, str) or not (source_root / source).is_file():
            blockers.append('%s source file is missing: %r' % (name, source))
        artifact_file = artifacts / (name + '.json')
        if not artifact_file.is_file():
            blockers.append('%s has no compiled runtime artifact' % name)
        else:
            try:
                artifact = json.loads(artifact_file.read_text(encoding='utf-8'))
                runtime = artifact.get('deployedBytecode', artifact.get('deployed_bytecode'))
                if isinstance(runtime, dict):
                    runtime = runtime.get('object')
                if not isinstance(runtime, str) or not HEX_RUNTIME.fullmatch(runtime):
                    blockers.append('%s has missing/unlinked deployed runtime bytecode' % name)
                if not isinstance(artifact.get('metadata'), (str, dict)):
                    blockers.append('%s has no compiler/build metadata for provenance review' % name)
            except (OSError, ValueError, TypeError) as exc:
                blockers.append('%s artifact cannot be read: %s' % (name, exc))
        spec = storage_init.get('entries', {}).get(name)
        if not isinstance(spec, dict):
            blockers.append('%s has no constructor/post-init specification' % name)
        values = generated_storage.get(name) if isinstance(generated_storage, dict) else None
        if not isinstance(values, dict) or not all(
                isinstance(k, str) and HEX_WORD.fullmatch(k) and
                isinstance(v, str) and HEX_WORD.fullmatch(v) for k, v in values.items()):
            blockers.append('%s has no valid explicit 32-byte storage map' % name)
    if isinstance(generated_storage, dict) and set(generated_storage) != names:
        blockers.append('generated storage identities differ from predeploy inventory')
    unresolved = ('UNRESOLVED', 'FROM_FROZEN', 'FROM_COMPILED', 'PENDING', 'TODO')
    for key in ('genesis_time', 'founder_beneficiaries', 'bridge_verifier',
                'dex_pool_implementation', 'bootstrap_governor'):
        value = storage_init.get(key)
        if value is None or (isinstance(value, str) and any(value.startswith(s) for s in unresolved)):
            blockers.append('unqualified constructor input: %s' % key)
    return {'phase': 'W14.7.5', 'evidenceOnly': True, 'ready': not blockers,
            'plannedPredeploys': len(entries), 'blockers': sorted(set(blockers))}


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--strict', action='store_true', help='fail until all predeploy inputs are qualified')
    ap.add_argument('--output', help='optional path for a non-attestation JSON report')
    args = ap.parse_args(argv)
    try:
        base = ROOT / 'contracts/config/predeploy'
        generated = base / 'generated-storage.json'
        report = check(read_json(base / 'predeploy-plan.json'),
                       read_json(ROOT / 'contracts/config/genesis-canonical-addresses.json'),
                       read_json(ROOT / 'wallet/deployment-inventory.json'),
                       read_json(base / 'storage-init.json'), ROOT / 'contracts/artifacts',
                       read_json(generated) if generated.exists() else None,
                       ROOT / 'contracts/src')
        if args.output:
            output = pathlib.Path(args.output)
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(report, indent=2))
        return 2 if args.strict and not report['ready'] else 0
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print('W14.7.5 preflight ERROR: %s' % exc, file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
