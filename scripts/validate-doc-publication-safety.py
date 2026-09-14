#!/usr/bin/env python3
"""Validate machine-checkable 420Docs authority, environment, and secret-safety invariants."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "docs" / "ci" / "publication-safety-policy.json"


def fail(message: str) -> None:
    print(f"420Docs publication safety ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_policy() -> dict:
    try:
        value = json.loads(POLICY.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"cannot read policy: {exc}")
    if not isinstance(value, dict):
        fail("policy must contain an object")
    return value


def read_text(rel: str) -> str:
    path = ROOT / rel
    if not path.is_file():
        raise FileNotFoundError(rel)
    return path.read_text(encoding="utf-8")


def secret_safety_errors(policy: dict) -> tuple[list[str], int]:
    errors: list[str] = []
    checked = 0
    sensitive = [str(v).lower() for v in policy.get("sensitive_terms", [])]
    requests = [str(v).lower() for v in policy.get("request_terms", [])]
    negations = [str(v).lower() for v in policy.get("negation_terms", [])]

    for raw_root in policy.get("secret_safety_roots", []):
        root = ROOT / raw_root
        if not root.is_dir():
            errors.append(f"secret-safety root missing: {raw_root}")
            continue
        for path in sorted(root.rglob("*.md")):
            rel = path.relative_to(ROOT).as_posix()
            checked += 1
            try:
                lines = path.read_text(encoding="utf-8").splitlines()
            except OSError as exc:
                errors.append(f"cannot read {rel}: {exc}")
                continue
            for number, line in enumerate(lines, 1):
                lower = line.lower()
                if not any(term in lower for term in sensitive):
                    continue
                if not any(term in lower for term in requests):
                    continue
                if any(term in lower for term in negations):
                    continue
                errors.append(
                    f"possible unsafe secret-request language: {rel}:{number}: {line.strip()}"
                )
    return errors, checked


def notice_errors(policy: dict) -> tuple[list[str], int]:
    errors: list[str] = []
    checked = 0
    for rule in policy.get("required_notices", []):
        rel = rule.get("path")
        if not isinstance(rel, str):
            errors.append("required notice rule missing path")
            continue
        checked += 1
        try:
            text = read_text(rel)
        except (OSError, FileNotFoundError) as exc:
            errors.append(f"required notice file missing/unreadable: {rel}: {exc}")
            continue
        lower = text.lower()
        for required in rule.get("contains_all", []):
            if str(required).lower() not in lower:
                errors.append(f"required publication-safety notice missing from {rel}: {required}")
    return errors, checked


def environment_errors(policy: dict) -> tuple[list[str], int]:
    errors: list[str] = []
    checked = 0
    for rule in policy.get("environment_guards", []):
        rel = rule.get("path")
        if not isinstance(rel, str):
            errors.append("environment guard missing path")
            continue
        checked += 1
        try:
            text = read_text(rel)
        except (OSError, FileNotFoundError) as exc:
            errors.append(f"environment guard file missing/unreadable: {rel}: {exc}")
            continue
        lower = text.lower()
        triggers = [str(v).lower() for v in rule.get("trigger_any", [])]
        guards = [str(v).lower() for v in rule.get("required_any", [])]
        if any(trigger in lower for trigger in triggers) and not any(guard in lower for guard in guards):
            errors.append(
                f"environment-scoped/example values appear without a required authority guard: {rel}"
            )
    return errors, checked


def main() -> int:
    policy = load_policy()
    errors: list[str] = []

    secret_errors, secret_pages = secret_safety_errors(policy)
    notice_failures, notice_files = notice_errors(policy)
    environment_failures, environment_files = environment_errors(policy)
    errors.extend(secret_errors)
    errors.extend(notice_failures)
    errors.extend(environment_failures)

    if errors:
        print(f"420Docs publication safety FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        "420Docs publication safety PASS: "
        f"{secret_pages} troubleshooting page(s) secret-safety scanned; "
        f"{notice_files} required notice file(s); "
        f"{environment_files} environment guard file(s)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
