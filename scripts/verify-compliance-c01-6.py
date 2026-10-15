#!/usr/bin/env python3
"""C01.6 contract design, negative boundaries and exact implementation SHA."""
import json
import pathlib
import re
import subprocess
import sys
root=pathlib.Path(__file__).resolve().parents[1]
spec=json.loads((root/"docs/compliance/C01.6-CONTRACT.json").read_text())
doc=(root/"docs/compliance/C01.6-ARCHITECTURE.md").read_text()
roadmap=(root/"docs/compliance/420COMPLIANCE-ROADMAP.md").read_text()
assert spec["step"]=="C01.6" and spec["stage"]=="DESIGN_ONLY_NO_RUNTIME_PERMISSION"
assert "| C01.6 | Define APIs, schemas, events, outcome meanings, trust boundaries, freshness and time semantics; choose stack and deployment topology. |" in roadmap
assert set(spec["outcomes"])=={"ALLOW","DENY","REVIEW_REQUIRED","UNKNOWN"}
assert spec["outcomes"]["ALLOW"]["transaction_can_proceed_conditionally"]
for outcome in ("DENY","REVIEW_REQUIRED","UNKNOWN"):
    assert not spec["outcomes"][outcome]["transaction_can_proceed_conditionally"]
api={x["id"]:x for x in spec["interfaces"]}
assert len(api)==8
assert api["evaluate"]["method"]=="POST" and api["evaluate"]["visibility"]=="AUTHENTICATED_PRIVATE"
must={"tenant_id","caller_audience","operation_ref","action","stage","origin_geo_ref","destination_geo_ref","carrier_class","credential_refs","facts_digest"}
assert must.issubset(api["evaluate"]["request"])
assert {"issuer_signature","expires_at","revocation_epoch","policy_digest","policy_version","input_digest","audience","tenant_id","operation_ref","action","stage"}.issubset(api["evaluate"]["response"])
assert api["guidance"]["visibility"]=="PUBLIC_REDACTED" and api["coverage"]["visibility"]=="PUBLIC_REDACTED"
assert api["review"]["visibility"]!=api["publish"]["visibility"]!=api["halt"]["visibility"]
assert api["decision-read"]["visibility"]=="AUTHENTICATED_PRIVATE"
for endpoint in ("guidance","coverage"):
    forbidden={"subject_ref","operation_ref","credential_refs","issuer_signature","input_digest","tenant_id"}
    assert not forbidden.intersection(api[endpoint]["response"])
events=set(spec["events"])
assert {"policy.revoked","policy.halted","decision.invalidated","policy.published","source.unavailable"}.issubset(events)
assert {"event_id","schema_version","sequence","idempotency_key","payload_digest","signature"}.issubset(spec["event_envelope"])
assert {"retrieved_at","commenced_at","effective_from","effective_until","review_expires_at","issued_at","expires_at","knowledge_as_of"}.issubset(spec["freshness"]["temporal_axes"])
assert {"api","database","object_store","workers","runtime","deployment"}.issubset(spec["stack"])
assert "PostGIS" in spec["stack"]["database"] and "Go" in spec["stack"]["api"]
assert len(spec["faults"])>=15 and spec["failure_posture"]=="NO_TRANSACTION_ALLOW; lawful separately reviewed return/safety action remains possible"
for term in ("C01.7","C01.8","C08.5","Trust","UNKNOWN","return","on-chain","outbox"):
    assert term.casefold() in doc.casefold(),term
assert "ErrTravelTransactionDisabled" in (root/"genesis/svc3/travelapp/COMPATIBILITY.md").read_text()
if len(sys.argv)>1:
    actual=subprocess.check_output(["git","rev-parse","HEAD"],cwd=root,text=True).strip()
    assert actual==sys.argv[1],(actual,sys.argv[1])
print("C01.6 API/event/outcome/privacy/time/topology 8 endpoints and 15+ negative cases PASS")
