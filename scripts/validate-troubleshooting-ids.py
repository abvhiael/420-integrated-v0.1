#!/usr/bin/env python3
"""Validate stable DOC-11 troubleshooting IDs and references."""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "docs" / "ci" / "troubleshooting-id-policy.json"
STRICT_ID = re.compile(r"^TRB-([A-Z][A-Z0-9]*)-(\d{3})$")
OWNER_HEADING = re.compile(r"^#{2,6}\s+`?(TRB-[A-Z][A-Z0-9]*-\d{3})`?\b", re.MULTILINE)
TOKEN = re.compile(r"\bTRB-[A-Za-z0-9_-]+-\d+\b")
ANCHOR_REF = re.compile(r"\]\([^)]*#(trb-[a-z0-9-]+)\)")


def fail(msg: str) -> None:
    print(f"420Docs troubleshooting IDs ERROR: {msg}", file=sys.stderr)
    raise SystemExit(1)


def load_policy() -> dict:
    try:
        data = json.loads(POLICY.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"cannot read policy: {exc}")
    if not isinstance(data, dict):
        fail("policy must be an object")
    return data


def main() -> int:
    policy = load_policy()
    reserved = set(policy.get("reserved_domains", []))
    owners: dict[str, list[str]] = defaultdict(list)
    errors: list[str] = []

    for rel in policy.get("owner_pages", []):
        path = ROOT / rel
        if not path.is_file():
            errors.append(f"{rel}: owner page missing")
            continue
        text = path.read_text(encoding="utf-8")
        for ident in OWNER_HEADING.findall(text):
            match = STRICT_ID.fullmatch(ident)
            if not match:
                errors.append(f"{rel}: malformed owner ID {ident}")
                continue
            domain = match.group(1)
            if domain not in reserved:
                errors.append(f"{rel}: unreserved troubleshooting domain {domain} in {ident}")
            owners[ident].append(rel)

    if not owners:
        errors.append("no troubleshooting owner entries found")

    for ident, pages in sorted(owners.items()):
        if len(pages) != 1:
            errors.append(f"{ident}: duplicate owner entries in {', '.join(pages)}")

    exclusions = set(policy.get("reference_exclusions", []))
    checked_refs = 0
    for raw_root in policy.get("reference_roots", []):
        root = ROOT / raw_root
        if not root.is_dir():
            errors.append(f"{raw_root}: reference root missing")
            continue
        for path in sorted(root.rglob("*.md")):
            rel = path.relative_to(ROOT).as_posix()
            if rel in exclusions:
                continue
            text = path.read_text(encoding="utf-8")
            for token in TOKEN.findall(text):
                checked_refs += 1
                match = STRICT_ID.fullmatch(token)
                if not match:
                    errors.append(f"{rel}: malformed troubleshooting ID reference {token}")
                    continue
                if match.group(1) not in reserved:
                    errors.append(f"{rel}: reference uses unreserved domain in {token}")
                if token not in owners:
                    errors.append(f"{rel}: unresolved troubleshooting ID reference {token}")
            for anchor in ANCHOR_REF.findall(text):
                expected = anchor.upper()
                if expected not in owners:
                    errors.append(f"{rel}: troubleshooting anchor #{anchor} has no owning entry")

    if errors:
        print(f"420Docs troubleshooting IDs FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        f"420Docs troubleshooting IDs PASS: {len(owners)} unique owner ID(s); "
        f"{checked_refs} exact reference occurrence(s) checked"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
