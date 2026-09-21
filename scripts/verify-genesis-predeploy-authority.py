#!/usr/bin/env python3
"""Verify frozen predeploy parity and quarantine historical, conflicting address proposals."""
import json
import re
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def load(path): return json.loads((ROOT/path).read_text(encoding='utf-8'))
def norm(value, historical=False):
    pattern=r'0x[0-9a-fA-F]{1,40}' if historical else r'0x[0-9a-fA-F]{40}'
    if not isinstance(value,str) or not re.fullmatch(pattern,value):
        raise ValueError(f'invalid EVM address {value!r}')
    return '0x'+format(int(value[2:],16),'040x')
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
    for label,entries in (('predeploy-plan',plan['predeploys']),('deployment-manifest',deployment['contracts'])):
        actual={x['name']:norm(x['address']) for x in entries}
        if len(actual)!=len(entries): errors.append(f'{label}: duplicate names')
        for name,address in frozen.items():
            if actual.get(name)!=address: errors.append(f'{label}: frozen {name} must retain {address}; got {actual.get(name)}')
        for name,address in actual.items():
            if name not in frozen: errors.append(f'{label}: {name}@{address} lacks frozen system allocation')
    if plan.get('status')!='FROZEN_ADDRESS_MAP_ARTIFACTS_PENDING':
        errors.append('predeploy plan must remain pending qualified artifacts and release verification')
    fixed_by_name={x['contract'].removesuffix('.sol'):norm(x['address']) for x in canonical['anchors']}
    for name,address in fixed_by_name.items():
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
    retired={norm(x['address']) for x in bridge.get('retired',[])}
    retired.update(norm(x['address']) for x in canonical.get('reserved',[]) if x['status']=='RETIRED_NOT_DEPLOYABLE')
    if active & retired: errors.append(f'active allocation reuses retired slot(s): {sorted(active & retired)}')
    if archived.get('status')=='FROZEN_FOR_GENESIS' or archived.get('policy',{}).get('walletReadyForLiveTestnet') is True:
        errors.append('obsolete W14.7.4 migration artifact promoted to authority')
    for item in archived.get('migratedExistingPredeploys',[]):
        name,target=item['name'],norm(item['to'],historical=True)
        if name in frozen and target!=frozen[name] and target in active:
            errors.append(f'active slot {target} duplicates historical W14.7.4 relocation for {name}')
    pending=[x for x in bridge.get('unallocated',[]) if x.get('name')=='BridgeAssetRegistry']
    if len(pending)!=1 or pending[0].get('status')!='PENDING_GLOBAL_COLLISION_INVENTORY_NOT_DEPLOYED' or 'address' in pending[0]:
        errors.append('BridgeAssetRegistry must remain explicitly unallocated until full global review')
    return sorted(set(errors))
if __name__=='__main__':
    try: failures=verify()
    except (OSError,KeyError,TypeError,ValueError) as exc: failures=[f'predeploy namespace validation blocked: {exc}']
    print(json.dumps({'pass':not failures,'errors':failures},indent=2))
    sys.exit(bool(failures))
