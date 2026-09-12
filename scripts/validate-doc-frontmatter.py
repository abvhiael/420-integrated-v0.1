#!/usr/bin/env python3
"""Validate governed 420Docs front matter against the DOC-12.2 policy."""

from __future__ import annotations

import json
import sys
from pathlib import Path, PurePosixPath

import yaml

ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = ROOT / "docs" / "ci" / "frontmatter-policy.json"


def fatal(message: str) -> None:
    print(f"420Docs front matter ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_policy() -> dict:
    try:
        data = json.loads(POLICY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fatal(f"cannot read policy {POLICY_PATH.relative_to(ROOT)}: {exc}")
    if not isinstance(data, dict):
        fatal("front-matter policy must be a JSON object")
    return data


def legacy_missing_frontmatter_allowed(path: Path, policy: dict) -> bool:
    rel = path.relative_to(ROOT).as_posix()
    if rel in set(policy.get("legacy_exceptions", [])):
        return True
    posix = PurePosixPath(rel)
    return any(posix.match(pattern) for pattern in policy.get("legacy_exception_globs", []))


def governed_markdown(policy: dict) -> list[Path]:
    result: set[Path] = set()
    for raw_root in policy.get("governed_roots", []):
        root = ROOT / raw_root
        if not root.is_dir():
            fatal(f"governed root does not exist: {raw_root}")
        result.update(root.rglob("*.md"))
    return sorted(result)


def parse_front_matter(path: Path) -> tuple[dict | None, list[str], bool]:
    rel = path.relative_to(ROOT)
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return None, [f"{rel}: cannot read file: {exc}"], False
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None, [f"{rel}: missing opening front-matter delimiter"], False
    try:
        end = next(i for i, line in enumerate(lines[1:], start=1) if line.strip() == "---")
    except StopIteration:
        return None, [f"{rel}: missing closing front-matter delimiter"], True
    raw = "\n".join(lines[1:end])
    try:
        data = yaml.safe_load(raw)
    except yaml.YAMLError as exc:
        return None, [f"{rel}: malformed YAML front matter: {exc}"], True
    if not isinstance(data, dict):
        return None, [f"{rel}: front matter must be a YAML mapping"], True
    return data, [], True


def validate_page(path: Path, policy: dict) -> tuple[list[str], bool]:
    rel = path.relative_to(ROOT)
    data, errors, has_frontmatter = parse_front_matter(path)
    if data is None:
        if not has_frontmatter and legacy_missing_frontmatter_allowed(path, policy):
            return [], True
        return errors, False

    for field in policy.get("required_fields", []):
        if field not in data:
            errors.append(f"{rel}: missing required front-matter field '{field}'")

    for field in ("title", "category", "status", "version"):
        if field in data and (not isinstance(data[field], str) or not data[field].strip()):
            errors.append(f"{rel}: {field} must be a non-empty string")

    category = data.get("category")
    status = data.get("status")
    if isinstance(category, str) and category.strip() and category not in set(policy.get("allowed_category", [])):
        errors.append(f"{rel}: category '{category}' is not allowed")
    if isinstance(status, str) and status.strip() and status not in set(policy.get("allowed_status", [])):
        errors.append(f"{rel}: status '{status}' is not allowed")

    if "audience" in data:
        audience = data["audience"]
        if isinstance(audience, str):
            audience = [audience]
        if not isinstance(audience, list) or not audience:
            errors.append(f"{rel}: audience must be a non-empty string or list")
        else:
            allowed_audience = set(policy.get("allowed_audience", []))
            for value in audience:
                if not isinstance(value, str) or not value.strip():
                    errors.append(f"{rel}: audience entries must be non-empty strings")
                elif value not in allowed_audience:
                    errors.append(f"{rel}: audience '{value}' is not allowed")

    return errors, False


def main() -> int:
    policy = load_policy()
    pages = governed_markdown(policy)
    if not pages:
        fatal("policy selected no governed Markdown pages")

    errors: list[str] = []
    legacy_missing = 0
    for path in pages:
        page_errors, used_legacy_missing_exception = validate_page(path, policy)
        errors.extend(page_errors)
        legacy_missing += int(used_legacy_missing_exception)

    if errors:
        print(f"420Docs front matter FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        f"420Docs front matter PASS: {len(pages)} governed pages checked; "
        f"{legacy_missing} legacy page(s) permitted without front matter"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
