#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
errors = []
def check(condition, message):
    if not condition:
        errors.append(message)
def read(path):
    p = root / path
    check(p.is_file(), "missing " + path)
    return p.read_text() if p.is_file() else ""

feed = read("reefer-review/news_feed.go")
tests = read("reefer-review/news_test.go")
sync = read("cmd/reefer-news-sync/main.go")
roadmap = read("docs/reefer-review/RR-ROADMAP.md")
doc = read("docs/reefer-review/RR-7-NEWSFEED-SECURITY.md")
for marker in ("validateFeedEndpoint", "secureNewsHTTPClient", "publicFeedIP", "LookupNetIP", "ErrUseLastResponse", "MaxBytes", "DOCTYPE", "ENTITY", "too many feed entries"):
    check(marker in feed, "missing feed security marker: " + marker)
for marker in ("TestRR7RejectsUnsafeFeedEndpoints", "TestRR7RedirectIsNotFollowed", "TestRR7OversizeFeedAndEntityPayloadFailClosed"):
    check(marker in tests, "missing security test: " + marker)
check("FeedFetcher{}" in sync, "sync must use guarded default HTTP client")
check("RR-7 — Newsfeed Security" in roadmap, "missing canonical roadmap step")
check("RR-8 — Feed Operations" in roadmap, "missing next canonical step")
check("SSRF" in doc and "DNS" in doc, "security documentation incomplete")
for err in errors:
    print("ERROR:", err)
if errors:
    sys.exit(1)
print("Reefer Review RR-7 verifier: PASS")
