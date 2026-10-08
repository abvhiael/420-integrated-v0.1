#!/usr/bin/env python3
from pathlib import Path
import json
import sys
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
errors = []

def req(ok, msg):
    if not ok:
        errors.append(msg)

required = [
    "reefer-review/news_model.go",
    "reefer-review/news_sources.go",
    "reefer-review/news_store.go",
    "reefer-review/news_feed.go",
    "reefer-review/news_service.go",
    "reefer-review/news_http.go",
    "reefer-review/news_test.go",
    "reefer-review/news_http_test.go",
    "cmd/reefer-news-sync/main.go",
    "config/reefer-review-news-sources.json",
    "docs/reefer-review/RR-ROADMAP.md",
    "docs/reefer-review/RR-1-PERSISTENT-CANNABIS-NEWSFEED.md",
]
for rel in required:
    req((ROOT / rel).exists(), f"missing {rel}")

cfg_path = ROOT / "config/reefer-review-news-sources.json"
if cfg_path.exists():
    cfg = json.loads(cfg_path.read_text())
    req(cfg.get("schema") == "420-reefer-review-news-sources-v1", "wrong news source schema")
    sources = cfg.get("sources", [])
    req(len(sources) >= 1, "news source registry is empty")
    ids, feeds = set(), set()
    for source in sources:
        sid = source.get("id", "")
        feed = source.get("feed_url", "")
        home = source.get("home_url", "")
        req(bool(sid and source.get("name") and source.get("attribution")), "incomplete news source")
        req(sid not in ids, f"duplicate news source id {sid}")
        ids.add(sid)
        req(urlparse(feed).scheme == "https" and bool(urlparse(feed).netloc), f"insecure feed {sid}")
        req(urlparse(home).scheme == "https" and bool(urlparse(home).netloc), f"insecure home {sid}")
        req(feed not in feeds, f"duplicate feed url {feed}")
        feeds.add(feed)
        req(int(source.get("poll_interval_minutes", 0)) >= 5, f"unsafe poll cadence {sid}")

model = (ROOT / "reefer-review/news_model.go").read_text() if (ROOT / "reefer-review/news_model.go").exists() else ""
store = (ROOT / "reefer-review/news_store.go").read_text() if (ROOT / "reefer-review/news_store.go").exists() else ""
feed = (ROOT / "reefer-review/news_feed.go").read_text() if (ROOT / "reefer-review/news_feed.go").exists() else ""
http = (ROOT / "reefer-review/http.go").read_text() if (ROOT / "reefer-review/http.go").exists() else ""
roadmap = (ROOT / "docs/reefer-review/RR-ROADMAP.md").read_text() if (ROOT / "docs/reefer-review/RR-ROADMAP.md").exists() else ""

for marker in ["ExternalNewsItem", "CanonicalURLHash", "ContentFingerprint", "NewsRejected", "NewsVisible"]:
    req(marker in model, f"news model missing {marker}")
for marker in ["420-reefer-review-news-store-v1", "os.Rename", "newsFilterHash", "FeedGUID"]:
    req(marker in store, f"news store missing {marker}")
for marker in ["ParseNewsFeed", "DOCTYPE", "cannabisRelevant", "normalizeNewsEntry", "defaultMaxFeedBytes"]:
    req(marker in feed, f"news ingestion missing {marker}")
for marker in ['"/v1/news"', '"/v1/news/sources"', '"/v1/news/topics"', '"/v1/news/"']:
    req(marker in http, f"HTTP routing missing {marker}")
for i in range(1, 10):
    req(f"RR-1.{i}" in roadmap, f"roadmap missing RR-1.{i}")

if errors:
    for err in errors:
        print("ERROR:", err)
    sys.exit(1)

print("Reefer Review RR-1 verifier: PASS")
