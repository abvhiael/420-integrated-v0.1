#!/usr/bin/env python3
"""Fail closed on the CURRENT Step 6.2 fixed/registry-resolved address boundary.

An archived W14.7.4 proposal is not a live migration. This validator checks
actual system, canonical, predeploy, deployment, bridge and Wallet manifests;
passing does NOT attest runtime bytecode, network deployment or approval.
"""
import json
import pathlib
import sys
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCES = {
    'canonical': 'contracts/config/genesis-canonical-addresses.json',
    'system': 'config/system-addresses.json',
    'system_mirror': 'contracts/config/system-addresses.json',
    'bridge': 'config/swap-bridge-extension-addresses.json',
    'predeploy': 'contracts/config/predeploy/predeploy-plan.json',
    'deployment': 'contracts/config/deployment-manifest.json',
    'wallet': 'wallet/deployment-inventory.json',
}
WALLET_IDS = {'protocolRegistry': 'protocol-registry', 'names420': 'names', 'identity420': 'identity'}
REGISTRY_WALLET_IDS = {'smartAccountFactory420': 'smart-account-factory',
                       'capabilityRegistry420': 'capability-registry'}
FROZEN = {0x420: 'RewardController', 0x421: 'AttentionTreasury',
          0x422: 'DevelopmentTreasury', 0x423: 'ValidatorRegistry',
          0x424: 'ProtocolReserve', 0x42f: 'AIProviderRegistry',
          0x430: 'AIModelRegistry', 0x431: 'AIJobManager',
          0x432: 'AIJobEscrow', 0x433: 'AIReputationRegistry',
          0x434: 'ProtocolRegistry', 0x435: 'Names420',
          0x436: 'Identity420', 0x43c: 'ConsensusSystemCall420'}


def normalize(value):
    if not isinstance(value, str) or len(value) != 42 or not value.startswith('0x'):
        raise ValueError('invalid EVM address: %r' % value)
    int(value[2:], 16)
    return value.lower()


def load(root):
    return {name: json.loads((root / path).read_text(encoding='utf-8'))
            for name, path in SOURCES.items()}


def validate(docs):
    errors = []
    claims = defaultdict(list)
    system_entries = docs['system']['assignments']
    system = {entry['name']: normalize(entry['address']) for entry in system_entries}
    if len(system) != len(system_entries):
        errors.append('duplicate frozen system identity')
    fixed = set(system.values())
    if len(fixed) != len(system):
        errors.append('duplicate address in frozen system')
    for slot, identity in FROZEN.items():
        if system.get(identity) != '0x' + format(slot, '040x'):
            errors.append('frozen slot 0x%x must retain %s' % (slot, identity))
    for label in ('system_mirror', 'predeploy', 'deployment'):
        field = {'system_mirror': 'assignments', 'predeploy': 'predeploys',
                 'deployment': 'contracts'}[label]
        entries = docs[label][field]
        actual = {entry['name']: normalize(entry['address']) for entry in entries}
        if len(actual) != len(entries) or actual != system:
            errors.append('%s does not exactly match frozen system allocation' % label)
    anchors = {}
    canonical = docs['canonical']
    for entry in canonical['anchors']:
        ident, name, slot = entry['id'], entry['contract'].removesuffix('.sol'), normalize(entry['address'])
        if ident in anchors:
            errors.append('duplicate canonical id: ' + ident)
        anchors[ident] = (name, slot)
        if system.get(name) != slot:
            errors.append('canonical fixed anchor disagrees with frozen system: %s@%s' % (name, slot))
        claims[slot].append(('canonical', name))
    registry = {}
    for entry in canonical.get('registry_resolved', []):
        ident, name = entry['id'], entry['contract'].removesuffix('.sol')
        if ident in registry or ident in anchors:
            errors.append('duplicate canonical/registry identity: ' + ident)
        registry[ident] = name
        if name in system or entry.get('address') is not None or entry.get('candidate') is not None:
            errors.append('registry-resolved contract claims fixed/candidate slot: ' + name)
    bridge_entries = docs['bridge']['assignments']
    seen_bridge = set()
    for entry in bridge_entries:
        name, slot = entry['name'], normalize(entry['address'])
        if name in seen_bridge or slot in fixed or slot in claims:
            errors.append('address collision or duplicate bridge candidate: %s@%s' % (name, slot))
        seen_bridge.add(name)
        claims[slot].append(('bridge-candidate', name))
    reserved = canonical.get('reserved', [])
    retired = set()
    for entry in reserved:
        slot = normalize(entry['address'])
        if entry.get('status') == 'RETIRED_NOT_DEPLOYABLE':
            retired.add(slot)
        elif slot in fixed or slot in claims:
            errors.append('address collision: active reservation %s' % slot)
        else:
            claims[slot].append(('reservation', entry['id']))
    for entry in docs['bridge'].get('retired', []):
        # A retired *proposal* may overlap the frozen owner without retiring
        # the frozen address itself. Its contract must not be active there.
        slot = normalize(entry['address'])
        if any(name == entry['name'] for _, name in claims[slot]):
            errors.append('retired bridge proposal is still active: %s@%s' % (entry['name'], slot))
    for slot in retired:
        if slot in fixed or slot in claims:
            errors.append('retired slot reused: ' + slot)
    authority = docs['wallet']['walletAuthority']
    for wallet_id, anchor_id in WALLET_IDS.items():
        name, slot = anchors.get(anchor_id, (None, None))
        if name is None or normalize(authority[wallet_id]['address']) != slot:
            errors.append('wallet frozen reference drift: ' + wallet_id)
        elif authority[wallet_id].get('deploymentVerified') is not False:
            errors.append('unverified frozen wallet reference promoted: ' + wallet_id)
    for wallet_id, registry_id in REGISTRY_WALLET_IDS.items():
        item = authority[wallet_id]
        if registry_id not in registry or item.get('address') is not None or item.get('deploymentVerified') is not False:
            errors.append('unverified registry-resolved wallet contract published: ' + wallet_id)
        proposed = normalize(item['candidateAddress'])
        if proposed in fixed or proposed in claims or proposed in retired:
            errors.append('wallet candidate address collision: %s@%s' % (wallet_id, proposed))
        claims[proposed].append(('wallet-unapproved-candidate', wallet_id))
    if docs['wallet'].get('readyForLiveTestnet') is not False:
        errors.append('Wallet must remain fail-closed until live deployment attestation')
    if docs['wallet'].get('releaseGates', {}).get('canonicalAddressConflictResolved') is not False:
        errors.append('address-policy reconciliation alone must not lift on-chain Wallet release gate')
    return sorted(set(errors))


def main():
    try:
        errors = validate(load(ROOT))
    except (OSError, KeyError, ValueError, TypeError, json.JSONDecodeError) as exc:
        errors = [str(exc)]
    print(json.dumps({'pass': not errors, 'phase': 'W14.7.1',
                      'addressPolicyOnly': True, 'walletReadyForLiveTestnet': False,
                      'errorCount': len(errors), 'errors': errors}, indent=2))
    return int(bool(errors))


if __name__ == '__main__':
    sys.exit(main())
