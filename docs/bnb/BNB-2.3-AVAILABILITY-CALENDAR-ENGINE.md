# BNB-2.3 — Availability and Calendar Engine

**Status:** STARTED — canonical BNB-2 phase planning handoff; no Level 1 qualification yet.
**Prior phase plan:** BNB-2.3 follows Host and Property Management (BNB-2.2). Level 1 per step, retained app milestone M1 at BNB-2.5. Follow repository authority if a newer formally committed roadmap supersedes this step definition.

## Purpose and exit criteria

Build correct, privacy-safe guest/host availability across bounded unit quantities, calendar closures and hold lifecycles. Keep payment, listing approval and booking finality disabled until independently authorized upstream services exist.

1. Date-window occupancy in property IANA timezone with half-open UTC intervals, minimum stay, boundary-touching nonoverlap and explicit DST ambiguity handling; no client-clock trust.
2. Unit-specific capacity and availability projections: sum concurrently overlapping live holds, reservations and host closures without double-counting non-concurrent intervals. Maintain property-level quantity conservation.
3. Host calendar closures, unit or property-wide blocks, editing/removal, version/CAS and concurrent lock isolation. Manager capability and revocation checks, without financial authority.
4. Guest read-only availability endpoints expose only approved published listings, coarse location and bounded available quantity. A read-side answer is not an inventory reservation.
5. Transactional hold admission with unique idempotency/digest, expiration and replay denial; parallel multi-process PostgreSQL/HTTP competing reservations cannot exceed capacity.
6. Calendar synchronization adapters and failure semantics (import provenance, duplicate/replay detection, stale data and external outage fail-close); never grant source-of-truth booking authority to third-party calendars.
7. Level 1: targeted PostgreSQL/unit+multi-process contention tests, property/timezone/DST boundaries, overlapping intervals, blocks, release/expiry/idempotency, authorization negatives, affected frontend/CI and exact-SHA evidence. Level 2 app integration at documented M1; Level 3 only phase closeout.

## Baseline retained from BNB-2.2

- `008_unit_hold_allocation.sql` plus unit selection, row locking and quantity-bound nonbinding holds.
- Two Uvicorn instances sharing PostgreSQL, overlapping hold conflict checks, host calendar block creation/removal and IANA timezone offset validation.
- Automated Chromium/axe accessibility smoke; live/human signoff and independent media approval separately deferred in `BNB-TESTNET-WORK-ROADMAP.md`.

## Immediate gap analysis to implement

- Current hold occupancy sums **every** overlapping reservation for an entire requested range; adjacent non-concurrent holds may be conservatively double-counted. Implement sweep-line peak concurrency rather than naive aggregate to preserve quantity availability.
- Existing calendar blocks reject any overlapping block for the same unit; evaluate quantity-aware partial closures and full-property blocks without overallocating.
- Host timezone offsets need stricter local-date/DST-fold and gap rules, not just offset comparisons.
- Guest availability projections, external calendar sync idempotency/provenance and read-side freshness markers are not fully implemented.
- Production Pay/Identity/property authority integration remains a distinct testnet gate; do not promote local held status to canonical confirmed reservation.

**Next work:** implement conservative accurate sweep-line inventory calculation plus boundary/concurrency tests, then unit-aware availability read API, timezone and calendar synchronization controls. Do not label BNB-2.3 complete until individually qualified.
