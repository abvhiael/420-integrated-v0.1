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

# R01.3 scoped role/permission, journeys, abuse and operations design assertions.
r13=read("docs/doobr/DOOBR-R01-3-ROLES-JOURNEYS-THREATS.md")
assert_true("R01.3 Consumer/courier/retailer/operator roles" in roadmap,"canonical R01.3 intact")
for actor in ["CONSUMER","COURIER","RETAILER","OPERATOR","COMPLIANCE_SERVICE","SYSTEM_SERVICE"]:
    assert_true(actor in r13,"R01.3 actor documented: "+actor)
for marker in ["Consumer discovery","Consumer order","Retailer handoff","Courier lifecycle","Operator exceptions","Reconciliation",
               "ELIGIBILITY_PENDING","RETURN_REQUIRED","420Compliance","420Pay","DevelopmentCompensationVault420",
               "Travel/Maps", "FAIL CLOSED", "dual control", "R01.4 BC/Vancouver"]:
    assert_true(marker in r13,"R01.3 journey/authority/constraint: "+marker)
for i in range(1,19):
    assert_true(f"R13-T{i:02d}" in r13, f"R01.3 threat R13-T{i:02d} documented")
assert_true(flags.get("travel.doobr_transactions") is False,"R01.3 has not activated Travel regulated transactions")
assert_true("DOOBR" not in [a["name"] for a in catalog["apps"]],"R01.3 has not altered frozen Genesis catalog")

# R01.4 source-to-policy and external dependency design assertions.
r14=read("docs/doobr/DOOBR-R01-4-BC-VANCOUVER-COMPLIANCE-CONTRACT.md")
assert_true("R01.4 BC/Vancouver legal matrix" in roadmap,"canonical R01.4 unchanged")
for item in ["LICENSEE_EMPLOYEE", "DELIVERY_PERSON", "COMMON_CARRIER",
             "ComplianceEvaluateDelivery/v1", "ComplianceDecision/v1",
             "ComplianceCoverage/v1", "420Compliance-owned", "fail closed",
             "America/Vancouver", "DevelopmentCompensationVault420",
             "BC/Vancouver", "R01.5 Protocol authority contracts"]:
    assert_true(item in r14,"R01.4 compliance design: "+item)
for i in range(1,14):
    assert_true(f"BC-{i:02d}" in r14,"R01.4 BC matrix case "+str(i))
assert_true("VAN-01" in r14 and "FIN-01" in r14,"R01.4 municipal and fee gates")
for i in range(1,13):
    assert_true(f"{i}. " in r14,"R01.4 written regulatory question "+str(i))
assert_true(flags.get("travel.doobr_transactions") is False,"R01.4 preserved disabled Travel transaction gateway")

# R01.5 authority contract and presence projection documentary boundary assertions.
r15=read("docs/doobr/DOOBR-R01-5-PROTOCOL-AND-PRESENCE-BOUNDARIES.md")
assert_true("R01.5 Protocol authority contracts" in roadmap,"canonical R01.5 unchanged")
for token in ["420Compliance","420Pay","DevelopmentCompensationVault420","420Travel/Maps",
              "420Identity","420Notifications","420Arbitration","420Location",
              "LICENSEE_EMPLOYEE","DELIVERY_PERSON","COMMON_CARRIER",
              "ALLOW|DENY|UNKNOWN","doobr-presence/v1","AVAILABLE|LIMITED|UNAVAILABLE|UNKNOWN",
              "signature","request_hash","revocation_epoch","fail closed","R01.6 Security/privacy"]:
    assert_true(token in r15, "R01.5 authority/presence invariant: "+token)
for i in range(1,17):
    assert_true(f"R15-T{i:02d}" in r15 if i==1 else f"T{i:02d}" in r15,
                "R01.5 adversarial vector "+str(i))
for forbidden in ["courier_id","address","order_id","phone"]:
    assert_true(forbidden in r15,"R01.5 forbids public field "+forbidden)
assert_true("DOOBR" not in [a["name"] for a in catalog["apps"]],"R01.5 does not promote Genesis app")
assert_true(flags.get("travel.doobr_transactions") is False,"R01.5 Travel gateway stays fail closed")
