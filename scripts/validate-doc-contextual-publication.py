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

    domain_routes = routes.get("domains", {})
    if not isinstance(domain_routes, dict) or not domain_routes:
        errors.append("troubleshooting domains must be a non-empty object")
    else:
        for domain, path in sorted(domain_routes.items()):
            if not isinstance(domain, str) or not domain:
                errors.append("troubleshooting domain token must be non-empty")
            if not isinstance(path, str) or not (DOCS / path).is_file():
                errors.append(f"troubleshooting domain {domain}: target missing: {path!r}")

    app_map = apps.get("applications", [])
    if not isinstance(app_map, list) or not app_map:
        errors.append("Genesis application contextual map must be a non-empty list")
    else:
        for spec in app_map:
            if not isinstance(spec, dict):
                errors.append("application mapping must be an object")
                continue
            name = spec.get("name", "<unknown>")
            envs = spec.get("environments", [])
            availability = spec.get("availability")
            if not isinstance(envs, list) or not envs:
                errors.append(f"{name}: environments must be a non-empty list")
                continue
            unpublished = [env for env in envs if env not in published_envs]
            if unpublished and availability != "declared-but-unpublished-until-doc13-testnet-track":
                errors.append(f"{name}: unpublished environment mapping must be explicitly unavailable")

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
        "troubleshooting routes stable, application map valid, unpublished tracks fail closed"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
