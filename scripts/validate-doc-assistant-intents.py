#!/usr/bin/env python3
"""Validate DOC-15 Ask 420 query/intent configuration."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSISTANT = ROOT / "docs" / "assistant"
CONTEXTUAL = ROOT / "docs" / "contextual" / "contextual-link-registry.json"

EXPECTED_INTENTS = {
    "task-guidance",
    "concept-explanation",
    "reference-lookup",
    "troubleshooting",
    "navigation",
}
EXPECTED_STATES = {"ready", "needs-context", "unsupported"}
EXPECTED_AUDIENCES = {"user", "developer", "operator"}
EXPECTED_TARGET_MAP = {
    "task": "task-guidance",
    "concept": "concept-explanation",
    "reference": "reference-lookup",
    "troubleshooting": "troubleshooting",
}


def load(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"cannot read {path.relative_to(ROOT)}: {exc}") from exc
    if not isinstance(value, dict):
        raise RuntimeError(f"{path.relative_to(ROOT)} must contain a JSON object")
    return value


def main() -> int:
    errors: list[str] = []
    try:
        intent_map = load(ASSISTANT / "intent-map.json")
        contextual = load(CONTEXTUAL)
    except RuntimeError as exc:
        print(f"420Docs assistant intent validation FAILED: {exc}", file=sys.stderr)
        return 1

    if set(intent_map.get("primary_intents", [])) != EXPECTED_INTENTS:
        errors.append("primary_intents must contain exactly the five DOC-15.3 intent classes")
    if set(intent_map.get("states", [])) != EXPECTED_STATES:
        errors.append("states must be ready, needs-context and unsupported")
    if set(intent_map.get("audiences", [])) != EXPECTED_AUDIENCES:
        errors.append("audiences must be user, developer and operator")

    target_map = intent_map.get("contextual_target_type_map")
    if target_map != EXPECTED_TARGET_MAP:
        errors.append("contextual_target_type_map does not match DOC-14 target classes")

    precedence = intent_map.get("precedence", [])
    required_precedence = [
        "exact-troubleshooting-id",
        "exact-active-contextual-id",
        "explicit-user-intent",
        "conservative-semantic-inference",
        "needs-context",
    ]
    if precedence != required_precedence:
        errors.append("intent precedence must preserve exact TRB, exact CTX, explicit intent, conservative inference, needs-context order")

    signals = intent_map.get("supported_signals", {})
    try:
        trb_re = re.compile(signals.get("troubleshooting_id_pattern", ""))
        ctx_re = re.compile(signals.get("contextual_id_pattern", ""))
    except re.error as exc:
        errors.append(f"invalid identifier regex: {exc}")
    else:
        if not trb_re.fullmatch("TRB-WALLET-001") or trb_re.fullmatch("CTX-WALLET-001"):
            errors.append("troubleshooting ID pattern is not sufficiently strict")
        if not ctx_re.fullmatch("CTX-WALLET-001") or ctx_re.fullmatch("TRB-WALLET-001"):
            errors.append("contextual ID pattern is not sufficiently strict")

    records = contextual.get("records", {})
    allowed_target_types = set(contextual.get("allowed_target_types", []))
    if set(EXPECTED_TARGET_MAP) != allowed_target_types:
        errors.append("DOC-15.3 target-type mapping is out of sync with DOC-14 allowed target types")
    if isinstance(records, dict):
        for link_id, record in records.items():
            if not isinstance(record, dict) or record.get("status") != "active":
                continue
            target_type = record.get("target_type")
            if target_type not in EXPECTED_TARGET_MAP:
                errors.append(f"{link_id}: active contextual target type has no Ask 420 intent mapping: {target_type!r}")

    if not intent_map.get("needs_context_when"):
        errors.append("needs_context_when must not be empty")
    if not intent_map.get("unsupported_when"):
        errors.append("unsupported_when must not be empty")

    if errors:
        print(f"420Docs assistant intent validation FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        "420Docs assistant intent PASS: five intent classes, safe states, "
        "DOC-14 target mapping, identifier patterns and precedence valid"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
