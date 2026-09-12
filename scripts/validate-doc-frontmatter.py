#!/usr/bin/env python3
"""Validate governed 420Docs front matter against the DOC-12.2 policy."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = ROOT / "docs" / "ci" / "frontmatter-policy.json"


def fail(message: str) -> None:
    print(f"420Docs front matter FAILED: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_policy() -> dict:
    try:
        return json.loads(POLICY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"cannot read policy {POLICY_PATH.relative_to(ROOT)}: {exc}")


def governed_markdown(policy: dict) -> list[Path]:
    result: set[Path] = set()
    for raw_root in policy.get("governed_roots", []):
        root = ROOT / raw_root
        if not root.is_dir():
            fail(f"governed root does not exist: {raw_root}")
        result.update(root.rglob("*.md"))
    exceptions = {str(ROOT / value) for value in policy.get("legacy_exceptions", [])}
    return sorted(path for path in result if str(path) not in exceptions)


def parse_front_matter(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    rel = path.relative_to(ROOT)
    if not lines or lines[0].strip() != "---":
        fail(f"{rel}: missing opening front-matter delimiter")
    try:
        end = next(i for i, line in enumerate(lines[1:], start=1) if line.strip() == "---")
    except StopIteration:
        fail(f"{rel}: missing closing front-matter delimiter")
    raw = "\n".join(lines[1:end])
    try:
        data = yaml.safe_load(raw)
    except yaml.YAMLError as exc:
        fail(f"{rel}: malformed YAML front matter: {exc}")
    if not isinstance(data, dict):
        fail(f"{rel}: front matter must be a YAML mapping")
    return data


def require_nonempty_string(rel: Path, data: dict, field: str) -> str:
    value = data.get(field)
    if not isinstance(value, str) or not value.strip():
        fail(f"{rel}: {field} must be a non-empty string")
    return value.strip()


def validate_page(path: Path, policy: dict) -> None:
    rel = path.relative_to(ROOT)
    data = parse_front_matter(path)

    for field in policy.get("required_fields", []):
        if field not in data:
            fail(f"{rel}: missing required front-matter field '{field}'")

    require_nonempty_string(rel, data, "title")
    category = require_nonempty_string(rel, data, "category")
    status = require_nonempty_string(rel, data, "status")
    version = require_nonempty_string(rel, data, "version")

    allowed_category = set(policy.get("allowed_category", []))
    allowed_status = set(policy.get("allowed_status", []))
    if category not in allowed_category:
        fail(f"{rel}: category '{category}' is not allowed")
    if status not in allowed_status:
        fail(f"{rel}: status '{status}' is not allowed")
    if not version:
        fail(f"{rel}: version must be non-empty")

    if "audience" in data:
        audience = data["audience"]
        if isinstance(audience, str):
            audience = [audience]
        if not isinstance(audience, list) or not audience:
            fail(f"{rel}: audience must be a non-empty string or list")
        allowed_audience = set(policy.get("allowed_audience", []))
        for value in audience:
            if not isinstance(value, str) or not value.strip():
                fail(f"{rel}: audience entries must be non-empty strings")
            if value not in allowed_audience:
                fail(f"{rel}: audience '{value}' is not allowed")


def main() -> int:
    policy = load_policy()
    pages = governed_markdown(policy)
    if not pages:
        fail("policy selected no governed Markdown pages")
    for path in pages:
        validate_page(path, policy)
    print(f"420Docs front matter PASS: {len(pages)} governed pages validated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
