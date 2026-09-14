#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "docs" / "versioning" / "migration-policy.json"


def main() -> int:
    try:
        policy = json.loads(POLICY.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"420Docs migration policy ERROR: {exc}", file=sys.stderr)
        return 1

    required = {
        "legacy_flat_routes": "compatibility-only",
        "missing_page_behavior": "not-found",
        "cross_environment_mapping": False,
        "cross_release_mapping": False,
        "automatic_current_fallback": False,
        "require_explicit_mappings": True,
        "preserve_equivalent_anchors": True,
        "preserve_troubleshooting_ids": True,
    }
    errors = [f"{key} must be {value!r}" for key, value in required.items() if policy.get(key) != value]
    if not isinstance(policy.get("mappings"), list):
        errors.append("mappings must be an array")
    if not isinstance(policy.get("retired_routes"), list):
        errors.append("retired_routes must be an array")

    if errors:
        print("420Docs migration policy FAIL:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print(
        "420Docs migration policy PASS: "
        f"{len(policy['mappings'])} explicit mapping(s); "
        f"{len(policy['retired_routes'])} retired route(s)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
