#!/usr/bin/env python3
"""DOOBr R04.1 reuse-only inventory guard. Source/manifest checks, not deployment authority."""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def check(ok,msg):
 if not ok:raise SystemExit("R04.1 FAIL: "+msg)
apps=json.loads((ROOT/"config/genesis-applications.json").read_text())
consumer=json.loads((ROOT/"config/genesis-consumer-services.json").read_text())
travel=json.loads((ROOT/"config/420travel-genesis.json").read_text())
road=(ROOT/"docs/doobr/DOOBR-R01-R06-ROADMAP.md").read_text()
go=(ROOT/"genesis/svc3/travelapp/compatibility.go").read_text()
check(apps.get("status")=="FROZEN","application catalogue not frozen")
check(consumer["policy"]["frozen_catalog_unchanged"] is True,"catalogue preservation lost")
check(travel["authority"]=="REPLACEABLE_APPLICATION","Travel silently promoted")
check("DOOBR_TRANSACTION_FLOWS" in travel["deferred_scope"],"DOOBr transaction gate removed")
for role in ("420Identity","420Compliance","420Location","420Pay","Wallet","Arbitration","Notifications"):
 check(role in road,"missing canonical authority mention: "+role)
for name in ("Reserve","Quote","Pay","Escrow","CancelAndSettle","DynamicPrice"):
 check(re.search(r"func \(GenesisTravelTransactions\) "+name+r"\([^\n]*ErrTravelTransactionDisabled",go),
       "Travel transaction method not fail closed: "+name)
card=(ROOT/"doobr/travel_card.py").read_text()
check('checkout permanently disabled' in card and 'EXTERNAL_DEEP_LINK' in card,
      "coarse handoff lost")
print("R04.1 reuse-only source inventory PASS; no contract deployment implied")
