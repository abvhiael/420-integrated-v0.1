#!/usr/bin/env python3
"""Verify that frozen map, predeploy plan, deployment record and candidate inventories never disagree."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def load(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))
def norm(value):
    if not isinstance(value, str) or len(value) != 42 or not value.startswith('0x'):
        raise ValueError(f'invalid EVM address {value!r}')
    int(value[2:],16)
    return value.lower()
def verify():
    errors=[]
    system=load('contracts/config/system-addresses.json')
    plan=load('contracts/config/predeploy/predeploy-plan.json')
    deployment=load('contracts/config/deployment-manifest.json')
    canonical=load('contracts/config/genesis-canonical-addresses.json')
    bridge=load('config/swap-bridge-extension-addresses.json')
    wallet=load('wallet/deployment-inventory.json')
    archived=load('contracts/config/w14-7-4-global-address-reconciliation.json')
    frozen={x['name']:norm(x['address']) for x in system['assignments']}
    if len(frozen)!=len(system['assignments']): errors.append('duplicate frozen system name')
    for label, entries in (('predeploy-plan',plan['predeploys']),('deployment-manifest',deployment['contracts'])):
        actual={x['name']:norm(x['address']) for x in entries}
        if len(actual)!=len(entries): errors.append(f'{label}: duplicate names')
        for name, address in frozen.items():
            if actual.get(name)!=address: errors.append(f'{label}: frozen {name} must retain {address}; got {actual.get(name)}')
        for name, address in actual.items():
            if name not in frozen: errors.append(f'{label}: {name}@{address} lacks frozen system allocation')
    if plan.get('status') != 'FROZEN_ADDRESS_MAP_ARTIFACTS_PENDING':
        errors.append('predeploy plan status must remain artifacts pending; no deployment implied')
    fixed_by_name={x['contract'].removesuffix('.sol'):norm(x['address']) for x in canonical['anchors']}
    for name, address in fixed_by_name.items():
        if frozen.get(name)!=address: errors.append(f'canonical fixed {name}@{address} not in authoritative predeploy map')
    active=set(frozen.values())
    active.update(norm(x['address']) for x in bridge['assignments'])
    active.update(norm(x['address']) for x in canonical['reserved'] if x['status']!='RETIRED_NOT_DEPLOYABLE')
    for key in ('smartAccountFactory420','capabilityRegistry420'):
        claim=wallet['walletAuthority'][key]
        if claim.get('address') is not None or claim.get('deploymentVerified') is not False:
            errors.append(f'{key}: unverified candidate published as deployed')
        proposed=norm(claim['candidateAddress'])
        if proposed in active: errors.append(f'{key}: candidate collides at {proposed}')
        active.add(proposed)
    retired={norm(x['address']) for x in bridge.get('retired', [])}
    retired.update(norm(x['address']) for x in canonical.get('reserved',[]) if x['status']=='RETIRED_NOT_DEPLOYABLE')
    if active & retired: errors.append(f'active allocation reuses retired slot(s): {sorted(active & retired)}')
    # The old W14.7.4 artifact is a proposal for moving frozen system owners and
    # cannot be silently treated as an approved current address source.
    if archived.get('status') == 'FROZEN_FOR_GENESIS' or archived.get('policy',{}).get('walletReadyForLiveTestnet') is True:
        errors.append('obsolete W14.7.4 migration artifact promoted to authority')
    moving={x['name']:x['to'] for x in archived.get('migratedExistingPredeploys',[])}
    for name, target in moving.items():
        if name in frozen and norm(target)!=frozen[name] and norm(target) in active:
            errors.append(f'active slot {target} duplicates historical W14.7.4 relocation for {name}')
    if bridge.get('unallocated') != [{'name':'BridgeAssetRegistry','status':'PENDING_GLOBAL_COLLISION_INVENTORY_NOT_DEPLOYED','reason':'No safe new fixed address established; 0x045e is claimed by a separate obsolete W14.7.4 candidate and must not be silently reused. Registry-resolved deployment remains possible after verification and governance publication.'}]:
        errors.append('BridgeAssetRegistry must remain explicitly unallocated until global inventory is approved')
    return sorted(set(errors))
if __name__=='__main__':
    try: errors=verify()
    except (OSError,KeyError,TypeError,ValueError) as exc: errors=[f'predeploy namespace validation blocked: {exc}']
    print(json.dumps({'pass':not errors,'errors':errors},indent=2))
    sys.exit(bool(errors))
