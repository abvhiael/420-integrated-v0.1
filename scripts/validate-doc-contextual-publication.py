#!/usr/bin/env python3
"""Validate DOC-14 contextual-link publication safety."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
CTX = DOCS / "contextual"
TRB_ID = re.compile(r"^TRB-[A-Z0-9]+-[0-9]{3}$")
CTX_ID = re.compile(r"^CTX-[A-Z0-9]+-[0-9]{3}$")


def load(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"cannot read {path.relative_to(ROOT)}: {exc}") from exc
    if not isinstance(value, dict):
        raise RuntimeError(f"{path.relative_to(ROOT)} must contain a JSON object")
    return value


def slug_for_trb(trb_id: str) -> str:
    return trb_id.lower()


def main() -> int:
    errors: list[str] = []
    try:
        registry = load(CTX / "contextual-link-registry.json")
        coupling = load(CTX / "version-coupling-policy.json")
        routes = load(CTX / "troubleshooting-route-map.json")
        apps = load(CTX / "genesis-dapp-context-map.json")
        versions = load(DOCS / "versioning" / "version-registry.json")
    except RuntimeError as exc:
        print(f"420Docs contextual publication FAILED: {exc}", file=sys.stderr)
        return 1

    records = registry.get("records", {})
    if not isinstance(records, dict):
        records = {}
        errors.append("contextual registry records must be an object")

    published_envs = {
        name
        for name, track in versions.get("tracks", {}).items()
        if isinstance(track, dict) and track.get("published")
    }

    for link_id, record in sorted(records.items()):
        if not CTX_ID.fullmatch(link_id) or not isinstance(record, dict):
            continue
        status = record.get("status")
        target = record.get("target", {})
        envs = record.get("environments", [])
        if status == "active":
            path = target.get("path") if isinstance(target, dict) else None
            if not isinstance(path, str) or not (DOCS / path).is_file():
                errors.append(f"{link_id}: active target missing: {path!r}")
            for env in envs if isinstance(envs, list) else []:
                if env not in published_envs:
                    errors.append(f"{link_id}: active target advertises unpublished environment {env}")
        elif status in {"deprecated", "retired"}:
            replacement = record.get("replacement")
            if replacement is not None and replacement not in records:
                errors.append(f"{link_id}: replacement does not exist: {replacement}")

    domain_routes = routes.get("domain_routes", {})
    if not isinstance(domain_routes, dict) or not domain_routes:
        errors.append("troubleshooting domain_routes must be a non-empty object")
    else:
        for domain, path in sorted(domain_routes.items()):
            if not isinstance(domain, str) or not domain:
                errors.append("troubleshooting domain token must be non-empty")
            if not isinstance(path, str) or not (DOCS / path).is_file():
                errors.append(f"troubleshooting domain {domain}: target missing: {path!r}")

    examples = routes.get("examples", [])
    if isinstance(examples, list):
        for item in examples:
            if not isinstance(item, dict):
                continue
            trb_id = item.get("troubleshooting_id")
            anchor = item.get("anchor")
            if isinstance(trb_id, str) and TRB_ID.fullmatch(trb_id):
                expected = slug_for_trb(trb_id)
                if anchor != expected:
                    errors.append(f"{trb_id}: expected stable anchor {expected!r}, found {anchor!r}")

    app_map = apps.get("applications", {})
    if not isinstance(app_map, dict) or not app_map:
        errors.append("Genesis application contextual map must be non-empty")
    else:
        for app, spec in sorted(app_map.items()):
            if not isinstance(spec, dict):
                errors.append(f"{app}: application mapping must be an object")
                continue
            environment = spec.get("environment")
            resolvable = spec.get("resolvable")
            if environment in {"testnet", "mainnet"} and environment not in published_envs and resolvable is True:
                errors.append(f"{app}: unpublished {environment} mapping must fail closed")

    policy_envs = coupling.get("environments", {})
    if isinstance(policy_envs, dict):
        for env in ("testnet", "mainnet"):
            spec = policy_envs.get(env, {})
            if env not in published_envs and isinstance(spec, dict) and spec.get("current_available") is True:
                errors.append(f"version coupling incorrectly exposes unpublished {env}/current")

    if errors:
        print(f"420Docs contextual publication FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        "420Docs contextual publication PASS: active targets exist, published environments only, "
        "troubleshooting routes stable, unpublished tracks fail closed"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
