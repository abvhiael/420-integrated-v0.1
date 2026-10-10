#!/usr/bin/env python3
"""AUDIT-6: verify no executable gap in currently approved compatibility-only scope."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
read=lambda p:(root/p).read_text(encoding="utf-8")
catalog=json.loads(read("config/genesis-applications.json"))
registry=json.loads(read("config/genesis-consumer-services.json"))
travel=json.loads(read("config/420travel-genesis.json"))
go=read("genesis/svc3/travelapp/compatibility.go")
doc=read("docs/audits/doobr/DOOBR-AUDIT-6-CODE-DISPOSITION.md")
assert catalog["status"]=="FROZEN" and not any("doobr" in a["name"].lower() for a in catalog["apps"])
assert not any("doobr" in s["id"].lower() for s in registry["services"])
assert any(x.get("key")=="travel.doobr_transactions" and x.get("genesis_default") is False for x in registry["feature_flags"])
assert travel["doobr_compatibility"]["enabled_at_genesis"] is False
assert "DOOBR_TRANSACTION_FLOWS" in travel["deferred_scope"]
for typ in ("ServiceProvider","ServiceArea","DeliveryWindow","ServiceRequest"):
    assert "type "+typ+" struct" in go
for method in ("Reserve","Quote","Pay","Escrow","CancelAndSettle","RequestDelivery","DynamicPrice"):
    line=next(x for x in go.splitlines() if x.startswith("func (GenesisTravelTransactions) "+method+"("))
    assert line.endswith("{return ErrTravelTransactionDisabled}"),method
assert "no production code" in doc.lower() and "not approved" in doc.lower()
print("DOOBR-AUDIT-6 approved compatibility implementation scope: PASS")
