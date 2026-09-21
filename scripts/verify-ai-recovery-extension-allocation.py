#!/usr/bin/env python3
"""Check candidate extension reservations; does not approve Genesis or attest deployment."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def load(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))

def normalized(value):
    if not isinstance(value, str) or len(value) != 42 or not value.startswith('0x'):
        raise ValueError(f'invalid EVM address: {value!r}')
    int(value[2:], 16)
    return value.lower()

def verify():
    issues = []
    proposal = load('contracts/config/ai-recovery-genesis-extension-allocation.json')
    system = load('contracts/config/system-addresses.json')
    bridge = load('config/swap-bridge-extension-addresses.json')
    canonical = load('contracts/config/genesis-canonical-addresses.json')
    wallet = load('contracts/config/wallet-authority-address-reconciliation.json')
    occupied = {}
    def reserve(address, owner, source, allow_same_owner=False):
        address = normalized(address)
        if address in occupied and not (allow_same_owner and occupied[address][0] == owner):
            issues.append(f'{source}: {owner} at {address} overlaps {occupied[address][0]} ({occupied[address][1]})')
        else:
            occupied[address] = (owner, source)
    for item in system['assignments']:
        reserve(item['address'], item['name'], 'frozen system map')
    for item in bridge['assignments']:
        reserve(item['address'], item['name'], 'bridge candidate map')
    for item in canonical.get('anchors', []):
        if item.get('id') == 'names':
            reserve(item['address'], 'Names420', 'Names reservation', allow_same_owner=True)
    for item in wallet.get('walletAuthorityCandidates', []):
        reserve(item['candidateAddress'], item['contract'], 'Wallet candidate map')
    proposed = proposal.get('proposals', [])
    if not proposed:
        issues.append('extension has no proposals')
    expected_start = int(normalized(proposal['candidate_extension_start']), 16)
    for offset, item in enumerate(proposed):
        address = normalized(item['address'])
        if int(address, 16) != expected_start + offset:
            issues.append(f'noncontiguous candidate allocation: {item["contract"]} at {address}')
        reserve(address, item['contract'], 'AI extension proposal')
    if proposal['status'] != 'CANDIDATE_PENDING_NAMESPACE_WIDE_VALIDATION_AND_GENESIS_APPROVAL':
        issues.append('do not prematurely promote candidate extension status')
    if proposal['genesis_approval']['approved'] is not False:
        issues.append('Genesis approval requires separate documented governance and complete integration')
    return sorted(set(issues))

if __name__ == '__main__':
    try:
        failures = verify()
    except (KeyError, ValueError, TypeError, OSError) as exc:
        failures = [f'allocation validation cannot complete: {exc}']
    print(json.dumps({'pass': not failures, 'errors': failures}, indent=2))
    sys.exit(1 if failures else 0)
