#!/usr/bin/env python3
"""BNB-1.8 scoped security/privacy/abuse architecture qualification."""
from pathlib import Path
import json,re,subprocess
root=Path(__file__).resolve().parents[1]
doc=(root/"docs/bnb/BNB-1.8-SECURITY-PRIVACY-AND-ABUSE-ARCHITECTURE.md").read_text()
def ck(ok,msg):
    if not ok: raise SystemExit("BNB-1.8 FAIL: "+msg)
for n in range(1,15):ck(f"BNB-S{n:02d}" in doc,f"missing BNB-S{n:02d}")
for name in ("420Pay","420Swap","420Arbitration","420Reputation","SPAM","SYBIL","FAKE_REVIEWS","LOCATION_PRIVACY","WEBHOOK_REPLAY","capacity","idempotency","PII","BNB-1.9"):
    ck(name.lower() in doc.lower(),"missing required boundary "+name)
threat=(root/"docs/genesis-services/THREAT-MODEL.md").read_text()
for item in ("SPAM","SYBIL","FAKE_REVIEWS","SELLER_FRAUD","LOCATION_PRIVACY"):
    ck(item in threat,"shared threat model changed "+item)
fin=(root/"docs/bnb/BNB-1.5-PAYMENT-AND-SETTLEMENT-ARCHITECTURE.md").read_text()
ck("420Pay" in fin and "420Swap" in fin,"canonical financial ownership drift")
cfg=json.loads((root/"config/420travel-genesis.json").read_text())
ck(cfg["bnb_compatibility"]["enabled_at_genesis"] is False,"Genesis BnB transactions enabled")
consumer=json.loads((root/"config/genesis-consumer-services.json").read_text())
ck(any(x["key"]=="travel.bnb_booking" and x["genesis_default"] is False for x in consumer["feature_flags"]),"travel booking flag enabled")
source=(root/"genesis/svc3/travelapp/compatibility.go").read_text()
for method in ("Reserve","Quote","Pay","Escrow","CancelAndSettle","DynamicPrice"):
    ck(re.search(r"func \(GenesisTravelTransactions\) "+method+r"\([^\n]*ErrTravelTransactionDisabled",source) is not None,"Travel gate drift "+method)
sha=subprocess.check_output(["git","rev-parse","HEAD"],cwd=root,text=True).strip()
ck(bool(re.fullmatch("[a-f0-9]{40}",sha)),"SHA absent")
print("BNB-1.8 design/security Level 1 PASS; implementation SHA "+sha)
