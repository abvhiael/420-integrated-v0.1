#!/usr/bin/env python3
"""Validate DOC-10 generated-reference family/source/navigation integration."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "docs" / "ci" / "generated-reference-policy.json"
LINK = re.compile(r"(?<!!)\[[^\]]*\]\(([^)]+)\)")


def fail(message: str) -> None:
    print(f"420Docs generated reference integration ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_json(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"cannot read {path.relative_to(ROOT).as_posix()}: {exc}")
    if not isinstance(data, dict):
        fail(f"{path.relative_to(ROOT).as_posix()} must contain an object")
    return data


def main() -> int:
    policy = load_json(POLICY)
    errors: list[str] = []

    registry_rel = policy.get("source_registry")
    index_rel = policy.get("reference_index")
    families = policy.get("required_families")
    required_outputs = policy.get("required_outputs")

    if not isinstance(registry_rel, str) or not isinstance(index_rel, str):
        fail("source_registry and reference_index must be strings")
    if not isinstance(families, dict) or not families:
        fail("required_families must be a non-empty object")
    if not isinstance(required_outputs, list) or not all(isinstance(x, str) for x in required_outputs):
        fail("required_outputs must be a list of paths")

    registry_path = ROOT / registry_rel
    index_path = ROOT / index_rel
    if not registry_path.is_file():
        errors.append(f"source registry missing: {registry_rel}")
        registry = {}
    else:
        registry = load_json(registry_path)

    if not index_path.is_file():
        errors.append(f"reference index missing: {index_rel}")
        index_text = ""
    else:
        index_text = index_path.read_text(encoding="utf-8")

    registry_families = registry.get("families", []) if isinstance(registry, dict) else []
    by_id: dict[str, dict] = {}
    if not isinstance(registry_families, list):
        errors.append(f"{registry_rel}: families must be a list")
        registry_families = []

    for item in registry_families:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str):
            errors.append(f"{registry_rel}: malformed family entry")
            continue
        family_id = item["id"]
        if family_id in by_id:
            errors.append(f"{registry_rel}: duplicate family id {family_id}")
        by_id[family_id] = item

    expected_ids = set(families)
    actual_ids = set(by_id)
    for missing in sorted(expected_ids - actual_ids):
        errors.append(f"{registry_rel}: required family missing: {missing}")
    for unexpected in sorted(actual_ids - expected_ids):
        errors.append(f"{registry_rel}: ungoverned generated-reference family: {unexpected}")

    for family_id, output_rel in sorted(families.items()):
        if not isinstance(output_rel, str):
            errors.append(f"policy family {family_id}: output path must be a string")
            continue
        output_path = ROOT / output_rel
        if not output_path.is_file():
            errors.append(f"generated output missing for {family_id}: {output_rel}")
        family = by_id.get(family_id)
        if family is None:
            continue
        sources = family.get("sources")
        if not isinstance(sources, list) or not sources or not all(isinstance(x, str) for x in sources):
            errors.append(f"{registry_rel}: family {family_id} must declare one or more source paths")
            continue
        for source_rel in sources:
            if not (ROOT / source_rel).exists():
                errors.append(f"{registry_rel}: family {family_id} source missing: {source_rel}")

    output_set = set(required_outputs)
    family_output_set = {value for value in families.values() if isinstance(value, str)}
    missing_family_outputs = sorted(family_output_set - output_set)
    for path in missing_family_outputs:
        errors.append(f"policy required_outputs omits family output: {path}")

    for output_rel in sorted(output_set):
        output_path = ROOT / output_rel
        if not output_path.is_file():
            errors.append(f"required generated output missing: {output_rel}")

    linked_targets: set[str] = set()
    for raw in LINK.findall(index_text):
        target = raw.strip().split(maxsplit=1)[0].split("#", 1)[0]
        if not target or "://" in target or target.startswith("mailto:"):
            continue
        candidate = (index_path.parent / target).resolve()
        try:
            linked_targets.add(candidate.relative_to(ROOT).as_posix())
        except ValueError:
            continue

    for output_rel in sorted(output_set):
        if output_rel not in linked_targets:
            errors.append(f"{index_rel}: generated output is not directly discoverable: {output_rel}")

    freshness_command = policy.get("freshness_command")
    expected_command = ["python", "scripts/qualify-generated-reference.py", "--check"]
    if freshness_command != expected_command:
        errors.append(
            "generated-reference freshness command changed unexpectedly; "
            f"expected {expected_command!r}, got {freshness_command!r}"
        )

    if errors:
        print(f"420Docs generated reference integration FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    source_count = sum(len(item.get("sources", [])) for item in by_id.values())
    print(
        f"420Docs generated reference integration PASS: {len(expected_ids)} family(s); "
        f"{len(output_set)} output(s); {source_count} declared source path(s); "
        "all outputs linked from reference index"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
