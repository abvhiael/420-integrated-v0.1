#!/usr/bin/env python3
"""EXP-0.1.2 pinned-source reconciliation: Explorer 13 reads vs Indexer routes.

This proves only source-level inventory consistency. It does not qualify live
Indexer deployment, contracts, consensus correctness or a production endpoint.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PINNED_COMMIT = '95a83a961286701b6e8c064de1deccad10f41fd7'
CLIENT = ROOT / 'explorer/indexerclient'
SERVICE = ROOT / 'explorer/service'
INDEXER_SERVER = ROOT / 'indexer/api/server.go'
GENESIS = ROOT / 'contracts/config/420explorer-genesis.json'

# method -> (owning client file, Indexer endpoint, corresponding service boundary)
READS = {
    'Health': ('client.go', '/v1/health', 'IndexerReader'),
    'Blocks': ('client.go', '/v1/blocks', 'IndexerReader'),
    'Block': ('client.go', '/v1/blocks/{number}', 'IndexerReader'),
    'Transaction': ('client.go', '/v1/transactions/{hash}', 'IndexerReader'),
    'Receipt': ('client.go', '/v1/receipts/{hash}', 'IndexerReader'),
    'BlockLogs': ('client.go', '/v1/blocks/{number}/logs', 'IndexerReader'),
    'ServiceVersion': ('client.go', '/v1/services/{service}/versions/{version}', 'IndexerReader'),
    'AddressTransactions': ('address.go', '/v1/transactions', 'addressIndexerReader'),
    'AssetTransfers': ('assets.go', '/v1/asset-transfers', 'assetIndexerReader'),
    'Contract': ('contract.go', '/v1/contracts/{address}', 'contractReader'),
    'Consensus': ('consensus.go', '/v1/consensus', 'consensusIndexerReader'),
    'Services': ('registry.go', '/v1/services', 'registryIndexerReader'),
    'Service': ('registry.go', '/v1/services/{service}', 'registryIndexerReader'),
}

SERVICE_FILES = {
    'IndexerReader': 'service.go',
    'addressIndexerReader': 'addressviews.go',
    'assetIndexerReader': 'assetviews.go',
    'contractReader': 'contractviews.go',
    'consensusIndexerReader': 'consensusviews.go',
    'registryIndexerReader': 'registryviews.go',
}


def main() -> None:
    errors: list[str] = []
    server = INDEXER_SERVER.read_text()
    genesis = json.loads(GENESIS.read_text())
    files = {name: (CLIENT / name).read_text() for name in {item[0] for item in READS.values()}}
    # Never silently omit a newly introduced production client file or method.
    existing = {p.name for p in CLIENT.glob('*.go') if not p.name.endswith('_test.go')}
    if existing != set(files):
        errors.append(f'client file inventory drift: {sorted(existing ^ set(files))}')
    found_methods: set[str] = set()
    for name, text in files.items():
        found_methods.update(re.findall(r'func\s+\(c\s+\*Client\)\s+(\w+)\s*\(', text))
        if 'http.MethodPost' in text or 'http.MethodPut' in text or 'http.MethodDelete' in text:
            errors.append(f'{name}: mutating HTTP method found')
    # Constructor and generic get are not indexed resource reads.
    unexpected = found_methods - set(READS) - {'get'}
    if unexpected:
        errors.append(f'new client read/operation needs mapping: {sorted(unexpected)}')
    missing = set(READS) - found_methods
    if missing:
        errors.append(f'missing client methods: {sorted(missing)}')
    for method, (client_file, route, interface) in READS.items():
        text = files[client_file]
        if re.search(r'func\s+\(c\s+\*Client\)\s+' + method + r'\s*\(', text) is None:
            errors.append(f'{client_file}: missing {method}')
        if f'mux.HandleFunc("GET {route}"' not in server:
            errors.append(f'Indexer GET route registration missing: {route}')
        service_text = (SERVICE / SERVICE_FILES[interface]).read_text()
        if f'type {interface} interface' not in service_text:
            errors.append(f'missing interface {interface}')
        if re.search(r'\b' + method + r'\s*\(', service_text) is None:
            errors.append(f'{interface} missing {method}')
    if len(READS) != 13 or sum(v[2] == 'IndexerReader' for v in READS.values()) != 7:
        errors.append('must account for 7 core and 6 additional reads')
    required = set(genesis.get('indexerConsumer', {}).get('requiredEndpoints', []))
    if not required.issubset({v[1] for v in READS.values()}):
        errors.append(f'Genesis required routes not in actual client: {sorted(required - {v[1] for v in READS.values()})}')
    forbidden = (
        'github.com/420integrated/420-integrated/indexer/ingest',
        'github.com/420integrated/420-integrated/indexer/reorg',
        'github.com/420integrated/420-integrated/indexer/rpc',
        'github.com/420integrated/420-integrated/indexer/store',
    )
    for folder in ('explorer/cmd', 'explorer/indexerclient', 'explorer/service', 'explorer/api'):
        for path in (ROOT / folder).rglob('*.go'):
            if path.name.endswith('_test.go'):
                continue
            source = path.read_text()
            for import_path in forbidden:
                if '"' + import_path + '"' in source:
                    errors.append(f'forbidden direct Indexer infrastructure import: {path.relative_to(ROOT)} {import_path}')
    output = {
        'milestone': 'EXP-0.1.2', 'audited_commit': PINNED_COMMIT,
        'client_reads': len(READS), 'core_reader_methods': 7,
        'additional_capability_methods': 6, 'route_matches': len(READS) if not errors else None,
        'source_level_accounting_pass': not errors,
        'runtime_or_testnet_qualified': False, 'errors': errors,
    }
    print(json.dumps(output, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
