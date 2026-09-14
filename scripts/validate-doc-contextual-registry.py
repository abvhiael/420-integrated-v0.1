#!/usr/bin/env python3
"""Validate the DOC-14 contextual-link registry deterministically."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
REGISTRY_PATH = DOCS / "contextual" / "contextual-link-registry.json"
ID_RE = re.compile(r"^CTX-[A-Z0-9]+-[0-9]{3}$")
ALLOWED_STATUS = {"active", "deprecated", "retired"}
ALLOWED_TARGET_TYPES = {"task", "concept", "reference", "troubleshooting"}
ALLOWED_AUDIENCES = {"user", "developer", "operator"}
ALLOWED_ENVIRONMENTS = {"development", "genesis", "testnet", "mainnet"}


def load_registry() -> dict:
    try:
        value = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"420Docs contextual registry FAILED: cannot read registry: {exc}", file=sys.stderr)
        raise SystemExit(1)
    if not isinstance(value, dict):
        print("420Docs contextual registry FAILED: top-level value must be an object", file=sys.stderr)
        raise SystemExit(1)
    return value


def list_of_strings(value: object) -> bool:
    return isinstance(value, list) and bool(value) and all(isinstance(item, str) and item for item in value)


def main() -> int:
    registry = load_registry()
    errors: list[str] = []

    if registry.get("schema_version") != 1:
        errors.append("schema_version must be 1")

    records = registry.get("records")
    if not isinstance(records, dict) or not records:
        errors.append("records must be a non-empty object")
        records = {}

    canonical_ids = set(records)
    aliases: dict[str, str] = {}

    for link_id, record in sorted(records.items()):
        if not isinstance(link_id, str) or not ID_RE.fullmatch(link_id):
            errors.append(f"invalid contextual-link ID: {link_id}")
            continue
        if not isinstance(record, dict):
            errors.append(f"{link_id}: record must be an object")
            continue

        status = record.get("status")
        if status not in ALLOWED_STATUS:
            errors.append(f"{link_id}: invalid status {status!r}")

        surfaces = record.get("source_surfaces")
        if not list_of_strings(surfaces):
            errors.append(f"{link_id}: source_surfaces must be a non-empty string list")

        target_type = record.get("target_type")
        if target_type not in ALLOWED_TARGET_TYPES:
            errors.append(f"{link_id}: invalid target_type {target_type!r}")

        audience = record.get("audience")
        if not list_of_strings(audience):
            errors.append(f"{link_id}: audience must be a non-empty string list")
        elif not set(audience) <= ALLOWED_AUDIENCES:
            errors.append(f"{link_id}: audience contains unsupported value(s)")

        environments = record.get("environments")
        if not list_of_strings(environments):
            errors.append(f"{link_id}: environments must be a non-empty string list")
        elif not set(environments) <= ALLOWED_ENVIRONMENTS:
            errors.append(f"{link_id}: environments contains unsupported value(s)")

        target = record.get("target")
        if not isinstance(target, dict):
            errors.append(f"{link_id}: target must be an object")
        else:
            path_value = target.get("path")
            if not isinstance(path_value, str) or not path_value:
                errors.append(f"{link_id}: target.path must be a non-empty string")
            else:
                path = Path(path_value)
                if path.is_absolute() or ".." in path.parts:
                    errors.append(f"{link_id}: target.path must stay within docs/: {path_value}")
                elif not (DOCS / path).is_file():
                    errors.append(f"{link_id}: target.path does not exist: docs/{path_value}")
            anchor = target.get("anchor")
            if anchor is not None and (not isinstance(anchor, str) or not anchor or anchor.startswith("#")):
                errors.append(f"{link_id}: target.anchor must be a non-empty fragment without leading #")

        record_aliases = record.get("aliases", [])
        if not isinstance(record_aliases, list) or not all(isinstance(alias, str) and alias for alias in record_aliases):
            errors.append(f"{link_id}: aliases must be a string list")
        else:
            for alias in record_aliases:
                if alias in canonical_ids:
                    errors.append(f"{link_id}: alias collides with canonical ID: {alias}")
                elif alias in aliases:
                    errors.append(f"{link_id}: alias already owned by {aliases[alias]}: {alias}")
                else:
                    aliases[alias] = link_id

        replacement = record.get("replacement")
        if replacement is not None:
            if not isinstance(replacement, str) or not ID_RE.fullmatch(replacement):
                errors.append(f"{link_id}: replacement must be a canonical CTX ID")
            elif replacement == link_id:
                errors.append(f"{link_id}: replacement cannot reference itself")
        if status == "active" and replacement is not None:
            errors.append(f"{link_id}: active records must not define replacement")

    for link_id, record in sorted(records.items()):
        if not isinstance(record, dict):
            continue
        replacement = record.get("replacement")
        if isinstance(replacement, str) and replacement not in canonical_ids:
            errors.append(f"{link_id}: replacement target does not exist: {replacement}")

    if errors:
        print(f"420Docs contextual registry FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        "420Docs contextual registry PASS: "
        f"{len(canonical_ids)} canonical ID(s), {len(aliases)} alias(es), "
        "schema and local targets valid"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
