"""BNB-2.2 external/manual acceptance gate. Metadata alone never self-attests."""
import json
import os
import sys
from pathlib import Path

REQUIRED = {
    "moderation": ("organization", "authorization_reference", "reviewer", "policy_version",
                   "managed_key_fingerprint", "revocation_exercise_reference", "signed_approval_reference"),
    "accessibility": ("reviewer", "affiliation", "signed_approval_reference", "manual_test_date",
                      "browser_at_matrix", "journeys_evidence_reference", "defect_closure_reference"),
}


def evaluate(record):
    missing = []
    if not isinstance(record, dict) or not record.get("release_sha"):
        return {"accepted": False, "status": "BLOCKED_EXTERNAL_AUTHORITY_AND_MANUAL_TESTING",
                "missing": ["release_sha", "independent_review"]}
    for group, names in REQUIRED.items():
        obj = record.get(group)
        if not isinstance(obj, dict):
            missing.append(group)
            continue
        for name in names:
            value = obj.get(name)
            if not value or (isinstance(value, (list, dict)) and len(value) == 0):
                missing.append(f"{group}.{name}")
    # Metadata cannot prove a human approved anything, or a key is real.
    return {"accepted": False, "status": ("EXTERNAL_VERIFICATION_REQUIRED" if not missing
                                       else "BLOCKED_EXTERNAL_AUTHORITY_AND_MANUAL_TESTING"),
            "missing": missing}


if __name__ == "__main__":
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
        "docs/bnb/qualification/BNB-2.2-EXTERNAL-MANUAL-ACCEPTANCE.json")
    if not path.is_file():
        result = evaluate({})
    else:
        result = evaluate(json.loads(path.read_text()))
    print(json.dumps(result, sort_keys=True))
    sys.exit(0 if result["status"] == "EXTERNAL_VERIFICATION_REQUIRED" else 2)
