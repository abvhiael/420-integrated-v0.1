#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "hz" / "web"
errors = []

def need(cond, message):
    if not cond:
        errors.append(message)

required = [
    WEB / "index.html",
    WEB / "styles.css",
    WEB / "app.js",
    WEB / "runtime-config.js",
    WEB / "favicon.svg",
    WEB / "_headers",
    WEB / "CLOUDFLARE-DEPLOYMENT.md",
    ROOT / "docs" / "420HZ-WEB.md",
]
for path in required:
    need(path.is_file(), f"missing {path.relative_to(ROOT)}")

if not errors:
    html = (WEB / "index.html").read_text()
    css = (WEB / "styles.css").read_text()
    js = (WEB / "app.js").read_text()
    runtime = (WEB / "runtime-config.js").read_text()
    headers = (WEB / "_headers").read_text()
    deploy = (WEB / "CLOUDFLARE-DEPLOYMENT.md").read_text()

    for token in ["420Hz", "discover", "artists", "streaming", "creator studio", "networkPill"]:
        need(token.lower() in html.lower(), f"missing user-facing section/token: {token}")

    need('href="/styles.css"' in html, "stylesheet path drift")
    need('src="/runtime-config.js"' in html, "runtime config path drift")
    need('src="/app.js"' in html, "app script path drift")
    need('href="/favicon.svg"' in html, "favicon path drift")

    need("https://hz.420integrated.org" in runtime, "production origin drift")
    need('liveEnabled: false' in runtime, "pre-testnet live gate must remain false")
    need('chainId: null' in runtime, "pre-testnet chain ID must remain unresolved")
    need('indexerBaseUrl: null' in runtime, "pre-testnet indexer URL must remain unresolved")

    need("button.disabled = true" in js, "state-changing controls must fail closed")
    need("HZ-AUDIT-7" in js, "disabled-action testnet ownership missing")
    need("liveReady" in js, "runtime readiness validation missing")

    need("Content-Security-Policy:" in headers, "CSP missing")
    need("frame-ancestors 'none'" in headers, "frame ancestry protection missing")
    need("form-action 'none'" in headers, "form action protection missing")
    need("geolocation=()" in headers, "permissions policy missing geolocation denial")

    need("Build output directory: **hz/web**" in deploy, "Cloudflare output path drift")
    need("Root directory: repository root" in deploy, "Cloudflare root guidance drift")
    need("hz.420integrated.org" in deploy, "custom domain guidance missing")

    need("#d8ff3e" in css, "420Hz accent identity drift")
    need("@media" in css, "responsive styling missing")

print({
    "pass": not errors,
    "site": "420Hz",
    "origin": "https://hz.420integrated.org",
    "live_enabled": False,
    "errors": errors,
})
raise SystemExit(0 if not errors else 2)
