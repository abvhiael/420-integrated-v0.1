#!/usr/bin/env python3
"""BNB-1.6 source-scoped backend and persistence architecture verifier."""
import json,re,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
doc=(root/"docs/bnb/BNB-1.6-BACKEND-API-AND-PERSISTENCE-ARCHITECTURE.md").read_text()
def check(v,reason):
    if not v: raise SystemExit("BNB-1.6 FAIL: "+reason)
for i in range(1,13): check(f"BNB-B{i:02d}" in doc,f"missing acceptance BNB-B{i:02d}")
for word in ("/v1/bnb","PostgreSQL","cursor","RFC 3339","idempotency","serializable","capacity","outbox","inbox","reorg","private","migration","backup","420Pay","BNB-1.7"):
    check(word.lower() in doc.lower(),f"missing architecture boundary: {word}")
shared=(root/"docs/genesis-services/GEN-SVC-0-ROADMAP.md").read_text()
for term in ("/v1","cursor-based pagination","RFC 3339 UTC","idempotency keys","signed replay-protected webhooks"):
    check(term in shared,f"source GEN-SVC-0 drift: {term}")
cfg=json.loads((root/"config/420travel-genesis.json").read_text())
check(cfg["bnb_compatibility"]["enabled_at_genesis"] is False,"BnB Genesis unexpectedly enabled")
for v in ("420BNB_BOOKING","HOST_ESCROW","CANCELLATION_SETTLEMENT"):
    check(v in cfg["deferred_scope"],"missing deferred scope "+v)
consumer=json.loads((root/"config/genesis-consumer-services.json").read_text())
check(any(x["key"]=="travel.bnb_booking" and x["genesis_default"] is False for x in consumer["feature_flags"]),"consumer booking flag enabled")
source=(root/"genesis/svc3/travelapp/compatibility.go").read_text()
for method in ("Reserve","Quote","Pay","Escrow","CancelAndSettle","DynamicPrice"):
    check(re.search(r"func \(GenesisTravelTransactions\) "+method+r"\([^\n]*ErrTravelTransactionDisabled",source) is not None,"Travel transaction gate changed "+method)
sha=subprocess.check_output(["git","rev-parse","HEAD"],cwd=root,text=True).strip()
check(bool(re.fullmatch("[a-f0-9]{40}",sha)),"invalid SHA")
print("BNB-1.6 source architecture Level 1 PASS; implementation SHA "+sha)
