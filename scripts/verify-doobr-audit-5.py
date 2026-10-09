#!/usr/bin/env python3
"""Assert AUDIT-5's conditional integration contract leaves Genesis execution closed."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
get=lambda p:(root/p).read_text(encoding="utf-8")
catalog=json.loads(get("config/genesis-applications.json"))
registry=json.loads(get("config/genesis-consumer-services.json"))
travel=json.loads(get("config/420travel-genesis.json"))
source=get("genesis/svc3/travelapp/compatibility.go")
doc=get("docs/audits/doobr/DOOBR-AUDIT-5-INTEGRATION-BOUNDARIES.md")
assert catalog["status"]=="FROZEN" and not any("doobr" in x.get("name","").lower() for x in catalog["apps"])
assert not any("doobr" in x.get("id","").lower() for x in registry["services"])
assert any(x.get("key")=="travel.doobr_transactions" and x.get("genesis_default") is False for x in registry["feature_flags"])
assert travel["doobr_compatibility"]["enabled_at_genesis"] is False
assert "DOOBR_TRANSACTION_FLOWS" in travel["deferred_scope"]
for m in ("Reserve","Quote","Pay","Escrow","CancelAndSettle","RequestDelivery","DynamicPrice"):
    line=next(line for line in source.splitlines() if line.startswith("func (GenesisTravelTransactions) "+m+"("))
    assert line.endswith("{return ErrTravelTransactionDisabled}"),m
for required in ("420Location","420Identity","420Pay","420Arbitration","420Notifications","420Search","420Indexer","420Reputation","jurisdiction","revocation","idempotency","privacy","refund","testnet","NOT authorized"):
    assert required.casefold() in doc.casefold(),required
print("DOOBR-AUDIT-5 integration authority and decision gates: PASS")
