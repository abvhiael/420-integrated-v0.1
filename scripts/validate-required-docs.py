#!/usr/bin/env python3
"""Validate required 420Docs families and frozen Genesis application manuals."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "docs" / "ci" / "required-docs-policy.json"


def fail(message: str) -> None:
    print(f"420Docs required coverage ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_policy() -> dict:
    try:
        value = json.loads(POLICY.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"cannot read policy: {exc}")
    if not isinstance(value, dict):
        fail("policy must contain an object")
    return value


def require_file(rel: str, errors: list[str]) -> None:
    path = ROOT / rel
    if not path.is_file():
        errors.append(f"missing required documentation file: {rel}")
        return
    try:
        if not path.read_text(encoding="utf-8").strip():
            errors.append(f"required documentation file is empty: {rel}")
    except OSError as exc:
        errors.append(f"cannot read required documentation file {rel}: {exc}")


def main() -> int:
    policy = load_policy()
    errors: list[str] = []
    checked = 0

    for key in ("required_roots", "required_architecture_entries", "required_reference_outputs"):
        values = policy.get(key, [])
        if not isinstance(values, list) or not all(isinstance(item, str) for item in values):
            fail(f"{key} must be a list of paths")
        for rel in values:
            checked += 1
            require_file(rel, errors)

    apps = policy.get("genesis_app_directories", [])
    required_files = policy.get("genesis_app_required_files", [])
    if not isinstance(apps, list) or not all(isinstance(item, str) for item in apps):
        fail("genesis_app_directories must be a list")
    if not isinstance(required_files, list) or not all(isinstance(item, str) for item in required_files):
        fail("genesis_app_required_files must be a list")

    if len(apps) != len(set(apps)):
        errors.append("duplicate Genesis application directory in required-docs policy")

    for app in apps:
        app_root = ROOT / "docs" / "apps" / app
        if not app_root.is_dir():
            errors.append(f"missing required Genesis application directory: docs/apps/{app}")
            continue
        for suffix in required_files:
            checked += 1
            require_file(f"docs/apps/{app}/{suffix}", errors)

    if errors:
        print(f"420Docs required coverage FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        f"420Docs required coverage PASS: {checked} required file(s) checked; "
        f"{len(apps)} frozen Genesis/testnet application manual package(s) present"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
