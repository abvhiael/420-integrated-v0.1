#!/usr/bin/env python3
"""EXP-0.1.3: source-level Explorer contract/ABI/address dependency inventory.

Reads the immutable audited Git tree, not mutable main or generated deployment state.
This check does not assert contract deployment, ABI publication, or live-testnet correctness.
"""
from __future__ import annotations
import json
import re
import subprocess
from pathlib import Path

PIN = '95a83a961286701b6e8c064de1deccad10f41fd7'
OUT = Path('exp-0-1-3-evidence')
SOURCE_SUFFIXES = ('.go', '.js', '.ts', '.tsx', '.jsx', '.sol')
DIRECT_ADDRESS = re.compile(r'0x[0-9a-fA-F]{40}\b')
REQUIRED = [
    'contracts/config/420explorer-genesis.json',
    'contracts/config/genesis-dapp-contract-map.json',
    'config/genesis-applications.json',
    'config/system-addresses.json',
    'contracts/config/system-addresses.json',
    'contracts/src/libraries/ServiceIds420.sol',
    'contracts/src/apps/ProtocolRegistry.sol',
    'indexer/decoder/catalog.go',
    'indexer/decoder/registry.go',
    'indexer/model/contract.go',
    'indexer/api/contracts.go',
    '420-indexer/src/abi-manifest.ts',
    'explorer/service/service.go',
    'explorer/service/contractviews.go',
    'explorer/service/registryviews.go',
    'explorer/indexerclient/contract.go',
    'explorer/indexerclient/registry.go',
    'explorer/web/static/app.js',
]

def git(*args: str) -> bytes:
    return subprocess.check_output(['git', *args], stderr=subprocess.PIPE)

def main() -> None:
    errors: list[str] = []
    raw = git('ls-tree', '-r', '-z', '--full-tree', PIN)
    tree: dict[str, str] = {}
    for entry in raw.split(b'\x00'):
        if not entry:
            continue
        head, path = entry.split(b'\t', 1)
        mode, typ, sha = head.decode().split()
        if typ == 'blob':
            p = path.decode('utf-8', 'surrogateescape')
            if p in tree:
                errors.append('duplicate tree path: ' + p)
            tree[p] = sha
    def read(path: str) -> str:
        if path not in tree:
            errors.append('missing audited source: ' + path)
            return ''
        return git('show', PIN + ':' + path).decode('utf-8', 'replace')
    sources = {p: read(p) for p in REQUIRED}
    genesis = json.loads(sources['contracts/config/420explorer-genesis.json'])
    apps = json.loads(sources['config/genesis-applications.json'])
    dapps = json.loads(sources['contracts/config/genesis-dapp-contract-map.json'])
    a = json.loads(sources['config/system-addresses.json'])
    b = json.loads(sources['contracts/config/system-addresses.json'])
    if a != b:
        errors.append('two pinned system-address authorities disagree')
    if genesis.get('name') != '420Explorer' or genesis.get('contractsRequired') is not False or genesis.get('canonicalStateAuthority') is not False:
        errors.append('Explorer genesis contract-free/noncanonical profile changed')
    if genesis.get('indexerConsumer', {}).get('independentProtocolDecoderRegistry') is not False:
        errors.append('Explorer no-independent-decoder invariant changed')
    application = next((x for x in apps.get('apps', []) if x.get('name') == '420 Explorer'), None)
    dapp = next((x for x in dapps.get('apps', []) if x.get('dapp') == '420 Explorer'), None)
    if not application or application.get('contracts_required') is not False:
        errors.append('Genesis application no-contract declaration missing')
    if not dapp or dapp.get('contracts') != []:
        errors.append('Genesis dApp contract map unexpectedly assigns Explorer contracts')
    assignments = a.get('assignments', [])
    by_name = {x['name']: x['address'].lower() for x in assignments}
    addr = [x['address'].lower() for x in assignments]
    if len(addr) != len(set(addr)):
        errors.append('duplicate frozen address assignments')
    expected_registry = '0x' + '0' * 36 + '0434'
    expected_consensus = '0x' + '0' * 36 + '043c'
    if by_name.get('ProtocolRegistry') != expected_registry:
        errors.append('frozen ProtocolRegistry address changed')
    if by_name.get('ConsensusSystemCall420') != expected_consensus:
        errors.append('frozen consensus gateway address changed')
    if any('explorer' in x['name'].lower() for x in assignments):
        errors.append('Explorer appears as a frozen system contract; reconcile ownership')
    if not re.search(r'\bEXPLORER\s*=\s*keccak256\("420/service/explorer/v1"\)', sources['contracts/src/libraries/ServiceIds420.sol']):
        errors.append('Explorer service ID declaration changed')
    contract = sources['contracts/src/apps/ProtocolRegistry.sol']
    for event in ('ServiceVersionPublished', 'ServiceRegistrationProfilePublished', 'ServiceDeprecated'):
        if 'event ' + event + '(' not in contract:
            errors.append('ProtocolRegistry event missing: ' + event)
    if 'contract ProtocolRegistry ' not in contract:
        errors.append('ProtocolRegistry declaration missing')
    if 'interface{}' in sources['explorer/service/contractviews.go']:
        errors.append('unexpected contract-detail schema change')
    explorer_files = sorted(p for p in tree if p.startswith('explorer/'))
    explorer_production = [p for p in explorer_files if p.endswith(SOURCE_SUFFIXES) and not p.endswith(('_test.go', '.test.js', '.spec.js', '.test.ts', '.spec.ts'))]
    address_mentions = []
    abi_mentions = []
    for p in explorer_production:
        text = read(p)
        for match in DIRECT_ADDRESS.finditer(text):
            address_mentions.append({'path': p, 'blob_sha': tree[p], 'line': text.count('\n', 0, match.start()) + 1, 'address': match.group(0).lower()})
        for no, line in enumerate(text.splitlines(), 1):
            if re.search(r'\babi\b|\.sol\b|contracts/out/|eth_getCode|eth_getLogs|eth_call', line, re.I):
                abi_mentions.append({'path': p, 'blob_sha': tree[p], 'line': no, 'excerpt': line[:220]})
        if p.startswith('explorer/') and p.endswith('.sol'):
            errors.append('Explorer-owned Solidity file requires inventory review: ' + p)
    # Detect newly introduced hard-coded execution addresses in production; display-only
    # zero-address literals must be reviewed rather than silently blessed by the verifier.
    if address_mentions:
        errors.append('full-length hard-coded EVM address(es) in Explorer production; review address-mentions.json')
    if any(p.startswith('contracts/src/') and re.search(r'(^|/)(?:420)?Explorer(?:420)?\.sol$', p, re.I) for p in tree):
        errors.append('Explorer-named contract exists; reconcile contract-free ownership')
    # These paths are intentionally NOT required Explorer inputs; record availability
    # without converting an absent generated ABI into a claim of successful verification.
    optional = ['contracts/out/ProtocolRegistry.sol/ProtocolRegistry.json', 'contracts/src/interfaces/IProtocolRegistry.sol']
    out = {
        'milestone': 'EXP-0.1.3', 'audited_commit': PIN,
        'tree_blob_count': len(tree),
        'explorer_tracked_files': len(explorer_files),
        'explorer_production_source_files': len(explorer_production),
        'explorer_contracts_required': False,
        'frozen_protocol_registry': by_name.get('ProtocolRegistry'),
        'frozen_consensus_gateway': by_name.get('ConsensusSystemCall420'),
        'generated_protocol_registry_abi_and_interface_present': {p: p in tree for p in optional},
        'source_level_accounting_pass': not errors,
        'live_abi_or_deployment_qualified': False,
        'errors': errors,
    }
    OUT.mkdir(exist_ok=True)
    (OUT / 'summary.json').write_text(json.dumps(out, indent=2) + '\n')
    (OUT / 'address-mentions.json').write_text(json.dumps(address_mentions, indent=2) + '\n')
    (OUT / 'abi-mentions.json').write_text(json.dumps(abi_mentions, indent=2) + '\n')
    (OUT / 'source-blob-shas.tsv').write_text('classification\tpath\tgit_blob_sha\n' + ''.join(
        ('Explorer-owned' if p.startswith('explorer/') else 'shared') + '\t' + p + '\t' + tree[p] + '\n'
        for p in sorted(set(explorer_files) | set(REQUIRED) | set(optional) & set(tree))
    ))
    print(json.dumps(out, indent=2))
    if errors:
        raise SystemExit(1)

if __name__ == '__main__':
    main()
