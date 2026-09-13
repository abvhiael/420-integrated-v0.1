#!/usr/bin/env python3
"""Validate DOC-17 Wallet integration and chained runtime documentation consumers."""
from __future__ import annotations
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / 'docs/contextual/contextual-link-registry.json'
TARGET = ROOT / 'docs/publication/production-target.json'
BUNDLE = ROOT / 'wallet/web/docs-context.json'
RESOLVER = ROOT / 'wallet/web/core/docs-help.js'
TEST = ROOT / 'wallet/web/test/docs-help.test.js'


def load(path: Path) -> dict:
    value = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(value, dict):
        raise ValueError(f'{path} must contain an object')
    return value


def main() -> int:
    errors: list[str] = []
    try:
        registry = load(REGISTRY)
        target = load(TARGET)
        bundle = load(BUNDLE)
    except Exception as exc:
        print(f'420Docs Wallet integration FAILED: {exc}', file=sys.stderr)
        return 1

    wallet_records = {
        key: value for key, value in registry.get('records', {}).items()
        if key.startswith('CTX-WALLET-')
    }
    expected = {
        key: value.get('target', {}).get('path')
        for key, value in wallet_records.items()
        if isinstance(value, dict) and value.get('status') == 'active'
    }
    if bundle.get('records') != expected:
        errors.append('wallet docs-context records differ from authoritative DOC-14 Wallet records')
    if bundle.get('canonical_base_url') != target.get('canonical_base_url'):
        errors.append('wallet canonical base URL differs from production target')
    if sorted(bundle.get('published_environments', [])) != sorted(target.get('published_environments', [])):
        errors.append('wallet published environments differ from production target')
    if bundle.get('cross_environment_fallback') is not False:
        errors.append('wallet cross-environment fallback must be false')
    if bundle.get('cross_release_fallback') is not False:
        errors.append('wallet cross-release fallback must be false')

    for contextual_id, record in wallet_records.items():
        if sorted(record.get('environments', [])) != sorted(bundle.get('published_environments', [])):
            errors.append(f'{contextual_id} environment scope differs from Wallet publication bundle')
        path = record.get('target', {}).get('path')
        if not isinstance(path, str) or not (ROOT / 'docs' / path).is_file():
            errors.append(f'{contextual_id} target missing: {path}')

    resolver_text = RESOLVER.read_text(encoding='utf-8') if RESOLVER.is_file() else ''
    for term in ['documentation-navigation-only','environment-unpublished','cross_environment_fallback','cross_release_fallback','CTX-WALLET-']:
        if term not in resolver_text:
            errors.append(f'Wallet resolver missing fail-closed contract term: {term}')
    if not TEST.is_file():
        errors.append('Wallet resolver tests are missing')

    if errors:
        print(f'420Docs Wallet integration FAILED: {len(errors)} defect(s)', file=sys.stderr)
        for error in errors:
            print(f'- {error}', file=sys.stderr)
        return 1

    print(f'420Docs Wallet integration PASS: {len(wallet_records)} CTX-WALLET record(s) match DOC-14; production URL/environment binding is fail-closed')
    explorer = ROOT / 'scripts/validate-doc-explorer-integration.py'
    if explorer.is_file():
        result = subprocess.run([sys.executable, str(explorer)], cwd=ROOT, check=False)
        if result.returncode != 0:
            return result.returncode
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
