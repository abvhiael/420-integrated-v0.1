#!/usr/bin/env python3
"""Validate DOC-13 historical retention and archival invariants."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "docs/versioning/version-registry.json"
POLICY = ROOT / "docs/versioning/historical-retention-policy.json"


def load(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"420Docs historical retention ERROR: cannot read {path.relative_to(ROOT)}: {exc}", file=sys.stderr)
        raise SystemExit(1)
    if not isinstance(value, dict):
        print(f"420Docs historical retention ERROR: {path.relative_to(ROOT)} must be an object", file=sys.stderr)
        raise SystemExit(1)
    return value


def main() -> int:
    registry = load(REGISTRY)
    policy = load(POLICY)
    releases = registry.get("releases", {})
    tracks = registry.get("tracks", {})
    errors: list[str] = []
    retained = 0

    for track_name, track in tracks.items():
        if not isinstance(track, dict):
            errors.append(f"track {track_name}: must be an object")
            continue
        env = track.get("environment")
        published = track.get("published", [])
        current = track.get("current")
        if current is not None:
            if current not in published:
                errors.append(f"track {track_name}: current release '{current}' is not published")
            release = releases.get(current)
            if not isinstance(release, dict):
                errors.append(f"track {track_name}: current release '{current}' has no release record")
            elif release.get("environment") != env:
                errors.append(f"track {track_name}: current release environment mismatch")

    for release_id, release in releases.items():
        if not isinstance(release, dict):
            errors.append(f"release {release_id}: must be an object")
            continue
        status = release.get("publication_status")
        immutable = bool(release.get("immutable", False))
        env = release.get("environment")
        if status in {"historical", "deprecated"}:
            retained += 1
            if not immutable:
                errors.append(f"release {release_id}: {status} release must be immutable")
            track = tracks.get(env)
            if not isinstance(track, dict) or release_id not in track.get("published", []):
                errors.append(f"release {release_id}: {status} release must remain published by immutable ID")
            if track and track.get("current") == release_id:
                errors.append(f"release {release_id}: {status} release cannot be the track current alias target")

    labels = policy.get("banner_labels", {})
    for status in policy.get("unsupported_statuses", []):
        if not isinstance(labels.get(status), str) or not labels.get(status, "").strip():
            errors.append(f"policy: missing renderer banner label for {status}")

    if policy.get("unsupported_route_behavior") != "retained-by-immutable-release-or-explicit-tombstone":
        errors.append("policy: unsupported_route_behavior must fail closed to retained release or tombstone")

    if errors:
        print(f"420Docs historical retention FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        "420Docs historical retention PASS: "
        f"{len(tracks)} track(s); {len(releases)} release record(s); {retained} retained historical/deprecated release(s)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
