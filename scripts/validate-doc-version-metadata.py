#!/usr/bin/env python3
"""Validate DOC-13 documentation version metadata with legacy compatibility."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
FRONTMATTER_POLICY = ROOT / "docs" / "ci" / "frontmatter-policy.json"
VERSION_POLICY = ROOT / "docs" / "versioning" / "version-metadata-policy.json"


def fatal(message: str) -> None:
    print(f"420Docs version metadata ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_json(path: Path, label: str) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fatal(f"cannot read {label} {path.relative_to(ROOT)}: {exc}")
    if not isinstance(value, dict):
        fatal(f"{label} must be a JSON object")
    return value


def governed_pages(frontmatter_policy: dict) -> list[Path]:
    pages: set[Path] = set()
    for raw_root in frontmatter_policy.get("governed_roots", []):
        root = ROOT / raw_root
        if not root.is_dir():
            fatal(f"governed root does not exist: {raw_root}")
        pages.update(root.rglob("*.md"))
    versioning_root = ROOT / "docs" / "versioning"
    if versioning_root.is_dir():
        pages.update(versioning_root.rglob("*.md"))
    return sorted(pages)


def parse_frontmatter(path: Path) -> dict | None:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        fatal(f"cannot read {path.relative_to(ROOT)}: {exc}")
    if not lines or lines[0].strip() != "---":
        return None
    try:
        end = next(i for i, line in enumerate(lines[1:], start=1) if line.strip() == "---")
    except StopIteration:
        return None
    try:
        data = yaml.safe_load("\n".join(lines[1:end]))
    except yaml.YAMLError:
        return None
    return data if isinstance(data, dict) else None


def validate_page(path: Path, policy: dict) -> tuple[list[str], bool, bool]:
    rel = path.relative_to(ROOT).as_posix()
    data = parse_frontmatter(path)
    if data is None:
        return [], False, False

    fields = policy["metadata_fields"]
    release_field = fields["release"]
    environment_field = fields["environment"]
    status_field = fields["publication_status"]
    tuple_fields = [release_field, environment_field, status_field]
    present = [field for field in tuple_fields if field in data]
    legacy_field = policy.get("legacy_version_field", "version")

    if not present:
        legacy_ok = (
            policy.get("compatibility", {}).get("allow_legacy_version_current_without_doc13_tuple", False)
            and data.get(legacy_field) == policy.get("legacy_current_alias", "current")
        )
        return ([] if legacy_ok else [f"{rel}: page has neither DOC-13 metadata nor compatible version: current"], False, legacy_ok)

    errors: list[str] = []
    if policy.get("compatibility", {}).get("require_complete_tuple_when_any_doc13_field_present", True):
        missing = [field for field in tuple_fields if field not in data]
        if missing:
            errors.append(f"{rel}: incomplete DOC-13 metadata tuple; missing {', '.join(missing)}")
            return errors, True, False

    release = data.get(release_field)
    environment = data.get(environment_field)
    publication = data.get(status_field)

    if not isinstance(release, str) or not release.strip():
        errors.append(f"{rel}: {release_field} must be a non-empty string")
    elif not re.fullmatch(policy.get("release_id_pattern", r"^[a-z0-9][a-z0-9._-]{0,63}$"), release):
        errors.append(f"{rel}: {release_field} '{release}' is not a valid release identifier")

    if environment not in set(policy.get("allowed_environments", [])):
        errors.append(f"{rel}: {environment_field} '{environment}' is not allowed")
    if publication not in set(policy.get("allowed_publication_status", [])):
        errors.append(f"{rel}: {status_field} '{publication}' is not allowed")

    mutable = set(policy.get("mutable_release_aliases", []))
    rules = policy.get("rules", {})
    if publication == "historical" and rules.get("historical_requires_immutable_release", True) and release in mutable:
        errors.append(f"{rel}: historical documentation cannot use mutable release alias '{release}'")
    if publication == "deprecated" and rules.get("deprecated_requires_immutable_release", True) and release in mutable:
        errors.append(f"{rel}: deprecated documentation cannot use mutable release alias '{release}'")

    disallow_key = f"{environment}_environment_disallows_release"
    if environment in {"genesis", "testnet", "mainnet"} and release in set(rules.get(disallow_key, [])):
        errors.append(f"{rel}: release '{release}' is incompatible with environment '{environment}'")
    if environment == "development":
        allowed = set(rules.get("development_environment_allows_release", []))
        if allowed and release not in allowed:
            errors.append(f"{rel}: development environment requires release in {sorted(allowed)}, got '{release}'")

    if release == "genesis" and environment not in {"genesis", "testnet", "mainnet"}:
        errors.append(f"{rel}: release 'genesis' cannot be bound to environment '{environment}'")

    return errors, True, False


def main() -> int:
    frontmatter_policy = load_json(FRONTMATTER_POLICY, "front-matter policy")
    policy = load_json(VERSION_POLICY, "version metadata policy")
    pages = governed_pages(frontmatter_policy)
    if not pages:
        fatal("no documentation pages selected")

    errors: list[str] = []
    doc13_pages = 0
    legacy_pages = 0
    for path in pages:
        page_errors, uses_doc13, uses_legacy = validate_page(path, policy)
        errors.extend(page_errors)
        doc13_pages += int(uses_doc13)
        legacy_pages += int(uses_legacy)

    if errors:
        print(f"420Docs version metadata FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        "420Docs version metadata PASS: "
        f"{len(pages)} page(s) checked; {doc13_pages} DOC-13 tuple page(s); "
        f"{legacy_pages} legacy version: current page(s)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
