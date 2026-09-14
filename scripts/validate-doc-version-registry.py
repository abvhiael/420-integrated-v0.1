#!/usr/bin/env python3
"""Validate DOC-13 documentation version registry and release manifests."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "docs" / "versioning" / "version-registry.json"
REQUIRED_TRACKS = ("development", "genesis", "testnet", "mainnet")


def fail(message: str) -> None:
    print(f"420Docs version registry ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_json(path: Path, label: str) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"cannot read {label} {path.relative_to(ROOT)}: {exc}")
    if not isinstance(value, dict):
        fail(f"{label} must be a JSON object")
    return value


def main() -> int:
    registry = load_json(REGISTRY_PATH, "version registry")
    tracks = registry.get("tracks")
    releases = registry.get("releases")
    aliases = registry.get("aliases")
    if not isinstance(tracks, dict):
        fail("registry tracks must be an object")
    if not isinstance(releases, dict):
        fail("registry releases must be an object")
    if not isinstance(aliases, dict):
        fail("registry aliases must be an object")

    errors: list[str] = []
    manifest_count = 0
    published_count = 0

    for track_name in REQUIRED_TRACKS:
        track = tracks.get(track_name)
        if not isinstance(track, dict):
            errors.append(f"missing required track '{track_name}'")
            continue
        if track.get("environment") != track_name:
            errors.append(f"track '{track_name}' environment must equal '{track_name}'")
        published = track.get("published")
        if not isinstance(published, list) or any(not isinstance(v, str) or not v for v in published):
            errors.append(f"track '{track_name}' published must be a list of release identifiers")
            published = []
        if len(set(published)) != len(published):
            errors.append(f"track '{track_name}' published contains duplicates")
        current = track.get("current")
        if current is not None and current not in published:
            errors.append(f"track '{track_name}' current '{current}' is not in published releases")
        if not published and current is not None:
            errors.append(f"track '{track_name}' has current release but no published releases")

        for release_id in published:
            published_count += 1
            release = releases.get(release_id)
            if not isinstance(release, dict):
                errors.append(f"published release '{release_id}' has no registry release record")
                continue
            if release.get("environment") != track_name:
                errors.append(
                    f"release '{release_id}' environment '{release.get('environment')}' does not match track '{track_name}'"
                )
            manifest_rel = release.get("manifest")
            if not isinstance(manifest_rel, str) or not manifest_rel:
                errors.append(f"release '{release_id}' has no manifest path")
                continue
            manifest_path = ROOT / manifest_rel
            if not manifest_path.is_file():
                errors.append(f"release '{release_id}' manifest missing: {manifest_rel}")
                continue
            manifest_count += 1
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                errors.append(f"release '{release_id}' manifest unreadable: {manifest_rel}: {exc}")
                continue
            if not isinstance(manifest, dict):
                errors.append(f"release '{release_id}' manifest must be a JSON object")
                continue
            for field in ("release", "environment", "publication_status", "immutable"):
                if manifest.get(field) != release.get(field if field != "release" else "__missing__") and field != "release":
                    errors.append(
                        f"release '{release_id}' manifest field '{field}' does not match registry record"
                    )
            if manifest.get("release") != release_id:
                errors.append(f"release '{release_id}' manifest release field must equal registry key")
            if manifest.get("environment") != release.get("environment"):
                errors.append(f"release '{release_id}' manifest environment mismatch")
            if manifest.get("publication_status") != release.get("publication_status"):
                errors.append(f"release '{release_id}' manifest publication_status mismatch")
            if manifest.get("immutable") is not release.get("immutable"):
                errors.append(f"release '{release_id}' manifest immutable mismatch")
            evidence = manifest.get("evidence")
            if not isinstance(evidence, list) or not evidence:
                errors.append(f"release '{release_id}' manifest must declare evidence paths")
            else:
                for evidence_rel in evidence:
                    if not isinstance(evidence_rel, str) or not evidence_rel:
                        errors.append(f"release '{release_id}' manifest has invalid evidence entry")
                    elif not (ROOT / evidence_rel).is_file():
                        errors.append(f"release '{release_id}' evidence path missing: {evidence_rel}")
            for authority_field in ("network_authority", "deployment_authority"):
                if not isinstance(manifest.get(authority_field), bool):
                    errors.append(f"release '{release_id}' manifest {authority_field} must be boolean")

    for release_id, release in releases.items():
        if not isinstance(release, dict):
            errors.append(f"release record '{release_id}' must be an object")
            continue
        env = release.get("environment")
        if env not in REQUIRED_TRACKS:
            errors.append(f"release '{release_id}' has unknown environment '{env}'")
            continue
        published = tracks.get(env, {}).get("published", []) if isinstance(tracks.get(env), dict) else []
        if release_id not in published:
            errors.append(f"release record '{release_id}' is not listed as published in track '{env}'")

    for alias, target in aliases.items():
        if not isinstance(alias, str) or "/" not in alias:
            errors.append(f"alias '{alias}' must use '<track>/<alias>' form")
            continue
        track_name, _ = alias.split("/", 1)
        if track_name not in REQUIRED_TRACKS:
            errors.append(f"alias '{alias}' references unknown track '{track_name}'")
            continue
        if not isinstance(target, str) or target not in releases:
            errors.append(f"alias '{alias}' targets unknown release '{target}'")
            continue
        release = releases[target]
        if not isinstance(release, dict) or release.get("environment") != track_name:
            errors.append(f"alias '{alias}' crosses environment/track boundary")
            continue
        track = tracks.get(track_name, {})
        published = track.get("published", []) if isinstance(track, dict) else []
        if target not in published:
            errors.append(f"alias '{alias}' targets unpublished release '{target}'")

    if errors:
        print(f"420Docs version registry FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    unavailable = [name for name in REQUIRED_TRACKS if not tracks[name].get("published")]
    print(
        "420Docs version registry PASS: "
        f"{len(REQUIRED_TRACKS)} track(s); {published_count} published release binding(s); "
        f"{manifest_count} release manifest(s); unavailable tracks={','.join(unavailable) or 'none'}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
