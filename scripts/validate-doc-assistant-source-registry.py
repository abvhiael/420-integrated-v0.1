#!/usr/bin/env python3
"""Validate the DOC-15 Ask 420 retrieval source registry."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
REGISTRY = DOCS / "assistant" / "source-registry.json"
VERSIONS = DOCS / "versioning" / "version-registry.json"
SOURCE_ID = re.compile(r"^SRC-[A-Z0-9]+(?:-[A-Z0-9]+)*$")

ALLOWED_CLASSES = {"canonical", "generated", "historical", "compatibility"}
ALLOWED_ANSWER_USE = {
    "authoritative",
    "authoritative-with-provenance",
    "authoritative-historical",
    "navigation-only",
}


def load(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"cannot read {path.relative_to(ROOT)}: {exc}") from exc
    if not isinstance(value, dict):
        raise RuntimeError(f"{path.relative_to(ROOT)} must contain a JSON object")
    return value


def exists_repo_path(rel: str) -> bool:
    return (ROOT / rel).exists()


def main() -> int:
    errors: list[str] = []
    try:
        registry = load(REGISTRY)
        versions = load(VERSIONS)
    except RuntimeError as exc:
        print(f"420Docs assistant source registry FAILED: {exc}", file=sys.stderr)
        return 1

    classes = registry.get("classes")
    if not isinstance(classes, dict):
        classes = {}
        errors.append("classes must be an object")

    for class_name in ALLOWED_CLASSES:
        spec = classes.get(class_name)
        if not isinstance(spec, dict):
            errors.append(f"missing class definition: {class_name}")
            continue
        authoritative = spec.get("authoritative")
        if not isinstance(authoritative, bool):
            errors.append(f"class {class_name}: authoritative must be boolean")
        if class_name == "compatibility" and authoritative is not False:
            errors.append("compatibility class must not be authoritative")
        if class_name in {"canonical", "generated", "historical"} and authoritative is not True:
            errors.append(f"class {class_name} must be authoritative")

    tracks = versions.get("tracks", {})
    published_envs = {
        env
        for env, spec in tracks.items()
        if isinstance(spec, dict) and isinstance(spec.get("published"), list) and spec.get("published")
    }
    releases = versions.get("releases", {}) if isinstance(versions.get("releases"), dict) else {}

    collections = registry.get("collections")
    if not isinstance(collections, list) or not collections:
        collections = []
        errors.append("collections must be a non-empty array")

    seen_ids: set[str] = set()
    for item in collections:
        if not isinstance(item, dict):
            errors.append("collection entries must be objects")
            continue
        source_id = item.get("id")
        if not isinstance(source_id, str) or not SOURCE_ID.fullmatch(source_id):
            errors.append(f"invalid source id: {source_id!r}")
            continue
        if source_id in seen_ids:
            errors.append(f"duplicate source id: {source_id}")
        seen_ids.add(source_id)

        class_name = item.get("class")
        if class_name not in ALLOWED_CLASSES:
            errors.append(f"{source_id}: invalid class {class_name!r}")

        answer_use = item.get("answer_use")
        if answer_use not in ALLOWED_ANSWER_USE:
            errors.append(f"{source_id}: invalid answer_use {answer_use!r}")
        if class_name == "compatibility" and answer_use != "navigation-only":
            errors.append(f"{source_id}: compatibility sources must be navigation-only")

        roots = item.get("roots")
        if not isinstance(roots, list) or not roots:
            errors.append(f"{source_id}: roots must be a non-empty array")
        else:
            for rel in roots:
                if not isinstance(rel, str) or not rel.startswith("docs/"):
                    errors.append(f"{source_id}: invalid documentation root {rel!r}")
                elif not exists_repo_path(rel):
                    errors.append(f"{source_id}: registered root does not exist: {rel}")

        envs = item.get("environments")
        if not isinstance(envs, list) or not envs:
            errors.append(f"{source_id}: environments must be a non-empty array")
            envs = []
        for env in envs:
            if env not in tracks:
                errors.append(f"{source_id}: unknown environment {env!r}")
            if class_name != "compatibility" and env not in published_envs:
                errors.append(f"{source_id}: authoritative collection exposes unpublished environment {env}")

        governed_by = item.get("governed_by")
        if governed_by is not None:
            if not isinstance(governed_by, str) or not exists_repo_path(governed_by):
                errors.append(f"{source_id}: governed_by target missing: {governed_by!r}")

        if class_name == "generated":
            if envs != ["development"]:
                errors.append(f"{source_id}: live generated reference must be development-only")
            if answer_use != "authoritative-with-provenance":
                errors.append(f"{source_id}: generated source must require provenance")

        if class_name == "historical":
            release = item.get("release")
            release_spec = releases.get(release) if isinstance(release, str) else None
            if not isinstance(release_spec, dict):
                errors.append(f"{source_id}: historical release is not registered: {release!r}")
            else:
                if release_spec.get("immutable") is not True:
                    errors.append(f"{source_id}: historical release must be immutable")
                if release_spec.get("environment") not in envs:
                    errors.append(f"{source_id}: release environment must be included in collection environments")

    excluded = registry.get("excluded")
    if not isinstance(excluded, list):
        excluded = []
        errors.append("excluded must be an array")

    excluded_envs: set[str] = set()
    for item in excluded:
        if not isinstance(item, dict):
            continue
        envs = item.get("environments")
        if isinstance(envs, list):
            excluded_envs.update(env for env in envs if isinstance(env, str))

    for env in ("testnet", "mainnet"):
        track = tracks.get(env, {})
        if isinstance(track, dict) and not track.get("published") and env not in excluded_envs:
            errors.append(f"unpublished environment {env} must be explicitly excluded")

    if errors:
        print(f"420Docs assistant source registry FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        "420Docs assistant source registry PASS: "
        f"{len(seen_ids)} collection(s); published environments={','.join(sorted(published_envs))}; "
        "testnet/mainnet excluded until published"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
