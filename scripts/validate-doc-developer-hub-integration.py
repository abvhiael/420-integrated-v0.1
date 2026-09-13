#!/usr/bin/env python3
"""Validate DOC-17.7 Developer Hub documentation integration and chained Genesis dApp docs integration."""
from __future__ import annotations
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / 'docs/contextual/contextual-link-registry.json'
TARGET = ROOT / 'docs/publication/production-target.json'
BUNDLE = ROOT / 'developer-hub/dashboard/static/docs-context.json'
RESOLVER = ROOT / 'developer-hub/dashboard/static/docs-help.js'
UI = ROOT / 'developer-hub/dashboard/static/docs-ui.js'
INDEX = ROOT / 'developer-hub/dashboard/static/index.html'


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
        print(f'420Docs Developer Hub integration FAILED: {exc}', file=sys.stderr)
        return 1

    records = {
        key: value for key, value in registry.get('records', {}).items()
        if key.startswith('CTX-DEV-') and isinstance(value, dict) and value.get('status') == 'active'
    }
    expected = {key: value.get('target', {}).get('path') for key, value in records.items()}
    if bundle.get('records') != expected:
        errors.append('Developer Hub docs-context records differ from authoritative DOC-14 CTX-DEV records')
    if bundle.get('canonical_base_url') != target.get('canonical_base_url'):
        errors.append('Developer Hub canonical base URL differs from production target')
    if sorted(bundle.get('published_environments', [])) != sorted(target.get('published_environments', [])):
        errors.append('Developer Hub published environments differ from production target')
    if bundle.get('cross_environment_fallback') is not False or bundle.get('cross_release_fallback') is not False:
        errors.append('Developer Hub documentation fallback must remain disabled')

    for contextual_id, record in records.items():
        path = record.get('target', {}).get('path')
        if not isinstance(path, str) or not (ROOT / 'docs' / path).is_file():
            errors.append(f'{contextual_id} target missing: {path}')
        if sorted(record.get('environments', [])) != sorted(bundle.get('published_environments', [])):
            errors.append(f'{contextual_id} environment scope differs from Developer Hub bundle')

    resolver = RESOLVER.read_text(encoding='utf-8') if RESOLVER.is_file() else ''
    ui = UI.read_text(encoding='utf-8') if UI.is_file() else ''
    index = INDEX.read_text(encoding='utf-8') if INDEX.is_file() else ''
    for term in ['documentation-navigation-only', 'environment-unpublished', 'unsupported-version-intent', 'CTX-DEV-']:
        if term not in resolver:
            errors.append(f'Developer Hub resolver missing contract term: {term}')
    for term in ['dashboard?.network?.environment', "'current'", 'resolveDeveloperHelp']:
        if term not in ui:
            errors.append(f'Developer Hub UI missing explicit network/version binding term: {term}')
    if '420Docs is navigation and reference only' not in index or 'docs-help' not in index:
        errors.append('Developer Hub dashboard lacks visible documentation authority boundary')

    forbidden = ['eth_sendTransaction', 'wallet_switchEthereumChain', 'deploy(', 'activateNetwork(', 'grantAuthority(']
    for term in forbidden:
        if term in resolver or term in ui:
            errors.append(f'Developer Hub docs integration must not contain runtime mutation primitive: {term}')

    if errors:
        print(f'420Docs Developer Hub integration FAILED: {len(errors)} defect(s)', file=sys.stderr)
        for error in errors:
            print(f'- {error}', file=sys.stderr)
        return 1
    print(f'420Docs Developer Hub integration PASS: {len(records)} CTX-DEV record(s), explicit network/current binding, navigation-only authority')
    dapps = ROOT / 'scripts/validate-doc-genesis-dapp-integration.py'
    if dapps.is_file():
        result = subprocess.run([sys.executable, str(dapps)], cwd=ROOT, check=False)
        if result.returncode != 0:
            return result.returncode
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
