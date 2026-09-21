#!/usr/bin/env python3
"""Read-only AI/Genesis reconciliation gate; never reallocates frozen addresses."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))

def entries_by_name(entries, field):
    result = {}
    for entry in entries:
        name = entry[field]
        if name in result:
            raise ValueError(f'duplicate name {name}')
        result[name] = entry['address'].lower()
    return result

def check():
    problems = []
    system = entries_by_name(read('contracts/config/system-addresses.json')['assignments'], 'name')
    legacy = entries_by_name(read('config/system-addresses.json')['assignments'], 'name')
    deployment = entries_by_name(read('contracts/config/deployment-manifest.json')['contracts'], 'name')
    predeploy = entries_by_name(read('contracts/config/predeploy/predeploy-plan.json')['predeploys'], 'name')
    ai = {name: value.lower() for name, value in read('config/ai-genesis.json')['interfaces'].items()}
    canonical = read('contracts/config/genesis-canonical-addresses.json')
    fixed = {value: name for name, value in system.items()}
    if system != legacy:
        problems.append('two frozen system-address registries differ')
    for name, addr in system.items():
        for label, source in [('deployment', deployment), ('predeploy', predeploy)]:
            if source.get(name) != addr:
                problems.append(f'{label}: {name} must remain {addr}, not {source.get(name)}')
    for name, addr in ai.items():
        if system.get(name) != addr:
            problems.append(f'AI interface {name} does not match frozen system address {system.get(name)}')
    for entry in canonical['anchors']:
        name = entry['contract'].removesuffix('.sol')
        addr = entry['address'].lower()
        frozen_owner = fixed.get(addr)
        if frozen_owner and frozen_owner != name:
            problems.append(f'canonical {name} at {addr} collides with frozen {frozen_owner}')
    for name, addr in ai.items():
        for entry in canonical['anchors']:
            if entry['address'].lower() == addr and entry['contract'].removesuffix('.sol') != name:
                problems.append(f'AI {name} address {addr} is also assigned to canonical {entry["contract"]}')
    return sorted(set(problems))

if __name__ == '__main__':
    try:
        failures = check()
    except (OSError, ValueError, KeyError, TypeError) as exc:
        failures = [f'cannot validate Genesis addresses: {exc}']
    print(json.dumps({'pass': not failures, 'errors': failures}, indent=2))
    sys.exit(1 if failures else 0)
