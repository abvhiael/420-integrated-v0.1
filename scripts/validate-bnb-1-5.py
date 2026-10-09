#!/usr/bin/env python3
"""BNB-1.5 Level 1 plus M2 source-consistency verification."""
import json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
NAMES={1:"CANONICAL-SOURCE-RECONCILIATION",2:"PRODUCT-SCOPE-AND-USER-JOURNEYS",3:"DOMAIN-MODEL-AND-STATE-MACHINES",4:"PROTOCOL-AUTHORITY-AND-INTEGRATION-BOUNDARIES",5:"PAYMENT-AND-SETTLEMENT-ARCHITECTURE"}
def check(ok,why):
    if not ok: raise SystemExit("BNB-M2 FAIL: "+why)
def main():
    docs={n:(ROOT/"docs"/"bnb"/(f"BNB-1.{n}-"+name+".md")).read_text() for n,name in NAMES.items()}
    d=docs[5]
    for n in range(1,11):
        check(f"BNB-F{n:02d}" in d,f"missing financial requirement F{n:02d}")
        check(f"BNB-A{n:02d}" in docs[4],f"missing authority requirement A{n:02d}")
    for n in range(1,13):check(f"BNB-D{n:02d}" in docs[3],f"missing domain requirement D{n:02d}")
    for n in range(1,17):check(f"BNB-P{n:02d}" in docs[2],f"missing product requirement P{n:02d}")
    for word in ("420Pay","420Swap","invoice","finality","refund","payout","idempotency","reorg","custody","Arbitration","BNB-1.6","governance","liability_remaining"):
        check(word.lower() in d.lower(),f"missing financial boundary {word}")
    for rel in ("contracts/src/pay/PaymentRouter420.sol","contracts/src/pay/PaymentRegistry420.sol","contracts/src/pay/RefundManager420.sol","contracts/src/pay/SettlementRouter420.sol","contracts/src/pay/InvoiceRegistry420.sol","contracts/src/pay/MerchantRegistry420.sol","contracts/src/pay/adapters/CanonicalSettlementAdapter420.sol"):
        check((ROOT/rel).is_file(),f"canonical Pay dependency absent: {rel}")
    cfg=json.loads((ROOT/"config/420travel-genesis.json").read_text())
    check(cfg["bnb_compatibility"]["enabled_at_genesis"] is False,"BnB Genesis enabled")
    for f in ("420BNB_BOOKING","HOST_ESCROW","CANCELLATION_SETTLEMENT","DYNAMIC_PRICING","INSURANCE_OR_DAMAGE_DEPOSITS"):
        check(f in cfg["deferred_scope"],f"deferred guard missing: {f}")
    consumer=json.loads((ROOT/"config/genesis-consumer-services.json").read_text())
    check(any(x["key"]=="travel.bnb_booking" and x["genesis_default"] is False for x in consumer["feature_flags"]),"Genesis default must be disabled")
    code=(ROOT/"genesis/svc3/travelapp/compatibility.go").read_text()
    for op in ("Reserve","Quote","Pay","Escrow","CancelAndSettle","DynamicPrice"):
        check(re.search(r"func \(GenesisTravelTransactions\) "+op+r"\([^\n]*ErrTravelTransactionDisabled",code) is not None,f"operation changed: {op}")
    head=subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip()
    check(bool(re.fullmatch("[0-9a-f]{40}",head)),"SHA unavailable")
    print("BNB-1.5 Level 1 and M2 Level 2 source consistency PASS at "+head)
if __name__=="__main__":main()
