#!/usr/bin/env python3
"""420Travel public preview static safety and accessibility smoke checks.

This is a source-level gate, not a substitute for browser, assistive-technology or
Cloudflare deployment acceptance.
"""
from html.parser import HTMLParser
from pathlib import Path
import hashlib
import re
import struct
import sys

ROOT = Path(__file__).resolve().parent


class Document(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tags = []
        self.scripts = []
        self.current_script = None

    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        self.tags.append((tag, data))
        if tag == 'script' and 'src' not in data:
            self.current_script = []

    def handle_data(self, data):
        if self.current_script is not None:
            self.current_script.append(data)

    def handle_endtag(self, tag):
        if tag == 'script' and self.current_script is not None:
            self.scripts.append(''.join(self.current_script))
            self.current_script = None


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def png_size(path):
    raw = path.read_bytes()
    check(raw.startswith(b'\x89PNG\r\n\x1a\n') and raw[12:16] == b'IHDR', f'invalid PNG: {path}')
    return struct.unpack('>II', raw[16:24])


def run():
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    headers = (ROOT / '_headers').read_text(encoding='utf-8')
    doc = Document()
    doc.feed(html)
    nodes = doc.tags
    ids = [a['id'] for _, a in nodes if a.get('id')]
    check(len(ids) == len(set(ids)), 'duplicate HTML id')
    check(any(t == 'html' and a.get('lang') == 'en' for t, a in nodes), 'missing document language')
    check(any(t == 'a' and a.get('href') == '#main' for t, a in nodes), 'missing skip-to-main link')
    check(any(t == 'main' and a.get('id') == 'main' for t, a in nodes), 'missing main landmark')
    check(sum(t == 'h1' for t, _ in nodes) == 1, 'expected one h1')
    check(any(t == 'nav' and a.get('aria-label') for t, a in nodes), 'missing labelled nav')
    for tag, a in nodes:
        if a.get('aria-labelledby'):
            for target in a['aria-labelledby'].split():
                check(target in ids, f'broken aria-labelledby: {target}')
        if a.get('aria-describedby'):
            for target in a['aria-describedby'].split():
                check(target in ids, f'broken aria-describedby: {target}')
        if a.get('aria-controls'):
            for target in a['aria-controls'].split():
                check(target in ids, f'broken aria-controls: {target}')
        if tag == 'img':
            check('alt' in a, f'image missing alt: {a.get("src")}')
            check(a.get('width') and a.get('height'), f'image missing intrinsic dimensions: {a.get("src")}')
        if tag == 'input':
            check(a.get('id') and any(t == 'label' and b.get('for') == a['id'] for t, b in nodes), f'input missing label: {a.get("id")}')
    # Root-relative stylesheet, images and icons must exist in Pages output.
    for tag, a in nodes:
        attr = 'src' if tag in ('img', 'script') else ('href' if tag in ('link',) else None)
        if not attr or not a.get(attr, '').startswith('/'):
            continue
        uri = a[attr].split('?', 1)[0]
        asset = (ROOT / uri.lstrip('/')).resolve()
        check(asset.is_relative_to(ROOT.resolve()) and asset.is_file(), f'missing static asset: {uri}')
    for name, expected in [('favicon-16x16.png', (16,16)), ('favicon-32x32.png', (32,32)), ('apple-touch-icon.png', (180,180)), ('icon-192.png', (192,192)), ('icon-512.png', (512,512)), ('maskable-icon-512.png', (512,512)), ('assets/brand/420travel-logo.png', (1254,1254)), ('assets/brand/og-420travel.png', (1200,630))]:
        check(png_size(ROOT / name) == expected, f'incorrect image dimensions: {name}')
    check((ROOT / 'favicon.ico').read_bytes()[:4] == b'\x00\x00\x01\x00', 'invalid favicon.ico')
    check('form-action \'none\'' in headers and 'geolocation=()' in headers, 'public preview security headers changed')
    csp = next((line for line in headers.splitlines() if 'Content-Security-Policy:' in line), '')
    for script in doc.scripts:
        digest = hashlib.sha256(script.encode('utf-8')).digest()
        import base64
        token = "'sha256-" + base64.b64encode(digest).decode('ascii') + "'"
        check(token in csp, 'inline script not authorized by CSP (mobile menu or list/map toggle may fail)')
    check(any(t == 'button' and a.get('aria-expanded') == 'false' and a.get('aria-controls') for t, a in nodes), 'mobile menu button inaccessible')
    check(len([a for t, a in nodes if t == 'button' and a.get('data-view') in ('list','map') and a.get('aria-pressed') in ('true','false')]) == 2, 'list/map selection semantics missing')
    for field in ('destination', 'event-destination', 'event-from', 'event-to', 'nearby-location'):
        check(any(t == 'input' and a.get('id') == field and 'disabled' in a for t, a in nodes), f'unqualified service enabled: {field}')
    check(len([a for t, a in nodes if t == 'button' and 'disabled' in a]) >= 5, 'private/disconnected controls unexpectedly enabled')
    check('DOOBR transactions remain unavailable' in html, 'booking/DOOBR release boundary missing')
    print('PASS: HTML landmarks, references, offline assets, image sizes, CSP script hash, and preview feature gates')
    print('NOTE: Browser keyboard testing, mobile viewport, screen reader and live Cloudflare acceptance still required')


if __name__ == '__main__':
    try:
        run()
    except (AssertionError, FileNotFoundError) as exc:
        print(f'FAIL: {exc}', file=sys.stderr)
        sys.exit(1)
