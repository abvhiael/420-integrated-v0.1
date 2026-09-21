#!/usr/bin/env python3
"""Fail closed when a proposed Genesis address conflicts with frozen Step 6.2 owners."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def load(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))

def address(value):
    if not isinstance(value, str) or len(value) != 42 or not value.startswith('0x'):
        raise ValueError(f'invalid address: {value!r}')
    int(value[2:], 16)
    return value.lower()

def verify():
    errors = []
    system = load('contracts/config/system-addresses.json')
    mirrored = load('config/system-addresses.json')
    canonical = load('contracts/config/genesis-canonical-addresses.json')
    bridge = load('config/swap-bridge-extension-addresses.json')
    wallet = load('wallet/deployment-inventory.json')
    dapps = load('contracts/config/genesis-dapp-contract-map.json')
    if system != mirrored:
        errors.append('contracts/config and config frozen system maps differ')
    if system.get('status') != 'FROZEN_STEP6_2' or canonical.get('status') != 'FROZEN_FOR_GENESIS':
        errors.append('unexpected frozen map or canonical classification')
    if canonical.get('authoritative_predeploy_map') != 'contracts/config/system-addresses.json':
        errors.append('canonical record must reference frozen predeploy map')
    frozen_by_address = {}
    frozen_by_name = {}
    for entry in system['assignments']:
        name, slot = entry['name'], address(entry['address'])
        if slot in frozen_by_address or name in frozen_by_name:
            errors.append(f'duplicate frozen assignment: {name}@{slot}')
        frozen_by_address[slot], frozen_by_name[name] = name, slot
    if frozen_by_name.get('ConsensusSystemCall420') != address('0x043c'.replace('0x','0x' + '0'*36)):
        errors.append('ConsensusSystemCall420 must retain frozen 0x043c')
    if frozen_by_name.get('ProtocolRegistry') != '0x' + '0'*36 + '0434':
        errors.append('ProtocolRegistry must retain frozen 0x0434')
    if frozen_by_name.get('Names420') != '0x' + '0'*36 + '0435':
        errors.append('Names420 must retain frozen 0x0435')
    if frozen_by_name.get('Identity420') != '0x' + '0'*36 + '0436':
        errors.append('Identity420 must retain frozen 0x0436')
    mapped = {file for app in dapps['apps'] for file in app.get('contracts', [])}
    seen = set()
    anchors_by_name = {}
    for item in canonical['anchors']:
        name = item['contract'].removesuffix('.sol')
        slot = address(item['address'])
        if slot in seen or name in anchors_by_name:
            errors.append(f'duplicate canonical anchor: {name}@{slot}')
        seen.add(slot)
        anchors_by_name[name] = slot
        if frozen_by_name.get(name) != slot:
            errors.append(f'canonical fixed anchor {name}@{slot} conflicts with frozen Step 6.2 owner')
        if item['contract'] not in mapped:
            errors.append(f'canonical anchor missing from Genesis contract map: {item["contract"]}')
    if anchors_by_name.get('ProtocolRegistry') != frozen_by_name.get('ProtocolRegistry'):
        errors.append('canonical ProtocolRegistry anchor missing or invalid')
    if anchors_by_name.get('Names420') != frozen_by_name.get('Names420'):
        errors.append('canonical Names420 anchor missing or invalid')
    claimed = dict(frozen_by_address)
    for item in canonical.get('registry_resolved', []):
        name = item['contract'].removesuffix('.sol')
        if 'address' in item or name in frozen_by_name:
            errors.append(f'registry-resolved {name} cannot assert a fixed predeploy')
        if item['contract'] not in mapped:
            errors.append(f'registry-resolved app missing from Genesis contract map: {name}')
    retired = set()
    for item in canonical.get('reserved', []):
        slot = address(item['address'])
        if item.get('status') == 'RETIRED_NOT_DEPLOYABLE':
            retired.add(slot)
        elif slot in claimed:
            errors.append(f'canonical reservation {item["id"]} overlaps {claimed[slot]}')
        else:
            claimed[slot] = 'reserved:' + item['id']
    if address('0x' + '0'*36 + '041f') not in claimed:
        errors.append('EntryPoint reservation 0x041f missing')
    for item in bridge['assignments']:
        slot, name = address(item['address']), item['name']
        if slot in claimed or slot in retired:
            errors.append(f'bridge candidate {name}@{slot} overlaps {claimed.get(slot, "retired reservation")}')
        else:
            claimed[slot] = name
        if name == 'GatewayRouter420':
            errors.append('registry-resolved GatewayRouter420 cannot claim a fixed bridge candidate')
    retired_bridge = {(item['name'], address(item['address'])) for item in bridge.get('retired', [])}
    if ('BridgeAssetRegistry','0x' + '0'*36 + '043c') not in retired_bridge:
        errors.append('historical 0x043c BridgeAssetRegistry collision must be retired explicitly')
    if ('GatewayRouter420','0x' + '0'*36 + '0443') not in retired_bridge:
        errors.append('historical 0x0443 duplicate bridge router proposal must be retired explicitly')
    authority = wallet.get('walletAuthority', {})
    expected = {'protocolRegistry':'ProtocolRegistry','names420':'Names420','identity420':'Identity420'}
    for key, owner in expected.items():
        value = authority.get(key, {})
        if address(value.get('address')) != frozen_by_name.get(owner):
            errors.append(f'Wallet {key} must reference frozen {owner} owner')
        if value.get('deploymentVerified') is True and not wallet.get('releaseGates', {}).get('canonicalWalletContractsHaveCode'):
            errors.append(f'Wallet {key} claims verified deployment without release gate')
    for key in ('smartAccountFactory420','capabilityRegistry420'):
        value = authority.get(key, {})
        if value.get('address') is not None:
            errors.append(f'Wallet {key} must not expose unverified runtime address')
        candidate = value.get('candidateAddress')
        if candidate is not None:
            slot = address(candidate)
            if slot in claimed or slot in retired:
                errors.append(f'Wallet {key} candidate {slot} collides with {claimed.get(slot,"retired reservation")}')
            else:
                claimed[slot] = key
    if wallet.get('readyForLiveTestnet') is not False:
        errors.append('Wallet may not be released without deployment and network qualification')
    return sorted(set(errors))

if __name__ == '__main__':
    try:
        failures = verify()
    except (OSError, KeyError, ValueError, TypeError) as exc:
        failures = [f'address validation error: {exc}']
    print(json.dumps({'pass': not failures, 'errors': failures}, indent=2))
    sys.exit(bool(failures))
