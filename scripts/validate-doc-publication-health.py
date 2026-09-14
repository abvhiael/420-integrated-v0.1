#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, sys, urllib.error, urllib.request
from pathlib import Path
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / 'docs/publication/publication-health.json'

def load_contract():
    return json.loads(CONTRACT.read_text(encoding='utf-8'))

def check_site(site: Path, contract: dict) -> list[str]:
    errors=[]
    for rel in contract.get('required_artifact_files', []):
        if not (site / rel).is_file(): errors.append(f'missing artifact file: {rel}')
    publication = site / contract.get('publication_identity_file','publication.json')
    if publication.is_file():
        try: data=json.loads(publication.read_text(encoding='utf-8'))
        except Exception as exc: errors.append(f'invalid publication identity: {exc}'); data={}
        if data.get('repository') != contract.get('expected_repository'): errors.append('publication repository mismatch')
        if data.get('ref') != contract.get('expected_ref'): errors.append('publication ref mismatch')
        if data.get('qualified') is not True: errors.append('publication identity is not qualified')
        if not isinstance(data.get('source_commit'), str) or len(data.get('source_commit','')) < 7: errors.append('publication source_commit missing')
    return errors

def fetch(url: str) -> tuple[int, bytes]:
    req=urllib.request.Request(url, headers={'User-Agent':'420Docs-health/1'})
    with urllib.request.urlopen(req, timeout=20) as res:
        return res.status, res.read()

def check_remote(base: str, contract: dict) -> list[str]:
    errors=[]
    for route in contract.get('critical_routes', []):
        url=urljoin(base, route)
        try: status, body=fetch(url)
        except Exception as exc: errors.append(f'unreachable route {route or "/"}: {exc}'); continue
        if status != 200: errors.append(f'route {route or "/"} returned {status}')
        if route.endswith('/') and b'<html' not in body.lower() and b'<!doctype html' not in body.lower(): errors.append(f'route {route or "/"} is not HTML')
    try:
        _, body=fetch(urljoin(base, contract.get('publication_identity_file','publication.json')))
        data=json.loads(body.decode('utf-8'))
        if data.get('repository') != contract.get('expected_repository'): errors.append('remote publication repository mismatch')
        if data.get('ref') != contract.get('expected_ref'): errors.append('remote publication ref mismatch')
        if data.get('qualified') is not True: errors.append('remote publication is not qualified')
    except Exception as exc: errors.append(f'publication identity unavailable: {exc}')
    return errors

def main() -> int:
    parser=argparse.ArgumentParser()
    parser.add_argument('--site-dir')
    parser.add_argument('--base-url')
    args=parser.parse_args()
    contract=load_contract()
    errors=[]
    if args.site_dir: errors.extend(check_site(Path(args.site_dir), contract))
    if args.base_url:
        base=args.base_url if args.base_url.endswith('/') else args.base_url+'/'
        errors.extend(check_remote(base, contract))
    if not args.site_dir and not args.base_url:
        print('420Docs publication health FAILED: supply --site-dir and/or --base-url', file=sys.stderr); return 2
    if errors:
        print(f'420Docs publication health FAILED: {len(errors)} defect(s)', file=sys.stderr)
        for error in errors: print(f'- {error}', file=sys.stderr)
        return 1
    print('420Docs publication health PASS: critical artifact/deployed routes and publication identity are healthy')
    return 0

if __name__=='__main__': raise SystemExit(main())
