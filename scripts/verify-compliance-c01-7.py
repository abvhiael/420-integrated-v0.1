#!/usr/bin/env python3
"""C01.7 targeted authority, publication and discovery design invariants."""
import json,pathlib,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[1]
d=json.loads((root/"docs/compliance/C01.7-DECISION.json").read_text())
road=(root/"docs/compliance/420COMPLIANCE-ROADMAP.md").read_text()
assert d["step"]=="C01.7" and d["status"]=="APPROVED_DESIGN_ONLY" and d["runtime_authorized"] is False
assert "| C01.7 | Approve service discovery strategy, signed publication and optional chain commitments; no new Genesis ID/address without canonical approval. |" in road
g=d["genesis"]
assert not any(g[k] for k in ("new_application_id","new_address","new_namespace","frozen_catalog_changes"))
assert d["chain_commitment"]["decision"]=="DEFER_OPTIONAL"
assert "420Governance" in d["chain_commitment"]["must_reuse"]
assert len(d["threat_negative_cases"])>=20
pub=d["publication"]
assert {"policy_digest","source_digest_set","review_digest","effective_from","review_expires_at","environment","sequence","revocation_epoch","key_id","signature"}.issubset(pub["manifest_fields"])
assert "Ed25519" in pub["signature"]
for field in ("validation","key_management","rollback","emergency"):
    assert pub[field]
assert "cannot mint ALLOW" in pub["emergency"]
assert "no user-supplied upstream URLs" in d["discovery"]["pattern"]
assert "UNKNOWN" in d["discovery"]["availability"]
assert "DOOBr authenticated internal evaluation" in d["discovery"]["consumers"]
assert "C01.8"==d["milestone"]["level2"] and "C08.5"==d["milestone"]["level3"]
assert "ErrTravelTransactionDisabled" in (root/"genesis/svc3/travelapp/COMPATIBILITY.md").read_text()
if len(sys.argv)==2:
    actual=subprocess.check_output(["git","rev-parse","HEAD"],cwd=root,text=True).strip()
    assert actual==sys.argv[1],(actual,sys.argv[1])
print("C01.7 discovery/publication/Genesis/no-activation negative contract: PASS")
