#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "docs" / "assistant" / "troubleshooting-policy.json"
DOC = ROOT / "docs" / "assistant" / "troubleshooting-behavior.md"
DOC11 = ROOT / "docs" / "troubleshooting" / "search-diagnostics-support.md"
CTX = ROOT / "docs" / "contextual" / "contextual-link-registry.json"


def main() -> int:
    errors: list[str] = []
    try:
        policy = json.loads(POLICY.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"Ask 420 troubleshooting validation FAILED: {exc}", file=sys.stderr)
        return 1

    if policy.get("schema_version") != 1:
        errors.append("schema_version must be 1")
    if policy.get("exact_id_prefix") != "TRB-":
        errors.append("exact_id_prefix must be TRB-")
    if policy.get("exact_id_precedence") is not True:
        errors.append("exact troubleshooting IDs must have precedence")
    if policy.get("symptom_routing", {}).get("ambiguous_result") != "needs-context":
        errors.append("ambiguous troubleshooting must return needs-context")
    if policy.get("retry_policy", {}).get("assistant_may_authorize_retry") is not False:
        errors.append("assistant must not independently authorize retry")
    if policy.get("retry_policy", {}).get("require_doc11_retry_safety") is not True:
        errors.append("DOC-11 retry safety must be required")
    if policy.get("contextual_navigation", {}).get("ctx_ids_are_navigation_only") is not True:
        errors.append("CTX IDs must remain navigation-only")
    if policy.get("contextual_navigation", {}).get("trb_precedes_ctx_for_known_errors") is not True:
        errors.append("TRB IDs must precede CTX for known errors")
    if policy.get("live_state", {}).get("documentation_proves_runtime_state") is not False:
        errors.append("documentation must not prove live runtime state")
    if policy.get("diagnostics", {}).get("forbid_secrets") is not True:
        errors.append("troubleshooting diagnostics must forbid secrets")
    if sorted(policy.get("fail_closed_results", [])) != sorted(["unsupported", "needs-context", "unavailable"]):
        errors.append("fail_closed_results mismatch")

    for path in (DOC, DOC11, CTX):
        if not path.is_file():
            errors.append(f"required file missing: {path.relative_to(ROOT)}")

    if errors:
        print(f"Ask 420 troubleshooting validation FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("Ask 420 troubleshooting validation PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
