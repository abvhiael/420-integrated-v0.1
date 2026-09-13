#!/usr/bin/env python3
from __future__ import annotations
import json, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BUNDLE=ROOT/'explorer/web/static/docs-context.json'
HELPER=ROOT/'explorer/web/static/docs-help.js'
INDEX=ROOT/'explorer/web/static/index.html'
MAP=ROOT/'docs/contextual/genesis-dapp-context-map.json'
TARGET=ROOT/'docs/publication/production-target.json'

def fail(items):
    print(f'420Docs Explorer integration FAILED: {len(items)} defect(s)',file=sys.stderr)
    for item in items: print(f'- {item}',file=sys.stderr)
    raise SystemExit(1)

def main():
    errors=[]
    bundle=json.loads(BUNDLE.read_text())
    mapping=json.loads(MAP.read_text())
    target=json.loads(TARGET.read_text())
    helper=HELPER.read_text()
    index=INDEX.read_text()
    app=next((a for a in mapping['applications'] if a['domain']=='EXPLORER'),None)
    if not app: errors.append('DOC-14 Explorer application mapping missing')
    else:
        expected={f"CTX-EXPLORER-{slot}":f"{app['base_path']}/{spec['file'][:-3]}/" if spec['file']!='index.md' else f"{app['base_path']}/index/" for slot,spec in mapping['target_slots'].items()}
        if bundle.get('records')!=expected: errors.append('Explorer contextual bundle differs from DOC-14 map')
        if bundle.get('published_environments')!=app.get('environments'): errors.append('Explorer environments differ from DOC-14 map')
    if bundle.get('authority')!='documentation-navigation-only': errors.append('Explorer docs authority marker missing')
    if bundle.get('version_intent')!='current': errors.append('Explorer version intent must be current')
    base=target.get('canonical_base_url','')
    if base not in helper or base not in index: errors.append('Explorer integration is not bound to production target')
    for token in ['unpublished-environment','unsupported-version-intent','documentation-navigation-only']:
        if token not in helper: errors.append(f'Explorer resolver missing fail-closed marker: {token}')
    for forbidden in ['sendTransaction','eth_sendTransaction','finalizedHeight=','chainId=']:
        if forbidden in helper: errors.append(f'Explorer docs resolver contains runtime authority behavior: {forbidden}')
    if 'data-doc-context="CTX-EXPLORER-001"' not in index: errors.append('visible Explorer help entry is not tied to CTX-EXPLORER-001')
    if errors: fail(errors)
    print('420Docs Explorer integration PASS: six DOC-14 contexts, canonical production help entry, fail-closed environment/version handling, navigation-only authority')
    return 0

if __name__=='__main__': raise SystemExit(main())
