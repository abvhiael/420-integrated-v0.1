# DOOBR R02.5 — Coarse presence, geofence, capacity and Travel/Maps projection

Status: REPOSITORY FOUNDATION COMMITTED; Level 1 CI NOT YET VERIFIED. PR #601.

Canonical: R02.5 — Coarse regional presence, geofences, capacity and safe Travel/Maps projection; 420Compliance decisions gate eligibility but never leak private courier data.

## Implementation
- `doobr/region_presence.py`: strict tenant/region-bound observation validation, duplicate-courier rejection, stale/future timestamp rejection, current 420Compliance region decision protocol, policy expiry, coarse enum only, minimum privacy anonymity group of three, bounded TTL. Suppressed low-count regions return UNKNOWN (rather than publishing revealing counts).
- `0005_presence.up.sql`: tenant/actor/region FK-bound capacity records, expiry indexing, FORCE RLS and no public grants. Region boundaries and GiST indexing already exist in `0001_initial.up.sql` via PostGIS geometry; no fine coordinates are sent to Travel or Maps.
- `test_region_presence.py` covers policy outage/denial, small groups, staleness, replay/duplicate records, future timestamps, invalid/foreign tenants and capacity categories.
- External Travel/Maps API wiring and PostGIS actual geofence admission/authoritative policy service remain subject to R04.7/R06.4 live adapters, and must not be claimed live. R03.10 supplies read-only user-visible Travel component. No regulated delivery orders enabled.
- No individual courier identity, GPS, location, capacity, counts or geometry in `PublicRegion` response. A public consumer must never receive the private input collection.
- Do not treat the `eligible` flag as independently verified until R02.4 credential/420Compliance decisions and actor session freshness are wired into the ingestion service; forbid real public promotion until that point.
- Level 1: `.github/workflows/doobr-r02-5-level1.yml`. Level 2 R02.13; Level 3 R05.10.
- External regulator/policy signoff and deployed systems deferred to the existing testnet roadmap, not silently marked passing.
Next step, only after qualification: R02.6 Durable order state machine, exactly-once business semantics through idempotent commands, authorization.
