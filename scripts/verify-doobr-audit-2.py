#!/usr/bin/env python3
"""DOOBR-AUDIT-2: assert frozen Genesis compatibility boundary without changing authority."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
read = lambda path: (root / path).read_text(encoding="utf-8")
frozen = json.loads(read("config/genesis-applications.json"))
consumer = json.loads(read("config/genesis-consumer-services.json"))
travel = json.loads(read("config/420travel-genesis.json"))
source = read("genesis/svc3/travelapp/compatibility.go")
travel_spec = read("docs/genesis-services/GEN-SVC-3-TRAVEL.md")
assert frozen["schema"] == "420-genesis-application-decision-v9"
assert frozen["status"] == "FROZEN"
assert not any("doobr" in a.get("name", "").casefold() for a in frozen["apps"])
assert consumer["schema"] == "420-genesis-consumer-services-v1"
assert not any("doobr" in s.get("name","").casefold() or "doobr" in s.get("id","").casefold() for s in consumer["services"])
assert any(s["id"] == "420/service/travel/v1" for s in consumer["services"])
assert any(x.get("key") == "travel.doobr_transactions" and x.get("genesis_default") is False for x in consumer["feature_flags"])
assert "DOOBR_TRANSACTION_FLOWS" in travel["deferred_scope"]
assert travel["doobr_compatibility"]["enabled_at_genesis"] is False
assert set(travel["doobr_compatibility"]["reserved_objects"]) == {"SERVICE_PROVIDER","SERVICE_AREA","DELIVERY_WINDOW","SERVICE_REQUEST"}
assert "GEN-SVC-3.9" in travel_spec and "DOOBR" in travel_spec
assert 'const TravelCompatibilityVersion = "travel-compat/v1"' in source
for name in ("ServiceProvider", "ServiceArea", "DeliveryWindow", "ServiceRequest"):
    assert "type " + name + " struct" in source
for method in ("Reserve","Quote","Pay","Escrow","CancelAndSettle","RequestDelivery","DynamicPrice"):
    assert "func (GenesisTravelTransactions) " + method + "(" in source
    assert source.split("func (GenesisTravelTransactions) " + method + "(",1)[1].split("\n",1)[0].endswith("{return ErrTravelTransactionDisabled}")
print("DOOBR-AUDIT-2 architecture authority verifier: PASS")
