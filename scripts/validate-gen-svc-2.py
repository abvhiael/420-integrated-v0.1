#!/usr/bin/env python3
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG = ROOT / "config" / "420location-events-genesis.json"
DOC = ROOT / "docs" / "genesis-services" / "GEN-SVC-2-LOCATION-EVENTS.md"

errors = []

def require(cond, msg):
    if not cond:
        errors.append(msg)

require(CFG.exists(), "missing config/420location-events-genesis.json")
require(DOC.exists(), "missing GEN-SVC-2 documentation")
if errors:
    print("\n".join("ERROR: " + e for e in errors))
    sys.exit(1)

cfg = json.loads(CFG.read_text(encoding="utf-8"))
doc = DOC.read_text(encoding="utf-8")

require(cfg.get("schema") == "420-location-events-genesis-v1", "unexpected schema")
require(cfg.get("phase") == "GEN-SVC-2", "unexpected phase")

services = cfg.get("services", {})
require(services.get("location", {}).get("serviceId") == "420/service/location/v1", "location serviceId mismatch")
require(services.get("events", {}).get("serviceId") == "420/service/events/v1", "events serviceId mismatch")
require(services.get("location", {}).get("map_provider_policy") == "provider-neutral", "map provider must remain neutral")
require(services.get("location", {}).get("geospatial_index_authority") == "NON_CANONICAL_REBUILDABLE", "geospatial index must be rebuildable/non-canonical")
require(services.get("events", {}).get("event_discovery_authority") == "NON_CANONICAL_REBUILDABLE", "event discovery must be rebuildable/non-canonical")

place = cfg.get("place", {})
for field in ["place_id","name","category","visibility","source","created_at","updated_at"]:
    require(field in place.get("required_fields", []), f"missing place field {field}")
require("PRIVATE" in place.get("location_precision", []), "place precision must support PRIVATE")
require("EXACT_PUBLIC_PLACE" in place.get("location_precision", []), "place precision must support exact public places")

event = cfg.get("event", {})
for field in ["event_id","organizer_id","title","start_at","end_at","timezone","visibility","status","created_at","updated_at"]:
    require(field in event.get("required_fields", []), f"missing event field {field}")
for status in ["DRAFT","SCHEDULED","LIVE","ENDED","CANCELLED"]:
    require(status in event.get("statuses", []), f"missing event status {status}")

queries = set(cfg.get("queries", {}).get("supported", []))
for q in ["NEAR_POINT","WITHIN_RADIUS","WITHIN_REGION","BOUNDING_BOX","NEAR_ROUTE","EVENTS_BY_DATE_RANGE","EVENTS_NEAR_POINT"]:
    require(q in queries, f"missing query {q}")

caps = set(cfg.get("provider_abstraction", {}).get("capabilities", []))
for cap in ["GEOCODE","REVERSE_GEOCODE","MAP_TILES","ROUTING","PLACE_LOOKUP"]:
    require(cap in caps, f"missing provider capability {cap}")

privacy = cfg.get("privacy", {})
require(privacy.get("coarse_search_supported") is True, "coarse search must be supported")
require(privacy.get("visibility_before_indexing") is True, "visibility must be applied before indexing")
require(privacy.get("precise_location_logging_default") is False, "precise location logging must default false")
require(privacy.get("private_location_export") is False, "private location export must default false")

integrations = cfg.get("integrations", {})
for name in ["420Travel","420Classifieds","420Calendar","420Notifications","420Search","420Registry","420Verify"]:
    require(name in integrations, f"missing integration {name}")

for i in range(1, 11):
    require(f"GEN-SVC-2.{i}" in doc, f"documentation missing GEN-SVC-2.{i}")

for phrase in ["provider-neutral","private residential coordinates","rebuildable projections","does not create a new geographic authority"]:
    require(phrase in doc, f"documentation missing invariant phrase: {phrase}")

if errors:
    print("\n".join("ERROR: " + e for e in errors))
    sys.exit(1)

print("GEN-SVC-2 validation: PASS")
print(f"validated {len(place.get('categories', []))} place categories, {len(event.get('statuses', []))} event statuses, {len(queries)} query modes")
