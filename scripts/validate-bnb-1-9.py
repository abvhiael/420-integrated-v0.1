#!/usr/bin/env python3
"""BNB-1.9 scoped deployment/operations architecture verification."""
import json,re,subprocess
from pathlib import Path
r=Path(__file__).resolve().parents[1]
d=(r/"docs/bnb/BNB-1.9-DEPLOYMENT-AND-OPERATIONS-ARCHITECTURE.md").read_text()
def ck(v,msg):
    if not v: raise SystemExit("BNB-1.9 FAIL: "+msg)
for n in range(1,13):ck(f"BNB-O{n:02d}" in d,"missing BNB-O"+str(n))
for word in ("420Pay","420Swap","ProtocolRegistry","PITR","rollback","outbox","idempotency","PII","testnet","BNB-1.10","SLO","reorg","custody","health","backup"):
    ck(word.lower() in d.lower(),"missing operations boundary "+word)
for n in range(5,9):
    name={5:"PAYMENT-AND-SETTLEMENT-ARCHITECTURE",6:"BACKEND-API-AND-PERSISTENCE-ARCHITECTURE",7:"GUEST-AND-HOST-EXPERIENCE-ARCHITECTURE",8:"SECURITY-PRIVACY-AND-ABUSE-ARCHITECTURE"}[n]
    ck((r/"docs"/"bnb"/(f"BNB-1.{n}-"+name+".md")).is_file(),f"missing prior BNB-1.{n}")
pay=(r/"docs/apps/pay/deployment-operations.md").read_text()
ck("Registry-resolved" in pay and "address" in pay,"Pay deployment authority missing")
cfg=json.loads((r/"config/420travel-genesis.json").read_text())
ck(cfg["bnb_compatibility"]["enabled_at_genesis"] is False,"BnB Genesis enabled")
for flag in ("420BNB_BOOKING","HOST_ESCROW","CANCELLATION_SETTLEMENT"):
    ck(flag in cfg["deferred_scope"],"not deferred "+flag)
consumer=json.loads((r/"config/genesis-consumer-services.json").read_text())
ck(any(f["key"]=="travel.bnb_booking" and f["genesis_default"] is False for f in consumer["feature_flags"]),"consumer BnB enabled")
src=(r/"genesis/svc3/travelapp/compatibility.go").read_text()
for name in ("Reserve","Quote","Pay","Escrow","CancelAndSettle","DynamicPrice"):
    ck(re.search(r"func \(GenesisTravelTransactions\) "+name+r"\([^\n]*ErrTravelTransactionDisabled",src) is not None,"Travel gateway drift "+name)
sha=subprocess.check_output(["git","rev-parse","HEAD"],cwd=r,text=True).strip()
ck(bool(re.fullmatch("[a-f0-9]{40}",sha)),"SHA missing")
print("BNB-1.9 Level 1 architecture-source PASS at "+sha)
