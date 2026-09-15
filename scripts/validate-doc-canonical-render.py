#!/usr/bin/env python3
"""Validate rendered canonical metadata against the committed DOC-17 production target."""
from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "docs/publication/production-target.json"
CANON = re.compile(r'<link\s+rel="canonical"\s+href="([^"]+)"', re.IGNORECASE)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site-dir", default="site")
    args = parser.parse_args()
    site = Path(args.site_dir)
    if not site.is_absolute():
        site = ROOT / site
    target = json.loads(TARGET.read_text(encoding="utf-8"))
    base = str(target.get("canonical_base_url", ""))
    pages = sorted(site.rglob("*.html"))
    errors: list[str] = []
    for page in pages:
        text = page.read_text(encoding="utf-8")
        matches = CANON.findall(text)
        if len(matches) != 1:
            errors.append(f"{page.relative_to(site)} canonical count={len(matches)}")
            continue
        href = matches[0]
        if not href.startswith(base):
            errors.append(f"{page.relative_to(site)} canonical outside production base: {href}")
        if "/versions/testnet/" in href or "/versions/mainnet/" in href:
            errors.append(f"{page.relative_to(site)} canonical points to unpublished environment: {href}")
    if not pages:
        errors.append("no rendered HTML pages found")
    if errors:
        print(f"420Docs canonical render FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print(f"420Docs canonical render PASS: {len(pages)} page(s) use committed production base and no unpublished environment canonical routes")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
