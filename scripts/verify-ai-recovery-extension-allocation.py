#!/usr/bin/env python3
"""Fail closed on overlapping Genesis system, bridge, Wallet and extension claims."""
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def load(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))
def addr(value):
    if not isinstance(value, str) or len(value) != 42 or not value.startswith('0x'):
        raise ValueError(f'invalid address {value!r}')
    int(value[2:], 16)
    return value.lower()
def verify():
    errors=[]
    system=load('contracts/config/system-addresses.json')
    canonical=load('contracts/config/genesis-canonical-addresses.json')
    bridge=load('config/swap-bridge-extension-addresses.json')
    wallet=load('contracts/config/wallet-authority-address-reconciliation.json')
    extension=load('contracts/config/ai-recovery-genesis-extension-allocation.json')
    occupied={}
    owners={}
    def claim(address, owner, source, same_owner=False):
        address=addr(address)
        if address in occupied and not (same_owner and occupied[address][0]==owner):
            errors.append(f'{source}: {owner}@{address} overlaps {occupied[address]}')
        else:
            occupied[address]=(owner,source)
        if owner in owners and owners[owner][0]!=address and not owner.startswith('RETIRED:'):
            errors.append(f'{source}: duplicate candidate owner {owner}: {address} vs {owners[owner][0]}')
        else:
            owners[owner]=(address,source)
    frozen={}
    for item in system['assignments']:
        frozen[item['name']]=addr(item['address'])
        claim(item['address'],item['name'],'frozen system')
    for item in canonical['anchors']:
        name=item['contract'].removesuffix('.sol')
        if frozen.get(name)!=addr(item['address']):
            errors.append(f'canonical anchor {name} disagrees with frozen system allocation')
        claim(item['address'],name,'canonical anchor',same_owner=True)
    for item in canonical.get('registry_resolved',[]):
        name=item['contract'].removesuffix('.sol')
        if name in frozen or item.get('address') is not None:
            errors.append(f'registry-resolved {name} claims frozen slot or fixed address')
    for item in canonical.get('reserved',[]):
        claim(item['address'],'RETIRED:'+item['id'] if item.get('status')=='RETIRED_NOT_DEPLOYABLE' else 'RESERVED:'+item['id'],'canonical reservation')
    for item in bridge['assignments']:
        claim(item['address'],item['name'],'bridge candidate')
    for item in wallet['walletAuthorityCandidates']:
        claim(item['candidateAddress'],item['contract'].removesuffix('.sol'),'Wallet candidate')
    for item in wallet.get('frozenAuthorityReferences',[]):
        name=item['contract'].removesuffix('.sol')
        if frozen.get(name)!=addr(item['address']):
            errors.append(f'Wallet frozen reference mismatch: {name}')
    proposed=extension['proposals']
    start=int(addr(extension['candidate_extension_start']),16)
    if not proposed: errors.append('no extension candidates')
    for offset,item in enumerate(proposed):
        if int(addr(item['address']),16)!=start+offset:
            errors.append(f'noncontiguous extension allocation: {item["contract"]}')
        claim(item['address'],item['contract'].removesuffix('.sol'),'extension proposal')
    if extension['genesis_approval']['approved'] is not False or not extension['status'].startswith('CANDIDATE_'):
        errors.append('extension must remain unapproved until network/governance evidence')
    return sorted(set(errors))
if __name__=='__main__':
    try: failures=verify()
    except (OSError,KeyError,ValueError,TypeError) as exc: failures=[f'validation error: {exc}']
    print(json.dumps({'pass':not failures,'errors':failures},indent=2))
    sys.exit(bool(failures))
