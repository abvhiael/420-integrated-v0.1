#!/usr/bin/env python3
"""Inject canonical production URLs into rendered 420Docs HTML."""
from __future__ import annotations
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "docs/publication/production-target.json"
MARKER = '<link rel="canonical" href="'


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site-dir", default="site")
    args = parser.parse_args()
    site = Path(args.site_dir)
    if not site.is_absolute():
        site = ROOT / site
    target = json.loads(TARGET.read_text(encoding="utf-8"))
    base = str(target["canonical_base_url"])
    if not base.endswith("/"):
        raise SystemExit("canonical_base_url must end with /")
    pages = sorted(site.rglob("*.html"))
    if not pages:
        raise SystemExit("no rendered HTML pages found")
    for page in pages:
        text = page.read_text(encoding="utf-8")
        if MARKER in text:
            raise SystemExit(f"canonical metadata already present: {page.relative_to(site)}")
        rel = page.relative_to(site).as_posix()
        if rel == "index.html":
            route = ""
        elif rel.endswith("/index.html"):
            route = rel[:-10]
        else:
            route = rel
        href = base + route
        tag = f'<link rel="canonical" href="{href}">' 
        if "</head>" not in text:
            raise SystemExit(f"missing </head>: {page.relative_to(site)}")
        page.write_text(text.replace("</head>", f"  {tag}\n</head>", 1), encoding="utf-8")
    print(f"420Docs canonical metadata injected: {len(pages)} rendered page(s); base={base}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
