#!/usr/bin/env python3
"""C08.2 documentation coverage guard; does not certify legal or deployment readiness."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
base=root/"docs/compliance"
required={
"C08.2-API-SDK-SCHEMAS.md":["/api/v1/evaluate","/api/v1/guidance","/api/v1/policies/status","C051Client","REVIEW_REQUIRED","RecoveryGate"],
"C08.2-CONSUMER-GUIDE.md":["DOOBr","420Travel","DENY","REVIEW_REQUIRED","revocation"],
"C08.2-REVIEWER-HANDBOOK.md":["independently","digest","MFA","source","NOT APPROVED"],
"C08.2-OPERATOR-RUNBOOK.md":["RPO/RTO","C07.7","PITR","revocation","NOT"],
"C08.2-LEGAL-SOURCE-MATRIX.md":["Federal","British Columbia","Vancouver","Indigenous","ACCEPTANCE OPEN"],
"C08.2-DEPLOYMENT-MANIFEST-TEMPLATE.md":["release_enabled","false","implementation_sha","external_recovery_authority","NOT_APPROVED"]
}
for path,terms in required.items():
    s=(base/path).read_text()
    assert all(t in s for t in terms),(path,[t for t in terms if t not in s])
api=(root/"services/complianceauth/c05_1_api.go").read_text()
for path in ["/api/v1/evaluate","/api/v1/guidance","/api/v1/policies/status"]:
    assert path in api
assert "C051Client" in api and 'json:"policy_digest"' in api
print("C08.2 six canonical guides/template coverage and API source consistency PASS; release not authorized")
