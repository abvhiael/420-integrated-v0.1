# BNB-2.3 — Availability and Calendar Engine

**Status:** REPOSITORY-SIDE LEVEL 1 PASS (implementation SHA `0b025f776d1c88ab38df959e2a5ef4a8f6a1a56b`; [runtime CI #38087076160](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38087076160)). External live calendar-issuer/provider and unrelated manual approvals remain deferred.
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

## BNB-2.3 implementation and exact-qualification handoff (2026-10-10)

Repository-side implementation on PR #600 now includes:

- Public **published-only** `GET /v1/bnb/availability` by property/unit and UTC half-open date range, privacy-safe coarse fields, quantity remaining, property revision and nonbinding `as_of` stamp. `/v1/bnb/availability/local` adds check-in/checkout date projection with IANA timezone and minimum-night policy.
- `calendar_engine.py`: sweep-line peak concurrent occupancy for holds, bounded quantity closures and signed calendar busy observations; edge-touching intervals do not overlap. Strict IANA local-time resolution rejects nonexistent DST times and requires explicit fold for ambiguous clocks.
- Migration `009_availability_sync.sql`: bounded partial-unit closures and signed external busy-event provenance. Property-wide closures remain all-or-nothing. Host unit closure creation, version-checked atomic rescheduling and release preserve property-row locking and rollback on capacity conflicts.
- Independent `BNB_CALENDAR_SYNC_*` signed claim ingest, full request SHA-256 binding, source-id/external event ID/JTI uniqueness, 24-hour freshness limit and outage/stale-data fail-close for previously ingested affected inventory. This is an **adapter**, not operational permission to trust a provider; live provider authorization stays external/testnet dependent.
- Migration `010_minimum_stay_policy.sql`: enforce property IANA local date-based minimum nights for guest previews and hold admission, bounded 1–90 nights.
- Owner-only atomic cancellation of nonbinding holds, expired/cancelled idempotency replay state, active-occupancy filtering and zero financial confirmation authority.
- PostgreSQL tests for privacy, published-only reads, quantity closures, atomic block edit rollback and contention, property-wide closure, cross-property/anonymous denial, DST fold/gap, signed sync accepted/replayed/wrong scope/tampered/stale, expiration/cancellation and minimum stay.
- Chromium mocked-API guest/host browser journeys, mobile/desktop axe-core accessibility scans, same narrow CI and two actual Uvicorn processes sharing PostgreSQL. The runtime Dockerfile explicitly includes the new calendar engine module.

**Level 1:** targeted runtime qualification must be checked on one final exact implementation SHA. Older CI run #38086650647 failed its staging-container import because `calendar_engine.py` was missing from Dockerfile; this was remedied in the branch. Do not mark final status PASS until corrected exact-SHA runtime and affected workflows complete successfully. Evidence-only additions can inherit qualified SHA; further implementation changes cannot.

**Remaining operational testnet/external requirements:** real authorized calendar issuer/provider credentials, staged provider key rotation/revocation/outage, publication authority, financial settlement/confirmation and human accessibility/media reviewer approvals remain on the BNB testnet roadmap. These do not authorize restricted features merely because local integration tests pass. Full independent downstream release acceptance is distinct from BNB-2.3 repository-side Level 1.

## BNB-2.3 final repository-side Level 1 closeout

The latest exact implementation SHA `0b025f776d1c88ab38df959e2a5ef4a8f6a1a56b` passed targeted PostgreSQL, security, parallel two-process HTTP inventory, signed calendar sync, DST/minimum stay, hold expiry/cancellation, non-root container staging and automated browser/axe tests in workflow #38087076160. Nine other existing BnB workflows also passed; 420Docs Qualification was appropriately skipped, as no Level 3 was scheduled. Evidence: `docs/bnb/qualification/BNB-2.3-LEVEL1-REPOSITORY-CLOSEOUT.json`.

The earlier CI container import defect is corrected by including `calendar_engine.py` in the staging Dockerfile. Local signed-adapter coverage does not certify a real approved external calendar provider. No publication or financial authority was activated. Evidence/documentation-only commits inherit this qualified implementation SHA; executable changes would require new Level 1 qualification. 
