#!/usr/bin/env python3
"""Validate DOC-17.3 canonical production URL and DOC-13 release routing."""
from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "docs/publication/production-target.json"
REGISTRY = ROOT / "docs/versioning/version-registry.json"


def load(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain an object")
    return value


def main() -> int:
    errors: list[str] = []
    try:
        target = load(TARGET)
        registry = load(REGISTRY)
    except Exception as exc:
        print(f"420Docs canonical publication FAILED: {exc}", file=sys.stderr)
        return 1

    base = target.get("canonical_base_url")
    if base != "https://abvhiael.github.io/420-integrated-v0.1/":
        errors.append("canonical production base URL is not the committed GitHub Pages target")
    if target.get("custom_domain") is not None:
        errors.append("custom domain must remain null until explicitly configured")
    if target.get("cross_environment_fallback") is not False:
        errors.append("cross-environment fallback must be false")
    if target.get("cross_release_fallback") is not False:
        errors.append("cross-release fallback must be false")

    tracks = registry.get("tracks", {})
    published = sorted(k for k, v in tracks.items() if isinstance(v, dict) and v.get("current") is not None and v.get("published"))
    unpublished = sorted(k for k, v in tracks.items() if isinstance(v, dict) and v.get("current") is None and v.get("published") == [])
    if published != sorted(target.get("published_environments", [])):
        errors.append("production target published environments differ from DOC-13 registry")
    if unpublished != sorted(target.get("unpublished_environments", [])):
        errors.append("production target unpublished environments differ from DOC-13 registry")

    aliases = registry.get("aliases", {})
    for env in target.get("published_environments", []):
        if f"{env}/current" not in aliases:
            errors.append(f"published environment lacks current alias: {env}")
    for env in target.get("unpublished_environments", []):
        if f"{env}/current" in aliases:
            errors.append(f"unpublished environment exposes current alias: {env}")

    if errors:
        print(f"420Docs canonical publication FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print("420Docs canonical publication PASS: production URL is explicit; DOC-13 published tracks match; testnet/mainnet remain fail-closed")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
