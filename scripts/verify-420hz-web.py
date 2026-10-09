#!/usr/bin/env python3
from pathlib import Path

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
    WEB / "420hz-logo.svg",
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
    logo = (WEB / "420hz-logo.svg").read_text()

    for token in ["420Hz", "discover", "artists", "streaming", "creator studio", "networkPill"]:
        need(token.lower() in html.lower(), f"missing user-facing section/token: {token}")

    need('href="/styles.css"' in html, "stylesheet path drift")
    need('src="/runtime-config.js"' in html, "runtime config path drift")
    need('src="/app.js"' in html, "app script path drift")
    need('href="/420hz-logo.svg"' in html, "official logo favicon path drift")
    need(html.count('src="/420hz-logo.svg"') >= 3, "official logo must appear in header, hero and footer")
    need("hero-logo" in html, "official logo missing from main website image")
    need("brand-logo" in html, "official logo missing from header")
    need("footer-logo" in html, "official logo missing from footer")

    need("data:image/webp;base64," in logo, "official logo asset must embed the approved image")
    need("420Hz official logo" in logo, "official logo accessibility metadata missing")

    need("https://hz.420integrated.org" in runtime, "production origin drift")
    need('liveEnabled: false' in runtime, "pre-testnet live gate must remain false")
    need('chainId: null' in runtime, "pre-testnet chain ID must remain unresolved")
    need('indexerBaseUrl: null' in runtime, "pre-testnet indexer URL must remain unresolved")

    need("button.disabled = true" in js, "state-changing controls must fail closed")
    need("HZ-AUDIT-7" in js, "disabled-action testnet ownership missing")
    need("liveReady" in js, "runtime readiness validation missing")


    # HZ-GCA-16: verify every navigable product entry point, official branding,
    # explicit non-live states and unavailable state-changing controls.
    for target in ["generate", "community", "charts", "awards", "creators"]:
        need(f'href="#{target}"' in html, f"missing primary product navigation: {target}")
        need(f'id="{target}"' in html, f"broken product navigation target: {target}")
    need('Generate your own song' in html and 'class="button primary generate-cta"' in html,
         "Generate hero CTA is missing")
    need('id="currentAwardsSeason"' in html and 'id="awardsSeasonState"' in html,
         "current Awards season module missing")
    need("No verified live season is available." in html, "unverified Awards season is misrepresented")
    need('Nominate — testnet required</button>' in html and 'Vote — testnet required</button>' in html,
         "voting and nomination availability states missing")
    need('data-disclosure="AI_GENERATED"' in html and 'data-disclosure="AI_ASSISTED"' in html
         and 'data-disclosure="AI_DERIVATIVE"' in html and 'data-disclosure="HUMAN"' in html,
         "AI disclosure class legend missing")
    need('Live rankings cannot be shown' in html, "charts may not imply live unverified results")
    need('Live follows, playlists, reports' in html, "community availability must be explicit")
    need('button type="button" class="button secondary" disabled' in html,
         "Awards write controls must remain disabled until verified testnet")

    need("Content-Security-Policy:" in headers, "CSP missing")
    need("frame-ancestors 'none'" in headers, "frame ancestry protection missing")
    need("form-action 'none'" in headers, "form action protection missing")
    need("geolocation=()" in headers, "permissions policy missing geolocation denial")

    need("Build output directory: **hz/web**" in deploy, "Cloudflare output path drift")
    need("Root directory: repository root" in deploy, "Cloudflare root guidance drift")
    need("hz.420integrated.org" in deploy, "custom domain guidance missing")

    for token in ["--gold:#d4af37", "--forest:#0b3d2e", "--electric:#08a9ff", ".hero-logo", ".brand-logo", ".footer-logo"]:
        need(token in css, f"official 420Hz branding token missing: {token}")
    need("@media" in css, "responsive styling missing")

print({
    "pass": not errors,
    "site": "420Hz",
    "origin": "https://hz.420integrated.org",
    "live_enabled": False,
    "official_logo": "hz/web/420hz-logo.svg",
    "errors": errors,
})
raise SystemExit(0 if not errors else 2)
