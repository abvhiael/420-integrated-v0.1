#!/usr/bin/env python3
"""C08.3: ensure no external acceptance is silently reported complete."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
folder=root/"docs/compliance"
roadmap=(folder/"420COMPLIANCE-ROADMAP.md").read_text()
data=json.loads((folder/"qualification/C08.3-testnet-work-ledger.json").read_text())
assert data["schema"]=="420compliance-c083-dependency-transfer/v1"
assert data["production_enabled"] is False
assert data["status"]=="TESTNET_AND_EXTERNAL_ACCEPTANCE_OPEN"
expected={"LEGAL","IDENTITY","CONSUMERS","RECOVERY","HISTORY"}
assert {x["id"] for x in data["entries"]}==expected and len(data["entries"])==5
for row in data["entries"]:
    assert row["status"]=="OPEN"
    for field in ("approvals_verified","live_acceptance_verified","release_permission"):
        assert row[field] is False,(row["id"],field)
    for key in ("testnet_steps","production_steps"):
        assert row[key] and all(f"| {step} |" in roadmap for step in row[key]),(row["id"],key)
assert {x["step"] for x in data["historical_standalone_level1"]}=={"C06.5","C06.6","C06.7","C06.8","C07.6"}
for row in data["historical_standalone_level1"]:
    assert row["status"]=="NOT_VERIFIED"
    p=root/row["record"]; assert p.is_file(),str(p)
    source=json.loads(p.read_text())
    assert source["standalone_exact_sha_level1_certificate"]=="NOT_VERIFIED"
doc=(folder/"C08.3-EXTERNAL-AUTHORITY-TESTNET-HANDOFF.md").read_text()
for key in expected: assert f"**{key}**" in doc,key
print("C08.3 five explicit canonical testnet workstreams, five historically unverified step records; no fabricated external acceptance PASS")
