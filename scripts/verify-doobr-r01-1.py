#!/usr/bin/env python3
"""DOOBR R01.1 scoped baseline inventory verifier. No network dependency."""
from pathlib import Path
import json, hashlib, sys

ROOT = Path(__file__).resolve().parents[1]
def read(path): return (ROOT / path).read_text(encoding="utf-8")
def assert_true(condition, message):
    if not condition: raise SystemExit("FAIL: " + message)
    print("PASS:", message)

roadmap=read("docs/doobr/DOOBR-R01-R06-ROADMAP.md")
report=read("docs/doobr/DOOBR-R01-1-INVENTORY-AND-GAPS.md")
catalog=json.loads(read("config/genesis-applications.json"))
services=json.loads(read("config/genesis-consumer-services.json"))
travel=json.loads(read("config/420travel-genesis.json"))
compat=read("genesis/svc3/travelapp/compatibility.go")
vault=read("contracts/src/revenue/DevelopmentCompensationVault420.sol")
assert_true("R01.1 Repository inventory and gap audit against current main" in roadmap,"unaltered canonical R01.1 roadmap step")
assert_true(all(f"R0{i} —" in roadmap for i in range(1,7)),"R01-R06 stable phase numbering")
assert_true("DOOBR" not in [a["name"] for a in catalog["apps"]],"no fictitious frozen DOOBR Genesis app")
flags={v["key"]:v["genesis_default"] for v in services["feature_flags"]}
assert_true(flags.get("travel.doobr_transactions") is False,"Travel DOOBR transaction gate defaults disabled")
assert_true(all(k in compat for k in ["ServiceProvider", "ServiceArea", "DeliveryWindow", "ServiceRequest", "ErrTravelTransactionDisabled"]),"Travel compatibility records and disabled gateway exist")
assert_true("DevelopmentCompensationVault420" in vault,"canonical Dev Compensation Vault exists")
assert_true("420Compliance" in roadmap and "420Travel" in roadmap,"Compliance and Travel integration boundaries documented")
assert_true("British Columbia" in roadmap and "Vancouver" in roadmap,"BC Vancouver baseline retained")
assert_true("R01.2 Standalone product authorization decision" in roadmap,"next canonical step unchanged")
assert_true(all(k in report for k in ["SATISFIED", "PARTIAL", "MISSING", "BLOCKED", "Level 1", "main", "R01.2"]),"inventory gap and qualification metadata recorded")
assert_true("DOOBR-AUDIT-9" in report and "DOOBR-AUDIT-10" in report,"deferred original testnet steps distinguished")
print("DOOBR R01.1 source assertions complete")

# R01.2 documentary development authority: no product decision can create Genesis
# protocol, monetary, regulatory, or transaction execution authorization.
decision=read("docs/doobr/DOOBR-R01-2-PRODUCT-AUTHORIZATION.md")
assert_true("R01.2 Standalone product authorization decision" in roadmap,"canonical R01.2 intact")
for required in ["NOT AUTHORIZED", "NOT INTEGRATED", "DevelopmentCompensationVault420",
                 "420Compliance", "420Travel/Maps", "420Pay", "Vancouver",
                 "DOOBR-AUDIT-9/10", "R01.3 Consumer/courier/retailer/operator"]:
    assert_true(required in decision,"R01.2 authority evidence: "+required)
assert_true("DOOBR" not in [a["name"] for a in catalog["apps"]],"R01.2 did not promote Genesis app")
assert_true(flags.get("travel.doobr_transactions") is False,"R01.2 preserves disabled Travel transaction authority")
