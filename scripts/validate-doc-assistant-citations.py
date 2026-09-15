#!/usr/bin/env python3
from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "docs" / "assistant" / "citation-evidence-schema.json"


def main() -> int:
    try:
        data = json.loads(PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"Ask 420 citation validation FAILED: {exc}", file=sys.stderr)
        return 1

    errors = []
    if data.get("schema_version") != 1:
        errors.append("schema_version must be 1")

    required_fields = {"source_id", "document", "environment", "evidence_class", "claim_scope"}
    fields = data.get("citation_fields", [])
    if not isinstance(fields, list) or set(fields) != required_fields:
        errors.append("citation_fields mismatch")

    classes = data.get("evidence_classes", {})
    for name in ("canonical", "generated", "historical", "compatibility"):
        if name not in classes:
            errors.append(f"missing evidence class: {name}")

    if isinstance(classes.get("generated"), dict) and classes["generated"].get("provenance_required") is not True:
        errors.append("generated evidence must require provenance")
    if isinstance(classes.get("historical"), dict) and classes["historical"].get("immutable_release_required") is not True:
        errors.append("historical evidence must require immutable release")
    if isinstance(classes.get("compatibility"), dict) and classes["compatibility"].get("substantive") is not False:
        errors.append("compatibility evidence must be non-substantive")

    expected_states = {"supported", "partially-supported", "needs-context", "unsupported", "unavailable"}
    states = data.get("coverage_states", [])
    if not isinstance(states, list) or set(states) != expected_states:
        errors.append("coverage_states mismatch")

    rules = data.get("rules", {})
    if not isinstance(rules, dict) or not rules or any(value is not True for value in rules.values()):
        errors.append("all citation rules must be enabled")

    if errors:
        print(f"Ask 420 citation validation FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("Ask 420 citation validation PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
