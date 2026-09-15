#!/usr/bin/env python3
from __future__ import annotations
import json, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MAP=ROOT/'docs/contextual/genesis-dapp-context-map.json'
TARGET=ROOT/'docs/publication/production-target.json'
BUNDLE=ROOT/'packages/420-docs-context/genesis-dapps.json'
RESOLVER=ROOT/'packages/420-docs-context/index.js'
TEST=ROOT/'packages/420-docs-context/test.mjs'

def main():
    errors=[]
    mapping=json.loads(MAP.read_text())
    target=json.loads(TARGET.read_text())
    bundle=json.loads(BUNDLE.read_text())
    resolver=RESOLVER.read_text() if RESOLVER.is_file() else ''
    published=set(target.get('published_environments',[]))
    expected_apps={}
    materialized=0
    for app in mapping.get('applications',[]):
        envs=set(app.get('environments',[]))
        if app.get('availability') is not None or not (envs & published):
            continue
        records={}
        for suffix,slot in mapping.get('target_slots',{}).items():
            filename=slot['file']
            route=f"{app['base_path']}/" if filename=='index.md' else f"{app['base_path']}/{filename[:-3]}/"
            records[f"CTX-{app['domain']}-{suffix}"]=route
            if not (ROOT/'docs'/app['base_path']/filename).is_file(): errors.append(f"missing target: {app['base_path']}/{filename}")
            materialized+=1
        expected_apps[app['surface']]={'name':app['name'],'domain':app['domain'],'environments':app['environments'],'records':records}
    if bundle.get('applications')!=expected_apps: errors.append('runtime dApp bundle differs from DOC-14 map')
    if bundle.get('canonical_base_url')!=target.get('canonical_base_url'): errors.append('runtime dApp bundle production URL differs from target')
    if set(bundle.get('published_environments',[]))!=published: errors.append('runtime dApp bundle publication environments differ from target')
    if bundle.get('cross_environment_fallback') is not False or bundle.get('cross_release_fallback') is not False: errors.append('runtime dApp fallback must remain disabled')
    if bundle.get('authority')!='documentation-navigation-only': errors.append('runtime dApp bundle authority marker missing')
    if materialized!=108 or len(expected_apps)!=18: errors.append(f'expected 18 published dApps / 108 contexts, got {len(expected_apps)} / {materialized}')
    if '420-faucet' in bundle.get('applications',{}): errors.append('Faucet must remain unavailable until testnet publication')
    if any('GAMING' in key for app in bundle.get('applications',{}).values() for key in app.get('records',{})): errors.append('Gaming Protocol must remain protocol-only')
    for token in ['environment-unpublished','unsupported-version-intent','documentation-navigation-only','surface-unavailable']:
        if token not in resolver: errors.append(f'resolver missing fail-closed marker: {token}')
    if not TEST.is_file(): errors.append('shared resolver tests missing')
    if errors:
        print(f'420Docs Genesis dApp integration FAILED: {len(errors)} defect(s)',file=sys.stderr)
        for error in errors: print(f'- {error}',file=sys.stderr)
        return 1
    print('420Docs Genesis dApp integration PASS: 18 published dApps, 108 CTX routes, Faucet unavailable, Gaming protocol-only, fail-closed production routing')
    return 0

if __name__=='__main__': raise SystemExit(main())
