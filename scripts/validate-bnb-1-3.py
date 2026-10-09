#!/usr/bin/env python3
"""BNB-1.3 app-scoped domain design and M1 source consistency checks."""
import json,re,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def check(ok,msg):
    if not ok: raise SystemExit("BNB-M1 FAIL: "+msg)
def run():
    docs={n:(root / "docs" / "bnb" / (f"BNB-1.{n}-" + {1:"CANONICAL-SOURCE-RECONCILIATION",2:"PRODUCT-SCOPE-AND-USER-JOURNEYS",3:"DOMAIN-MODEL-AND-STATE-MACHINES"}[n] + ".md")).read_text() for n in (1,2,3)}
    d=docs[3]
    for n in range(1,13):check(f"BNB-D{n:02d}" in d,f"missing domain acceptance D{n:02d}")
    for n in range(1,17):check(f"BNB-P{n:02d}" in docs[2],f"missing upstream P{n:02d}")
    for entity in ["HostProfile","GuestProfile","PropertyDelegation","RentalUnit","ListingRevision","AvailabilityBlock","PriceQuote","InventoryHold","BookingRequest","Reservation","CancellationCase","RefundRef","HostPayoutRef","DisputeRef","EventOutbox"]:
        check(entity in d,f"missing entity {entity}")
    for transition in ["PENDING_PAYMENT","CONFIRMED","CANCELED","EXPIRED","FAILED","COMMITTED","RELEASED","STAY_IN_PROGRESS","COMPLETED","SETTLEMENT_PENDING","RECOVERY_REQUIRED","REVOKED"]:
        check(transition in d,f"missing state {transition}")
    for policy in ["half-open","idempotency","replay","concurrency","timezone","420Pay","Arbitration","Travel","privacy","refund","payout"]:
        check(policy.lower() in d.lower(),f"missing {policy} constraint")
    config=json.loads((root/"config/420travel-genesis.json").read_text())
    check(config["bnb_compatibility"]["enabled_at_genesis"] is False,"Gen BnB enabled")
    check("420BNB_BOOKING" in config["deferred_scope"],"booking not deferred")
    consumer=json.loads((root/"config/genesis-consumer-services.json").read_text())
    check(any(f["key"]=="travel.bnb_booking" and f["genesis_default"] is False for f in consumer["feature_flags"]),"booking flag enabled")
    code=(root/"genesis/svc3/travelapp/compatibility.go").read_text()
    for name in ["Reserve","Quote","Pay","Escrow","CancelAndSettle","DynamicPrice"]:
        check(re.search(r"func \(GenesisTravelTransactions\) "+name+r"\([^\n]*ErrTravelTransactionDisabled",code) is not None,f"{name} gate drift")
    sha=subprocess.check_output(["git","rev-parse","HEAD"],cwd=root,text=True).strip()
    check(bool(re.fullmatch("[a-f0-9]{40}",sha)),"SHA invalid")
    print("BNB-1.3 Level 1 and M1 docs/source consistency PASS at "+sha)
if __name__=="__main__":run()
