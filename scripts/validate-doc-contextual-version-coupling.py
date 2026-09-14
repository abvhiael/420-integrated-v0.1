#!/usr/bin/env python3
"""Validate DOC-14 contextual-link coupling to DOC-13 version authority."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = ROOT / "docs" / "contextual" / "version-coupling-policy.json"


def load_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"420Docs contextual version coupling FAILED: {path}: {exc}", file=sys.stderr)
        raise SystemExit(1)
    if not isinstance(value, dict):
        print(f"420Docs contextual version coupling FAILED: {path} must contain an object", file=sys.stderr)
        raise SystemExit(1)
    return value


def main() -> int:
    policy = load_json(POLICY_PATH)
    errors: list[str] = []

    if policy.get("schema_version") != 1:
        errors.append("policy schema_version must be 1")

    contextual_path = ROOT / str(policy.get("contextual_registry", ""))
    version_path = ROOT / str(policy.get("version_registry", ""))
    contextual = load_json(contextual_path)
    versioning = load_json(version_path)

    if policy.get("require_same_environment") is not True:
        errors.append("require_same_environment must be true")
    if policy.get("allow_cross_environment_fallback") is not False:
        errors.append("allow_cross_environment_fallback must be false")
    if policy.get("allow_cross_release_fallback") is not False:
        errors.append("allow_cross_release_fallback must be false")
    if policy.get("require_published_current") is not True:
        errors.append("require_published_current must be true")
    if policy.get("require_immutable_explicit_historical_release") is not True:
        errors.append("explicit historical releases must require immutability")
    if policy.get("development_is_historical_immutable") is not False:
        errors.append("development must not be treated as an immutable historical release")

    tracks = versioning.get("tracks", {})
    aliases = versioning.get("aliases", {})
    releases = versioning.get("releases", {})
    expectations = policy.get("current_environment_expectations", {})

    if not isinstance(tracks, dict) or not isinstance(releases, dict) or not isinstance(aliases, dict):
        errors.append("version registry tracks/releases/aliases must be objects")
        tracks, releases, aliases = {}, {}, {}

    for env in ("development", "genesis", "testnet", "mainnet"):
        track = tracks.get(env)
        expectation = expectations.get(env)
        if not isinstance(track, dict):
            errors.append(f"missing version track: {env}")
            continue
        if track.get("environment") != env:
            errors.append(f"{env}: track environment mismatch")
        if not isinstance(expectation, dict):
            errors.append(f"{env}: missing policy expectation")
            continue

        current = track.get("current")
        published = track.get("published")
        if not isinstance(published, list):
            errors.append(f"{env}: published must be a list")
            published = []

        expected_current = expectation.get("current")
        expected_published = expectation.get("published")
        if current != expected_current:
            errors.append(f"{env}: current {current!r} != policy expectation {expected_current!r}")
        if bool(published) != bool(expected_published):
            errors.append(f"{env}: published presence disagrees with policy expectation")

        if current is None:
            alias_key = f"{env}/current"
            if alias_key in aliases:
                errors.append(f"{env}: current alias exists although track current is null")
        else:
            if current not in published:
                errors.append(f"{env}: current release is not published")
            alias_key = f"{env}/current"
            if aliases.get(alias_key) != current:
                errors.append(f"{env}: current alias does not point to current release")
            release = releases.get(current)
            if not isinstance(release, dict):
                errors.append(f"{env}: current release record missing: {current}")
            else:
                if release.get("environment") != env:
                    errors.append(f"{env}: current release environment mismatch")
                if "immutable" in expectation and release.get("immutable") is not expectation.get("immutable"):
                    errors.append(f"{env}: current release immutability disagrees with policy")

    records = contextual.get("records", {})
    if not isinstance(records, dict):
        errors.append("contextual registry records must be an object")
        records = {}

    known_envs = set(tracks)
    for link_id, record in sorted(records.items()):
        if not isinstance(record, dict):
            continue
        envs = record.get("environments", [])
        if not isinstance(envs, list):
            errors.append(f"{link_id}: environments must be a list")
            continue
        unknown = set(envs) - known_envs
        if unknown:
            errors.append(f"{link_id}: unknown environment(s): {sorted(unknown)}")

    # Explicitly enforce currently unpublished tracks.
    for env in ("testnet", "mainnet"):
        track = tracks.get(env, {})
        if track.get("current") is not None or track.get("published"):
            errors.append(f"{env}: expected to remain unpublished for current DOC-14.7 policy")

    development = releases.get("development", {})
    if development.get("immutable") is not False:
        errors.append("development release must remain mutable")
    genesis = releases.get("genesis", {})
    if genesis.get("immutable") is not True:
        errors.append("genesis release must remain immutable")

    if errors:
        print(f"420Docs contextual version coupling FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        "420Docs contextual version coupling PASS: "
        f"{len(records)} contextual record(s), published current aliases development/genesis, "
        "testnet/mainnet fail closed"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
