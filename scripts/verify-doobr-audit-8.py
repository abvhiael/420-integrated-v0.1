#!/usr/bin/env python3
"""DOOBR-AUDIT-8: confirm operator/user guide matches disabled Genesis scope."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
read=lambda path:(root/path).read_text(encoding="utf8")
guide=read("docs/audits/doobr/DOOBR-AUDIT-8-OPERATIONS-USER-GUIDE.md")
cfg=json.loads(read("config/420travel-genesis.json"))
services=json.loads(read("config/genesis-consumer-services.json"))
source=read("genesis/svc3/travelapp/compatibility.go")
assert cfg["doobr_compatibility"]["enabled_at_genesis"] is False
assert "DOOBR_TRANSACTION_FLOWS" in cfg["deferred_scope"]
assert any(f.get("key")=="travel.doobr_transactions" and f.get("genesis_default") is False for f in services["feature_flags"])
assert not any("doobr" in s["id"].lower() for s in services["services"])
for name in ("ServiceProvider","ServiceArea","DeliveryWindow","ServiceRequest"):
    assert "type "+name+" struct" in source
    assert name in guide
for name in ("Reserve","Quote","Pay","Escrow","CancelAndSettle","RequestDelivery","DynamicPrice"):
    assert name in guide
    line=next(x for x in source.splitlines() if x.startswith("func (GenesisTravelTransactions) "+name+"("))
    assert line.endswith("{return ErrTravelTransactionDisabled}"),name
for topic in ("user guide","Deployment and environment","Operations and incident runbook","recovery","rollback","privacy","provider","environment","qualification","not","disabled"):
    assert topic.lower() in guide.lower(),topic
for route in cfg["ui"]["routes"]:
    assert "`"+route+"`" in guide,route
assert "standalone DOOBR build target" in guide
print("DOOBR-AUDIT-8 documentation and environment checks: PASS")
