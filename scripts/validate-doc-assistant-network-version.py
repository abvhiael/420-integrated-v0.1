#!/usr/bin/env python3
"""Validate DOC-15.5 Ask 420 network/version policy against DOC-13."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "docs" / "assistant" / "network-version-policy.json"
VERSIONS = ROOT / "docs" / "versioning" / "version-registry.json"
GENESIS = ROOT / "docs" / "versioning" / "releases" / "genesis.json"


def load(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path.relative_to(ROOT)} must contain an object")
    return value


def main() -> int:
    errors: list[str] = []
    try:
        policy = load(POLICY)
        versions = load(VERSIONS)
        genesis = load(GENESIS)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"Ask 420 network/version FAILED: {exc}", file=sys.stderr)
        return 1

    if policy.get("schema_version") != 1:
        errors.append("policy schema_version must be 1")
    if policy.get("authority") != "docs/versioning/version-registry.json":
        errors.append("policy authority must point to DOC-13 version registry")

    tracks = policy.get("tracks", {})
    version_tracks = versions.get("tracks", {})
    for name in ("development", "genesis", "testnet", "mainnet"):
        spec = tracks.get(name)
        source = version_tracks.get(name)
        if not isinstance(spec, dict) or not isinstance(source, dict):
            errors.append(f"missing track {name}")
            continue
        published = bool(source.get("published"))
        if spec.get("published") is not published:
            errors.append(f"{name}: published flag does not match DOC-13")
        expected_release = source.get("current")
        if spec.get("release") != expected_release:
            errors.append(f"{name}: release does not match DOC-13 current value")

    aliases = versions.get("aliases", {})
    if aliases.get("development/current") != "development":
        errors.append("development/current alias must resolve to development")
    if aliases.get("genesis/current") != "genesis":
        errors.append("genesis/current alias must resolve to genesis")
    if "testnet/current" in aliases or "mainnet/current" in aliases:
        errors.append("unpublished testnet/mainnet current aliases must not exist")

    releases = versions.get("releases", {})
    genesis_release = releases.get("genesis", {})
    if not isinstance(genesis_release, dict) or genesis_release.get("immutable") is not True:
        errors.append("Genesis release must remain immutable")
    if genesis.get("generated_reference", {}).get("mode") != "unavailable":
        errors.append("Genesis generated reference must remain unavailable until a release snapshot exists")

    rules = policy.get("rules", {})
    required_false = (
        "cross_environment_fallback",
        "implicit_cross_release_fallback",
        "development_as_genesis_authority",
        "development_as_testnet_authority",
        "development_as_mainnet_authority",
        "documentation_proves_live_runtime_state",
    )
    for key in required_false:
        if rules.get(key) is not False:
            errors.append(f"rule {key} must be false")
    if rules.get("historical_requires_immutable_published_release") is not True:
        errors.append("historical release rule must require immutable published release")

    if errors:
        print(f"Ask 420 network/version FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("Ask 420 network/version PASS: published development/Genesis only; testnet/mainnet fail closed; Genesis history immutable")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
