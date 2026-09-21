#!/usr/bin/env python3
"""Validate the W14.7.4 proposed map. Never certifies the active namespace or deployment."""
import json
import pathlib
import sys
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
CANDIDATE = ROOT / 'contracts/config/w14-7-4-global-address-reconciliation.json'
ADDR = lambda n: '0x' + format(n, '04x')


def validate(data):
    errors = []
    names = defaultdict(set)
    owners = defaultdict(set)
    def claim(category, name, address):
        if not isinstance(address, str) or len(address) != 6 or not address.startswith('0x'):
            errors.append('invalid candidate address %s %r' % (name, address))
            return
        try:
            slot = int(address[2:], 16)
        except ValueError:
            errors.append('invalid candidate address %s %r' % (name, address))
            return
        if not 0x41f <= slot <= 0x4ff:
            errors.append('candidate outside reserved Genesis range: %s' % address)
        owners[address.lower()].add(name)
        names[name].add(address.lower())
    for name, address in data['preservedSystemAssignments']:
        claim('system', name, address)
    for entry in data['migratedExistingPredeploys']:
        claim('migrated', entry['name'], entry['to'])
    for ident, name, address in data['canonicalAuthorities']:
        claim('canonical:' + ident, name, address)
    for name, address in data['bridgeCandidates']:
        claim('bridge', name, address)
    for address, identities in owners.items():
        if len(identities) != 1:
            errors.append('collision at %s: %s' % (address, sorted(identities)))
    for name, addresses in names.items():
        if len(addresses) != 1:
            errors.append('multiple locations for %s: %s' % (name, sorted(addresses)))
    frozen = data['preservedSystemAssignments']
    if frozen != [] and {addr for _, addr in frozen} != {ADDR(n) for n in range(0x420, 0x434)} | {ADDR(0x43c)}:
        errors.append('economic and consensus frozen-slot coverage drift')
    if dict(frozen).get('ConsensusSystemCall420') != '0x043c':
        errors.append('consensus system-call gateway must remain at 0x043c')
    if dict((ident, addr) for ident, _, addr in data['canonicalAuthorities']).get('names') != '0x0445':
        errors.append('Names420 0x0445 reservation moved')
    migration = {x['name']: x for x in data['migratedExistingPredeploys']}
    if {x['from'] for x in migration.values()} != {ADDR(n) for n in range(0x434, 0x43c)}:
        errors.append('legacy application migration must account for all eight 0x0434..0x043b assignments')
    for name, entry in migration.items():
        if names[name] != {entry['to']}:
            errors.append('migration destination mismatch: ' + name)
    if {x[0] for x in data['canonicalAuthorities']} != {
        'smart-account-factory','capability-registry','protocol-registry','names','identity',
        'interop-router','randomness-router','oracle-router','swap-executor','bridge-gateway',
        'bridge-router','stake','governance','payment-router','settlement-router','token-factory',
        'ai-router','resource-router','compute-router','treasury-router','vault-router','rights-router',
        'launchpad-router','grants-router','attention-router','pulse-router','messenger-router',
        'commons-router'}:
        errors.append('missing or duplicate canonical authority IDs')
    if data.get('status') != 'CANDIDATE_REQUIRES_GLOBAL_MIGRATION_AND_APPROVAL_NOT_ACTIVE' or data.get('policy', {}).get('walletReadyForLiveTestnet') is not False:
        errors.append('candidate must remain non-authoritative and fail-closed')
    return errors


def main():
    try:
        errors = validate(json.loads(CANDIDATE.read_text(encoding='utf-8')))
    except (OSError, ValueError, KeyError, TypeError) as exc:
        errors = [str(exc)]
    print(json.dumps({'phase':'W14.7.4','candidateOnly':True,'pass':not errors,'errors':errors}, indent=2))
    return bool(errors)

if __name__ == '__main__':
    sys.exit(main())
