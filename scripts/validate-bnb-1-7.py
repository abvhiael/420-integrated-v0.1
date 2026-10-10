#!/usr/bin/env python3
"""BNB-1.7 guest and host UX design/source boundary qualifier."""
import json,re,subprocess
from pathlib import Path
r=Path(__file__).resolve().parents[1]
d=(r/"docs/bnb/BNB-1.7-GUEST-AND-HOST-EXPERIENCE-ARCHITECTURE.md").read_text()
def ck(v,s):
    if not v: raise SystemExit("BNB-1.7 FAIL: "+s)
for n in range(1,17): ck(f"BNB-U{n:02d}" in d,f"missing UX acceptance U{n:02d}")
prior=(r/"docs/bnb/BNB-1.2-PRODUCT-SCOPE-AND-USER-JOURNEYS.md").read_text()
for n in range(1,17): ck(f"BNB-J{n:02d}" in prior,f"missing journey J{n:02d}")
for word in ("420Pay","420Swap","420Arbitration","420Reputation","WCAG","calendar","refund","capacity","reorg","privacy","BNB-1.8","guest","host","pending"):
    ck(word.lower() in d.lower(),f"missing UX boundary {word}")
backend=(r/"docs/bnb/BNB-1.6-BACKEND-API-AND-PERSISTENCE-ARCHITECTURE.md").read_text()
ck("/v1/bnb/" in backend,"backend API missing")
finance=(r/"docs/bnb/BNB-1.5-PAYMENT-AND-SETTLEMENT-ARCHITECTURE.md").read_text()
ck("420Pay" in finance and "420Swap" in finance,"canonical finance authority drift")
cfg=json.loads((r/"config/420travel-genesis.json").read_text())
ck(cfg["bnb_compatibility"]["enabled_at_genesis"] is False,"BnB genesis enabled")
c=json.loads((r/"config/genesis-consumer-services.json").read_text())
ck(any(f["key"]=="travel.bnb_booking" and f["genesis_default"] is False for f in c["feature_flags"]),"BnB consumer feature enabled")
src=(r/"genesis/svc3/travelapp/compatibility.go").read_text()
for name in ("Reserve","Quote","Pay","Escrow","CancelAndSettle","DynamicPrice"):
    ck(re.search(r"func \(GenesisTravelTransactions\) "+name+r"\([^\n]*ErrTravelTransactionDisabled",src) is not None,"Travel transaction gate changed: "+name)
sha=subprocess.check_output(["git","rev-parse","HEAD"],cwd=r,text=True).strip()
ck(bool(re.fullmatch("[0-9a-f]{40}",sha)),"invalid SHA")
print("BNB-1.7 Level 1 design/source consistency PASS at "+sha)
