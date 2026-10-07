#!/usr/bin/env python3
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "reefer-review" / "web"
errors = []

def req(ok, msg):
    if not ok:
        errors.append(msg)

for rel in ["index.html", "styles.css", "app.js", "README.md"]:
    req((WEB / rel).exists(), f"missing reefer-review/web/{rel}")

index = (WEB / "index.html").read_text(encoding="utf-8") if (WEB / "index.html").exists() else ""
css = (WEB / "styles.css").read_text(encoding="utf-8") if (WEB / "styles.css").exists() else ""
js = (WEB / "app.js").read_text(encoding="utf-8") if (WEB / "app.js").exists() else ""

class AuditParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.nav_routes = set()
        self.labels_for = set()
        self.inputs = set()
        self.live = 0
        self.skip = False
        self.main = False
        self.logo_refs = 0
    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if "id" in data:
            self.ids.add(data["id"])
        if tag == "a" and data.get("data-route"):
            self.nav_routes.add(data["data-route"])
        if tag == "label" and data.get("for"):
            self.labels_for.add(data["for"])
        if tag in {"input", "textarea", "select"} and data.get("id"):
            self.inputs.add(data["id"])
        if data.get("aria-live"):
            self.live += 1
        if tag == "a" and data.get("class") == "skip-link" and data.get("href") == "#main-content":
            self.skip = True
        if tag == "main" and data.get("id") == "main-content":
            self.main = True
        if tag in {"img", "link"} and "reefer-review-logo" in data.get("src", data.get("href", "")):
            self.logo_refs += 1

parser = AuditParser()
parser.feed(index)

expected_routes = {"latest", "news", "originals", "topics", "search"}
req(expected_routes.issubset(parser.nav_routes), f"required RR-2 navigation routes missing: {parser.nav_routes}")
for route in expected_routes:
    req(f"view-{route}" in parser.ids, f"missing view-{route}")
req(parser.skip and parser.main, "skip-link/main landmark missing")
req(parser.live >= 5, "insufficient live regions for dynamic feed/search/status")
req(parser.logo_refs >= 2, "official Reefer Review logo missing from header/hero")
for control in {"draft-title", "draft-body", "visibility", "search-query"}:
    req(control in parser.inputs, f"missing control {control}")
    req(control in parser.labels_for, f"missing programmatic label for {control}")
req("actor" in parser.inputs or "session-actor" in parser.inputs, "missing editorial actor control")
req("actor" in parser.labels_for or "session-actor" in parser.labels_for, "missing programmatic label for editorial actor")

for marker in [
    "/v1/news?", "/v1/news/sources", "/v1/news/topics", "/v1/publications?limit=20",
    "canonical_url", "attribution", "Read original", "noopener noreferrer external",
    "source-filter", "topic-filter", "news-more", "originals-more",
    "runSearch", "externalNewsCard", "originalCard",
]:
    req(marker in js, f"app.js missing {marker}")

req("routeFromHash" in js or "parseRoute" in js, "route parser missing")
req(".innerHTML" not in js, "app.js must not inject feed content through innerHTML")
req("document.createElement" in js and ".textContent" in js, "safe DOM construction missing")
req("URLSearchParams" in js, "query/filter encoding missing")
req("next_cursor" in js, "pagination cursor handling missing")
req("aria-current" in js, "active navigation accessibility state missing")

for marker in [
    ":focus-visible", "@media (max-width:800px)", "@media (max-width:620px)",
    "@media (prefers-reduced-motion:reduce)", ".skip-link", ".card-grid",
    ".primary-nav", ".filter-bar",
]:
    req(marker in css, f"styles.css missing {marker}")

req("innerHTML" not in index, "index contains legacy innerHTML feed rendering")
req('src="./app.js"' in index, "app.js not loaded")
req('href="./styles.css"' in index, "styles.css not loaded")

roadmap = ROOT / "docs" / "reefer-review" / "RR-ROADMAP.md"
rr2 = ROOT / "docs" / "reefer-review" / "RR-2-USER-FACING-NEWS-APP.md"
req(roadmap.exists(), "missing RR roadmap")
req(rr2.exists(), "missing RR-2 design contract")
if rr2.exists():
    body = rr2.read_text(encoding="utf-8")
    for suffix in "ABCDEFGHI":
        req(f"RR-2.{suffix}" in body, f"RR-2 requirement {suffix} missing")

if errors:
    for error in errors:
        print("ERROR:", error)
    sys.exit(1)

print("Reefer Review RR-2 verifier: PASS")
