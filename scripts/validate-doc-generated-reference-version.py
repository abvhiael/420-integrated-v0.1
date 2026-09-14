#!/usr/bin/env python3
"""Validate DOC-13 generated-reference release/environment coupling."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "docs" / "versioning" / "version-registry.json"
POLICY = ROOT / "docs" / "versioning" / "generated-reference-version-policy.json"


def fatal(message: str) -> None:
    print(f"420Docs generated-reference version ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_json(path: Path, label: str) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fatal(f"cannot read {label} {path.relative_to(ROOT)}: {exc}")
    if not isinstance(value, dict):
        fatal(f"{label} must be a JSON object")
    return value


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    registry = load_json(REGISTRY, "version registry")
    policy = load_json(POLICY, "generated-reference version policy")
    governed = list(policy.get("governed_outputs", []))
    if not governed or not all(isinstance(item, str) for item in governed):
        fatal("governed_outputs must be a non-empty string list")

    allowed_modes = set(policy.get("allowed_modes", []))
    live_release = policy.get("live_mode_release")
    live_environment = policy.get("live_mode_environment")
    source_registry = policy.get("source_registry")
    live_root = policy.get("live_generated_root")
    errors: list[str] = []
    checked = 0

    for release_id, record in sorted(registry.get("releases", {}).items()):
        if not isinstance(record, dict):
            errors.append(f"release {release_id}: registry record must be an object")
            continue
        manifest_path = ROOT / str(record.get("manifest", ""))
        if not manifest_path.is_file():
            errors.append(f"release {release_id}: manifest missing: {record.get('manifest')}")
            continue
        manifest = load_json(manifest_path, f"release {release_id} manifest")
        generated = manifest.get("generated_reference")
        if not isinstance(generated, dict):
            errors.append(f"release {release_id}: generated_reference object is required")
            continue
        checked += 1
        mode = generated.get("mode")
        environment = manifest.get("environment")
        if mode not in allowed_modes:
            errors.append(f"release {release_id}: generated_reference mode '{mode}' is not allowed")
            continue
        if generated.get("environment") != environment:
            errors.append(f"release {release_id}: generated reference environment does not match release manifest")

        if mode == "live":
            if release_id != live_release or environment != live_environment:
                errors.append(f"release {release_id}: live generated reference is allowed only for {live_release}/{live_environment}")
            if manifest.get("immutable"):
                errors.append(f"release {release_id}: immutable release cannot use live generated reference")
            if generated.get("source_registry") != source_registry:
                errors.append(f"release {release_id}: live source registry must be {source_registry}")
            if generated.get("generated_root") != live_root:
                errors.append(f"release {release_id}: live generated root must be {live_root}")
            outputs = generated.get("outputs")
            if outputs != governed:
                errors.append(f"release {release_id}: live outputs must exactly match governed output order")
            root = ROOT / str(live_root)
            for name in governed:
                if not (root / name).is_file():
                    errors.append(f"release {release_id}: governed live output missing: {live_root}/{name}")
            if generated.get("network_authority") is not False or generated.get("deployment_authority") is not False:
                errors.append(f"release {release_id}: current live generated reference must not claim network/deployment authority")

        elif mode == "snapshot":
            if policy.get("snapshot_requires_immutable_release", True) and not manifest.get("immutable"):
                errors.append(f"release {release_id}: snapshot mode requires immutable release")
            snapshot_root_raw = generated.get("snapshot_root")
            provenance_raw = generated.get("provenance_manifest")
            if not isinstance(snapshot_root_raw, str) or not snapshot_root_raw:
                errors.append(f"release {release_id}: snapshot_root is required")
                continue
            if not isinstance(provenance_raw, str) or not provenance_raw:
                errors.append(f"release {release_id}: provenance_manifest is required")
                continue
            snapshot_root = ROOT / snapshot_root_raw
            provenance_path = ROOT / provenance_raw
            if not snapshot_root.is_dir():
                errors.append(f"release {release_id}: snapshot root missing: {snapshot_root_raw}")
                continue
            if not provenance_path.is_file():
                errors.append(f"release {release_id}: provenance manifest missing: {provenance_raw}")
                continue
            provenance = load_json(provenance_path, f"release {release_id} provenance")
            if provenance.get("release") != release_id or provenance.get("environment") != environment:
                errors.append(f"release {release_id}: provenance release/environment mismatch")
            hashes = provenance.get("sha256")
            if not isinstance(hashes, dict):
                errors.append(f"release {release_id}: provenance sha256 map is required")
                continue
            if set(hashes) != set(governed):
                errors.append(f"release {release_id}: provenance hashes must cover exactly all governed outputs")
                continue
            for name in governed:
                path = snapshot_root / name
                if not path.is_file():
                    errors.append(f"release {release_id}: snapshot output missing: {snapshot_root_raw}/{name}")
                elif hashes.get(name) != sha256_file(path):
                    errors.append(f"release {release_id}: snapshot hash mismatch: {name}")

        elif mode == "unavailable":
            if not isinstance(generated.get("reason"), str) or not generated.get("reason", "").strip():
                errors.append(f"release {release_id}: unavailable generated reference requires a reason")

    if errors:
        print(f"420Docs generated-reference version FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        "420Docs generated-reference version PASS: "
        f"{checked} release manifest(s) checked; live reference restricted to {live_release}/{live_environment}; "
        "immutable releases require snapshot provenance or explicit unavailable state"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
