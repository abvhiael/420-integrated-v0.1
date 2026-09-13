#!/usr/bin/env python3
from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "docs" / "assistant" / "privacy-policy.json"
REQUIRED_PROHIBITED = {
    "seed_phrase", "private_key", "recovery_secret", "validator_signing_key",
    "engine_jwt", "bearer_token", "api_secret", "authentication_cookie",
    "authorization_header", "private_messenger_payload"
}
REQUIRED_BOUNDARIES = {"wallet", "identity", "messenger", "attention", "420ai"}


def main() -> int:
    try:
        data = json.loads(POLICY.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"Ask 420 privacy validation FAILED: {exc}", file=sys.stderr)
        return 1

    errors: list[str] = []
    if data.get("schema_version") != 1:
        errors.append("schema_version must equal 1")

    principles = data.get("principles")
    if not isinstance(principles, dict):
        errors.append("principles must be an object")
    else:
        for key in ("minimum_input", "ephemeral_by_default", "ambient_authorization_forbidden", "private_payload_auto_inclusion_forbidden"):
            if principles.get(key) is not True:
                errors.append(f"principle {key} must be true")

    allowed = data.get("allowed_context")
    if not isinstance(allowed, list) or not allowed:
        errors.append("allowed_context must be a non-empty list")

    prohibited = data.get("prohibited")
    prohibited_set = set(prohibited) if isinstance(prohibited, list) else set()
    missing = sorted(REQUIRED_PROHIBITED - prohibited_set)
    if missing:
        errors.append("missing prohibited classes: " + ", ".join(missing))

    if data.get("telemetry_raw_question_required") is not False:
        errors.append("telemetry_raw_question_required must be false")
    if data.get("retention_default") != "no-assumed-retention":
        errors.append("retention_default must be no-assumed-retention")
    if data.get("secret_required_behavior") != "stop-and-sanitize-or-escalate":
        errors.append("secret_required_behavior must fail closed")

    boundaries = data.get("application_boundaries")
    boundary_set = set(boundaries) if isinstance(boundaries, list) else set()
    missing_boundaries = sorted(REQUIRED_BOUNDARIES - boundary_set)
    if missing_boundaries:
        errors.append("missing application privacy boundaries: " + ", ".join(missing_boundaries))

    if errors:
        print(f"Ask 420 privacy validation FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("Ask 420 privacy validation PASS: minimum-input, secret exclusion, telemetry minimization and app boundaries valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
