#!/usr/bin/env python3
"""Validate DOC-13.4 version URL and renderer invariants."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "docs" / "versioning" / "url-renderer-policy.json"
REGISTRY = ROOT / "docs" / "versioning" / "version-registry.json"
RENDERER = ROOT / "scripts" / "render-doc-version-context.py"


def fail(message: str) -> None:
    print(f"420Docs version routing ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"cannot read {path.relative_to(ROOT)}: {exc}")
    if not isinstance(value, dict):
        fail(f"{path.relative_to(ROOT)} must contain a JSON object")
    return value


def resolve(route: str) -> dict:
    result = subprocess.run(
        [sys.executable, str(RENDERER), "--route", route],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        fail(f"resolver failed for {route}: {result.stderr.strip()}")
    try:
        value = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        fail(f"resolver returned invalid JSON for {route}: {exc}")
    return value


def main() -> int:
    policy = load(POLICY)
    registry = load(REGISTRY)
    errors: list[str] = []

    if policy.get("cross_environment_fallback") is not False:
        errors.append("cross-environment fallback must be disabled")
    if policy.get("cross_release_fallback") is not False:
        errors.append("cross-release fallback must be disabled")
    if policy.get("unknown_route_behavior") != "not-found":
        errors.append("unknown version routes must fail as not-found")
    if policy.get("missing_page_behavior") != "not-found":
        errors.append("missing versioned pages must fail as not-found")

    tracks = registry.get("tracks", {})
    published_checks = 0
    for environment, track in sorted(tracks.items()):
        if not isinstance(track, dict):
            errors.append(f"track {environment} must be an object")
            continue
        published = track.get("published", [])
        current = track.get("current")
        if current is None:
            probe = resolve(f"/versions/{environment}/current/index.html")
            if probe.get("status") != "not-found":
                errors.append(f"unpublished track {environment} unexpectedly resolves current")
            continue
        alias = resolve(f"/versions/{environment}/current/index.html")
        if alias.get("status") != "resolved" or alias.get("release") != current:
            errors.append(f"current alias for {environment} does not resolve to {current}")
        for release_id in published:
            release = registry.get("releases", {}).get(release_id, {})
            probe = resolve(f"/versions/{environment}/{release_id}/index.html")
            if release.get("immutable"):
                if probe.get("status") != "resolved":
                    errors.append(f"immutable published release {environment}/{release_id} did not resolve")
                published_checks += 1
            else:
                if probe.get("status") != "not-found":
                    errors.append(f"mutable release {environment}/{release_id} exposed as immutable route")

    unknown = resolve("/versions/mainnet/not-a-release/index.html")
    if unknown.get("status") != "not-found":
        errors.append("unknown release did not fail closed")

    legacy = resolve("/developers/index.html")
    if legacy.get("status") != "legacy-or-unversioned":
        errors.append("legacy flat URL classification changed unexpectedly")

    check = subprocess.run(
        [sys.executable, str(RENDERER), "--check"], cwd=ROOT, text=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False
    )
    if check.returncode != 0:
        errors.append(f"renderer manifest check failed: {check.stderr.strip()}")

    if errors:
        print(f"420Docs version routing FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        "420Docs version routing PASS: "
        f"{len(tracks)} track(s) checked; {published_checks} immutable release route(s); "
        "unknown/unpublished routes fail closed"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
