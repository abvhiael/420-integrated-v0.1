#!/usr/bin/env python3
"""Validate DOC-17.4 repository links against the production publication contract."""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENTRYPOINTS = ROOT / "docs/publication/repository-entrypoints.json"
TARGET = ROOT / "docs/publication/production-target.json"
README = ROOT / "README.md"


def load(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain an object")
    return value


def main() -> int:
    errors: list[str] = []
    try:
        contract = load(ENTRYPOINTS)
        target = load(TARGET)
        readme = README.read_text(encoding="utf-8")
    except Exception as exc:
        print(f"420Docs repository integration FAILED: {exc}", file=sys.stderr)
        return 1

    base = target.get("canonical_base_url")
    if contract.get("public_root") != base:
        errors.append("repository public root differs from committed production target")
    if not isinstance(base, str) or not base.endswith("/"):
        errors.append("canonical production base URL must end with slash")
    elif base not in readme:
        errors.append("README does not link the canonical production 420Docs root")

    seen_ids: set[str] = set()
    seen_paths: set[str] = set()
    entries = contract.get("entries", [])
    if not isinstance(entries, list) or not entries:
        errors.append("repository entrypoint contract must define entries")
        entries = []
    for entry in entries:
        if not isinstance(entry, dict):
            errors.append("repository entry must be an object")
            continue
        ident = entry.get("id")
        source = entry.get("source")
        public_path = entry.get("public_path")
        label = entry.get("label")
        if not all(isinstance(v, str) for v in (ident, source, public_path, label)):
            errors.append("repository entry requires string id/label/source/public_path")
            continue
        if ident in seen_ids:
            errors.append(f"duplicate repository entry id: {ident}")
        seen_ids.add(ident)
        if source in seen_paths:
            errors.append(f"duplicate repository source entry: {source}")
        seen_paths.add(source)
        source_path = ROOT / source
        if not source_path.is_file():
            errors.append(f"repository source entry missing: {source}")
        source_link = source.removeprefix("docs/")
        if source.endswith("/index.md"):
            source_link = source.removeprefix("docs/")[:-8]
        elif source == "docs/index.md":
            source_link = "docs/"
        # README source links may be directory or file links; require the docs family to be discoverable.
        family = source.split("/", 2)[1] if source.startswith("docs/") and "/" in source[5:] else None
        if ident != "docs-root" and family and f"docs/{family}/" not in readme:
            errors.append(f"README missing source-level entry for {ident}: docs/{family}/")
        if public_path.startswith("/") or "://" in public_path or ".." in public_path:
            errors.append(f"public path must be relative to production root: {ident}")

    required = {"docs-root","get-started","users","developers","operators","architecture","reference","troubleshooting"}
    missing = sorted(required - seen_ids)
    if missing:
        errors.append("required repository entrypoints missing: " + ", ".join(missing))

    if errors:
        print(f"420Docs repository integration FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print(f"420Docs repository integration PASS: canonical root matches production target and {len(entries)} repository audience entrypoint(s) resolve")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
