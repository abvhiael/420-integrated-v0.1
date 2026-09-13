#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
MAP = DOCS / "contextual" / "genesis-dapp-context-map.json"
PUBLISHED = {"development", "genesis"}


def main() -> int:
    data = json.loads(MAP.read_text(encoding="utf-8"))
    slots = data.get("target_slots", {})
    apps = data.get("applications", [])
    errors: list[str] = []
    materialized = 0
    seen: set[str] = set()

    if set(slots) != {"001", "002", "003", "004", "005", "006"}:
        errors.append("target_slots must define exactly 001 through 006")

    for app in apps:
        domain = app.get("domain")
        base = app.get("base_path")
        envs = set(app.get("environments", []))
        if not isinstance(domain, str) or not domain:
            errors.append("application has invalid domain")
            continue
        if not isinstance(base, str) or not base:
            errors.append(f"{domain}: invalid base_path")
            continue

        publishable = bool(envs & PUBLISHED) and app.get("availability") is None
        for suffix, slot in sorted(slots.items()):
            ctx_id = f"CTX-{domain}-{suffix}"
            if ctx_id in seen:
                errors.append(f"duplicate synthesized contextual ID: {ctx_id}")
            seen.add(ctx_id)

            if not publishable:
                continue

            target_type = slot.get("target_type")
            filename = slot.get("file")
            if target_type not in {"task", "concept", "reference", "troubleshooting"}:
                errors.append(f"{ctx_id}: invalid target_type {target_type!r}")
            if not isinstance(filename, str) or not filename:
                errors.append(f"{ctx_id}: invalid target file")
                continue
            target = DOCS / base / filename
            if not target.is_file():
                errors.append(f"{ctx_id}: target does not exist: {target.relative_to(ROOT)}")
            materialized += 1

    excluded = data.get("excluded", [])
    if not any(item.get("name") == "420 Gaming Protocol" for item in excluded if isinstance(item, dict)):
        errors.append("420 Gaming Protocol protocol-only exclusion is missing")

    if errors:
        print(f"420Docs dApp contextual map FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        "420Docs dApp contextual map PASS: "
        f"{materialized} published CTX record(s) deterministically materialized; "
        "unpublished targets remain unresolved"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
