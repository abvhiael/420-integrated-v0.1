#!/usr/bin/env python3
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG = ROOT / "config" / "420travel-genesis.json"
DOC = ROOT / "docs" / "genesis-services" / "GEN-SVC-3-TRAVEL.md"
LOC = ROOT / "config" / "420location-events-genesis.json"
REP = ROOT / "config" / "420reputation-genesis.json"

errors = []

def require(cond, msg):
    if not cond:
        errors.append(msg)

for p in [CFG, DOC, LOC, REP]:
    require(p.exists(), f"missing required file: {p.relative_to(ROOT)}")

if errors:
    print("\n".join("ERROR: " + e for e in errors))
    sys.exit(1)

cfg = json.loads(CFG.read_text(encoding="utf-8"))
loc = json.loads(LOC.read_text(encoding="utf-8"))
rep = json.loads(REP.read_text(encoding="utf-8"))
doc = DOC.read_text(encoding="utf-8")

require(cfg.get("schema") == "420-travel-genesis-v1", "unexpected travel schema")
require(cfg.get("phase") == "GEN-SVC-3", "unexpected phase")
require(cfg.get("serviceId") == "420/service/travel/v1", "travel serviceId mismatch")
require(cfg.get("authority") == "REPLACEABLE_APPLICATION", "travel must remain replaceable application")

deps = cfg.get("dependencies", {})
require(deps.get("location") == loc.get("services", {}).get("location", {}).get("serviceId"), "location dependency mismatch")
require(deps.get("events") == loc.get("services", {}).get("events", {}).get("serviceId"), "events dependency mismatch")
require(deps.get("reputation") == rep.get("serviceId"), "reputation dependency mismatch")

scope = set(cfg.get("genesis_scope", []))
for item in ["DESTINATION_SEARCH","NEARBY_DISCOVERY","MAP_LIST_HYBRID","PLACE_PAGES","EVENT_DISCOVERY","TRAVEL_REVIEWS","SAVED_TRIPS","BUSINESS_CLAIMS"]:
    require(item in scope, f"missing Genesis scope {item}")

deferred = set(cfg.get("deferred_scope", []))
for item in ["420BNB_BOOKING","DOOBR_TRANSACTION_FLOWS","DYNAMIC_PRICING","HOST_ESCROW","CANCELLATION_SETTLEMENT"]:
    require(item in deferred, f"missing deferred scope {item}")

reviews = cfg.get("reviews", {})
require(reviews.get("domain") == "TRAVEL", "reviews must use TRAVEL domain")
require(reviews.get("verified_interactions_supported") is True, "verified interactions must be supported")
require(reviews.get("review_body_storage") == "OFF_CHAIN", "review bodies must stay off-chain")

claims = cfg.get("business_claims", {})
require(claims.get("claim_does_not_create_registry_authority") is True, "business claim cannot create Registry authority")
require(claims.get("claim_does_not_create_reputation") is True, "business claim cannot create reputation")

bnb = cfg.get("bnb_compatibility", {})
doobr = cfg.get("doobr_compatibility", {})
require(bnb.get("enabled_at_genesis") is False, "420BnB booking must be disabled at Genesis")
require(doobr.get("enabled_at_genesis") is False, "DOOBR transactions must be disabled at Genesis")

routes = set(cfg.get("ui", {}).get("routes", []))
for route in ["/travel","/travel/map","/travel/place/:place_id","/travel/events","/travel/trips","/travel/business/claim"]:
    require(route in routes, f"missing route {route}")

journeys = set(cfg.get("qualification_journeys", []))
for journey in ["DESTINATION_TO_PLACE","NEARBY_TO_EVENT","PLACE_TO_VERIFIED_REVIEW","BUSINESS_CLAIM_WITH_REGISTRY_PROVENANCE","PRIVATE_TRIP_NOT_PUBLICLY_INDEXED","DEFERRED_BNB_FAILS_CLOSED","DEFERRED_DOOBR_FAILS_CLOSED"]:
    require(journey in journeys, f"missing journey {journey}")

for i in range(1, 11):
    require(f"GEN-SVC-3.{i}" in doc, f"documentation missing GEN-SVC-3.{i}")

for phrase in ["not yet a full Expedia/Airbnb transaction system","Verification is provenance, not endorsement","schema/interface hooks only"]:
    require(phrase in doc, f"documentation missing invariant phrase: {phrase}")

if errors:
    print("\n".join("ERROR: " + e for e in errors))
    sys.exit(1)

print("GEN-SVC-3 validation: PASS")
print(f"validated {len(scope)} Genesis travel capabilities, {len(deferred)} deferred capabilities, {len(journeys)} journeys")
