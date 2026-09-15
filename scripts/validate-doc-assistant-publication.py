#!/usr/bin/env python3
from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
A = ROOT / "docs" / "assistant"
S = ROOT / "scripts"

POLICIES = [
    "source-registry.json",
    "intent-map.json",
    "citation-evidence-schema.json",
    "network-version-policy.json",
    "troubleshooting-policy.json",
    "privacy-policy.json",
    "420ai-integration-policy.json",
]
VALIDATORS = [
    "validate-doc-assistant-source-registry.py",
    "validate-doc-assistant-intents.py",
    "validate-doc-assistant-citations.py",
    "validate-doc-assistant-network-version.py",
    "validate-doc-assistant-troubleshooting.py",
    "validate-doc-assistant-privacy.py",
    "validate-doc-assistant-420ai.py",
]

def main() -> int:
    errors = []
    for name in POLICIES:
        path = A / name
        if not path.is_file():
            errors.append(f"missing docs/assistant/{name}")
            continue
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(value, dict) or value.get("schema_version") != 1:
                errors.append(f"invalid schema: docs/assistant/{name}")
        except (OSError, json.JSONDecodeError):
            errors.append(f"invalid JSON: docs/assistant/{name}")
    for name in VALIDATORS:
        if not (S / name).is_file():
            errors.append(f"missing scripts/{name}")
    versions = json.loads((ROOT / "docs/versioning/version-registry.json").read_text(encoding="utf-8"))
    for env in ("testnet", "mainnet"):
        if versions["tracks"][env]["published"]:
            errors.append(f"{env} unexpectedly published")
    if errors:
        print(f"420Docs assistant publication FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print("420Docs assistant publication PASS")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
