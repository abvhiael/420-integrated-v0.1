#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "docs" / "assistant" / "420ai-integration-policy.json"
PRIVACY = ROOT / "docs" / "assistant" / "privacy-policy.json"


def load(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"cannot read {path.relative_to(ROOT)}: {exc}") from exc
    if not isinstance(value, dict):
        raise RuntimeError(f"{path.relative_to(ROOT)} must contain an object")
    return value


def main() -> int:
    errors: list[str] = []
    try:
        policy = load(POLICY)
        load(PRIVACY)
    except RuntimeError as exc:
        print(f"Ask 420 420AI validation FAILED: {exc}", file=sys.stderr)
        return 1

    if policy.get("schema_version") != 1:
        errors.append("schema_version must be 1")
    if policy.get("execution_layer") != "420AI":
        errors.append("execution_layer must be 420AI")
    if policy.get("provider_neutral") is not True:
        errors.append("provider_neutral must be true")
    if policy.get("retrieval_before_inference") is not True:
        errors.append("retrieval_before_inference must be true")

    authority = policy.get("authority", {})
    if not isinstance(authority, dict):
        errors.append("authority must be an object")
    else:
        if authority.get("provider_is_documentation_authority") is not False:
            errors.append("provider must not be documentation authority")
        if authority.get("model_is_documentation_authority") is not False:
            errors.append("model must not be documentation authority")

    context = policy.get("context_package", {})
    if not isinstance(context, dict):
        errors.append("context_package must be an object")
    else:
        required = context.get("required_fields", [])
        for field in ["environment", "release", "intent", "evidence", "citations"]:
            if field not in required:
                errors.append(f"context package missing required field {field}")
        if context.get("evidence_must_be_prevalidated") is not True:
            errors.append("evidence must be prevalidated")
        if context.get("cross_environment_sources_allowed") is not False:
            errors.append("cross-environment sources must be forbidden")

    citations = policy.get("citations", {})
    if not isinstance(citations, dict) or citations.get("generated_requires_provenance") is not True:
        errors.append("generated citations must require provenance")

    result = policy.get("result_validation", {})
    if not isinstance(result, dict):
        errors.append("result_validation must be an object")
    else:
        if result.get("concrete_claims_require_evidence") is not True:
            errors.append("concrete claims must require evidence")
        if result.get("citations_must_reference_supplied_evidence") is not True:
            errors.append("citations must reference supplied evidence")
        if result.get("live_runtime_claims_from_docs_allowed") is not False:
            errors.append("static docs must not prove live runtime state")
        if result.get("invalid_result_action") != "reject":
            errors.append("invalid result action must be reject")

    failure = policy.get("failure", {})
    if not isinstance(failure, dict):
        errors.append("failure must be an object")
    else:
        if failure.get("reroute_may_broaden_constraints") is not False:
            errors.append("reroute must not broaden constraints")
        if failure.get("ungrounded_fallback_allowed") is not False:
            errors.append("ungrounded fallback must be forbidden")
        if failure.get("timeout") != "reconcile-job-state-before-retry":
            errors.append("timeout must require job-state reconciliation before retry")

    privacy_path = policy.get("privacy_policy")
    if privacy_path != "docs/assistant/privacy-policy.json":
        errors.append("privacy_policy must bind to DOC-15.7 privacy policy")

    if errors:
        print(f"Ask 420 420AI validation FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("Ask 420 420AI validation PASS: provider-neutral bounded inference, citations, privacy and fail-closed behavior valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
