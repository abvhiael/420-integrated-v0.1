#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG = ROOT / "config" / "420classifieds-genesis.json"
DOC = ROOT / "docs" / "genesis-services" / "GEN-SVC-4-CLASSIFIEDS.md"
LOC = ROOT / "config" / "420location-events-genesis.json"
REP = ROOT / "config" / "420reputation-genesis.json"

errors = []
def require(cond, msg):
    if not cond:
        errors.append(msg)

for path in [CFG, DOC, LOC, REP]:
    require(path.exists(), f"missing required file: {path.relative_to(ROOT)}")

if errors:
    print("\n".join("ERROR: " + e for e in errors))
    sys.exit(1)

cfg = json.loads(CFG.read_text(encoding="utf-8"))
loc = json.loads(LOC.read_text(encoding="utf-8"))
rep = json.loads(REP.read_text(encoding="utf-8"))
doc = DOC.read_text(encoding="utf-8")
doc_plain = re.sub(r"[`*_]", "", doc)

require(cfg.get("schema") == "420-classifieds-genesis-v1", "unexpected classifieds schema")
require(cfg.get("phase") == "GEN-SVC-4", "unexpected phase")
require(cfg.get("serviceId") == "420/service/classifieds/v1", "serviceId mismatch")
require(cfg.get("authority") == "REPLACEABLE_APPLICATION", "classifieds must remain replaceable application")

deps = cfg.get("dependencies", {})
require(deps.get("location") == loc.get("services", {}).get("location", {}).get("serviceId"), "location dependency mismatch")
require(deps.get("reputation") == rep.get("serviceId"), "reputation dependency mismatch")
for d in ["messenger","search","notifications","pay","arbitration"]:
    require(bool(deps.get(d)), f"missing dependency {d}")

listing = cfg.get("listing", {})
for f in ["listing_id","seller_id","title","description","category","condition","price_amount","price_asset","location_mode","delivery_modes","status","created_at","updated_at"]:
    require(f in listing.get("required_fields", []), f"missing listing field {f}")
for status in ["DRAFT","ACTIVE","RESERVED","SOLD","CANCELLED","REMOVED"]:
    require(status in listing.get("statuses", []), f"missing status {status}")
for mode in ["LOCAL_PICKUP","LOCAL_DELIVERY","SHIPPING","DIGITAL_DELIVERY"]:
    require(mode in listing.get("delivery_modes", []), f"missing delivery mode {mode}")

offers = cfg.get("offers", {})
for state in ["OPEN","COUNTERED","ACCEPTED","DECLINED","WITHDRAWN","EXPIRED"]:
    require(state in offers.get("states", []), f"missing offer state {state}")
require(offers.get("idempotency_required") is True, "offers must require idempotency")

tx = cfg.get("transactions", {})
require(tx.get("modes", {}).get("IN_PERSON", {}).get("onchain_payment_required") is False, "in-person cannot require on-chain payment")
require(tx.get("modes", {}).get("REMOTE_SHIPPING", {}).get("escrow_supported") is True, "remote shipping must support optional escrow")
require(tx.get("modes", {}).get("DIGITAL_DELIVERY", {}).get("escrow_supported") is True, "digital delivery must support optional escrow")

rep_cfg = cfg.get("reputation", {})
require(rep_cfg.get("domain") == "CLASSIFIEDS", "reputation domain must be CLASSIFIEDS")
require(rep_cfg.get("verified_review_support") is True, "verified reviews must be supported")
require(rep_cfg.get("subjective_rating_storage") == "OFF_CHAIN", "subjective ratings must stay off-chain")

safety = cfg.get("safety", {})
require(safety.get("exact_home_location_public") is False, "exact home location must not be public")
require(safety.get("high_risk_categories_fail_closed") is True, "high-risk categories must fail closed")

routes = set(cfg.get("ui", {}).get("routes", []))
for route in ["/classifieds","/classifieds/search","/classifieds/listing/:listing_id","/classifieds/create","/classifieds/edit/:listing_id","/classifieds/seller/:seller_id","/classifieds/messages","/classifieds/offers"]:
    require(route in routes, f"missing route {route}")

journeys = set(cfg.get("qualification_journeys", []))
for j in ["POST_TO_SEARCH","SEARCH_TO_MESSAGE","MESSAGE_TO_OFFER","OFFER_TO_ACCEPT","ACCEPT_TO_IN_PERSON_COMPLETE","ACCEPT_TO_ESCROW_SETTLEMENT","COMPLETE_TO_REVIEW","PRIVATE_LOCATION_NOT_EXPOSED","PROHIBITED_CATEGORY_FAILS_CLOSED","DUPLICATE_SETTLEMENT_ACTION_REJECTED"]:
    require(j in journeys, f"missing journey {j}")

for i in range(1, 16):
    require(f"GEN-SVC-4.{i}" in doc, f"documentation missing GEN-SVC-4.{i}")

for phrase in ["does not make local classifieds difficult","Acceptance creates transaction intent only","SOLD is a listing state"]:
    require(phrase in doc_plain, f"documentation missing invariant phrase: {phrase}")

if errors:
    print("\n".join("ERROR: " + e for e in errors))
    sys.exit(1)

print("GEN-SVC-4 validation: PASS")
print(f"validated {len(listing.get('delivery_modes', []))} delivery modes, {len(offers.get('states', []))} offer states, {len(journeys)} end-to-end journeys")
