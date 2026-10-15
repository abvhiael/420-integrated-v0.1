#!/usr/bin/env python3
"""C07.9 intake structural verifier. No software PASS can masquerade as external review."""
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
baseline = json.loads((root/"docs/compliance/C01.5-THREATS.json").read_text())
intake = json.loads((root/"docs/compliance/C07.9-SECURITY-REVIEW-INTAKE.json").read_text())
assert intake["schema"] == "420compliance-independent-security-intake/v1"
assert intake["step"] == "C07.9"
assert intake["intake_status"] == "READY_FOR_INDEPENDENT_REVIEW"
assert intake["independent_review_status"] == "NOT_PERFORMED"
assert intake["independent_reviewer"] is None and intake["external_report"] is None
expected = {x["id"]: x for x in baseline["threats"]}
actual = {x["id"]: x for x in intake["threats"]}
assert len(expected) == len(actual) == 16 and set(expected) == set(actual)
for ident, row in actual.items():
    reference=expected[ident]
    for field, origin in [("boundary","trust_boundary"),("abuse","abuse"),("expected_negative","negative_expected"),("downstream_requirements","downstream_requirements")]:
        assert row[field] == reference[origin], (ident,field)
    assert row["validation_status"] == "REVIEW_REQUIRED"
    assert row["finding_status"] == "UNASSESSED"
    assert row["external_disposition"] is None
    assert row["remediation_owner"].strip()
    assert row["evidence_candidates"]
    for path in row["evidence_candidates"]:
        assert path.startswith("services/complianceauth/") and (root/path).is_file(),(ident,path)
print("C07.9: 16 canonical threats, evidence candidates and independent-review gates verified; EXTERNAL REVIEW NOT PERFORMED")
