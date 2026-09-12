#!/usr/bin/env python3
"""Resolve DOC-13 version routes and emit deterministic renderer context."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "docs" / "versioning" / "version-registry.json"
POLICY = ROOT / "docs" / "versioning" / "url-renderer-policy.json"


def load_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"cannot read {path.relative_to(ROOT)}: {exc}") from exc
    if not isinstance(value, dict):
        raise RuntimeError(f"{path.relative_to(ROOT)} must contain a JSON object")
    return value


def published_context(registry: dict, policy: dict) -> dict:
    tracks_out: dict[str, dict] = {}
    for track_name, track in sorted(registry.get("tracks", {}).items()):
        if not isinstance(track, dict):
            continue
        environment = track.get("environment")
        published = track.get("published", [])
        current = track.get("current")
        if not isinstance(environment, str) or not isinstance(published, list):
            continue
        release_items = []
        for release_id in published:
            release = registry.get("releases", {}).get(release_id)
            if not isinstance(release, dict):
                continue
            if release.get("environment") != environment:
                continue
            release_items.append({
                "id": release_id,
                "immutable": bool(release.get("immutable", False)),
                "publication_status": release.get("publication_status"),
                "path_template": policy["immutable_route"].format(
                    environment=environment, release=release_id, path="{path}"
                ),
            })
        if not release_items:
            continue
        current_route = None
        if isinstance(current, str) and current in published:
            current_route = policy["alias_route"].format(
                environment=environment, path="{path}"
            )
        tracks_out[track_name] = {
            "environment": environment,
            "current": current,
            "current_route": current_route,
            "releases": release_items,
        }
    return {
        "schema_version": 1,
        "route_prefix": policy.get("route_prefix", "versions"),
        "unknown_route_behavior": policy.get("unknown_route_behavior", "not-found"),
        "missing_page_behavior": policy.get("missing_page_behavior", "not-found"),
        "cross_environment_fallback": bool(policy.get("cross_environment_fallback", False)),
        "cross_release_fallback": bool(policy.get("cross_release_fallback", False)),
        "tracks": tracks_out,
    }


def resolve_route(route: str, registry: dict, policy: dict) -> dict:
    clean = "/" + route.strip().lstrip("/")
    prefix = "/" + str(policy.get("route_prefix", "versions")).strip("/") + "/"
    if not clean.startswith(prefix):
        return {"status": "legacy-or-unversioned", "route": clean}

    parts = clean[len(prefix):].split("/", 2)
    if len(parts) < 2:
        return {"status": "not-found", "reason": "incomplete-version-route", "route": clean}
    environment, release_token = parts[0], parts[1]
    page_path = parts[2] if len(parts) == 3 else ""

    track = registry.get("tracks", {}).get(environment)
    if not isinstance(track, dict) or track.get("environment") != environment:
        return {"status": "not-found", "reason": "unknown-environment", "route": clean}

    if release_token == "current":
        release_id = track.get("current")
        if not isinstance(release_id, str):
            return {"status": "not-found", "reason": "unpublished-current-track", "route": clean}
        source = "alias"
    else:
        release_id = release_token
        source = "immutable"

    if release_id not in track.get("published", []):
        return {"status": "not-found", "reason": "unpublished-release", "route": clean}
    release = registry.get("releases", {}).get(release_id)
    if not isinstance(release, dict) or release.get("environment") != environment:
        return {"status": "not-found", "reason": "release-environment-mismatch", "route": clean}
    if source == "immutable" and not bool(release.get("immutable", False)):
        return {"status": "not-found", "reason": "release-is-not-immutable", "route": clean}

    return {
        "status": "resolved",
        "route": clean,
        "environment": environment,
        "release": release_id,
        "source": source,
        "page_path": page_path,
        "publication_status": release.get("publication_status"),
        "immutable": bool(release.get("immutable", False)),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site-dir", help="write version-context.json into this built site directory")
    parser.add_argument("--route", help="resolve one route and print JSON")
    parser.add_argument("--check", action="store_true", help="validate inputs and emit no file")
    args = parser.parse_args()

    try:
        registry = load_json(REGISTRY)
        policy = load_json(POLICY)
        manifest = published_context(registry, policy)
    except RuntimeError as exc:
        print(f"420Docs version renderer ERROR: {exc}", file=sys.stderr)
        return 1

    if args.route:
        print(json.dumps(resolve_route(args.route, registry, policy), sort_keys=True))
        return 0

    if args.site_dir:
        site_dir = Path(args.site_dir)
        site_dir.mkdir(parents=True, exist_ok=True)
        output = site_dir / "version-context.json"
        output.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"420Docs version renderer PASS: wrote {output}")
        return 0

    if args.check:
        print(
            "420Docs version renderer PASS: "
            f"{len(manifest['tracks'])} published track(s) exposed; fallback disabled"
        )
        return 0

    print(json.dumps(manifest, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
