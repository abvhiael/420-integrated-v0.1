# BNB-4.3 — Real-time availability and calendar projections / Level 1 certificate

**Disposition: REPOSITORY LEVEL 1 PASS / EXTERNAL CALENDAR & LIVE RELEASE DEFERRED.**
Canonical step: [BNB-PHASE4-ROADMAP.md](BNB-PHASE4-ROADMAP.md), BNB-4.3. This certificate approves only repository-side projection functionality, not any live provider, booking or legal authority.

## Exact identities

- Repository: `abvhiael/420-integrated-v0.1`, Phase 4 audit branch `audit/bnb-phase4-bnb-4-1-baseline-20261013`, draft PR [#631](https://github.com/abvhiael/420-integrated-v0.1/pull/631), unmerged.
- Current BNB-4.3 qualified implementation SHA: **`6e0d95f20528564a08a355fec2b73ddb42718799`**.
- Phase 4 audit branch starting base: `81c21541acdc1b900b9a15c6f6b75ff2d7c2b5d9`.
- Observed latest main: **`959288c8bd33b6da0325b6a5d060e00e7bcf0e48`**; branch relative to current main at certification **35 ahead, 408 behind**. The latest main integration is deliberately not performed at this Level 1 step. Preserve Phase 4 accumulated audit history, reconcile with actual main at the final integration/Level 3 milestone or earlier if source overlap requires it.
- BNB-4.2 predecessor qualified implementation `7199b6ea32c3d64e04472a0dc1a255c1333a338b` and BNB-4.1 predecessor `a562181a1a0a3d6bb05df401c8182f7a1f768152` preserved in branch history.

## Requirements, implementation and source boundaries

1. **Authoritative live-source calculation:** new `services/420bnb/availability_projection.py` refreshes occupancy through the canonical `occupancy_in_window` function in `services/420bnb/api.py`, which counts confirmed/unexpired holds, property/unit closure blocks and signed ingested external busy intervals. Stale calendar sync raises 503. The projection is explicitly **nonbinding**, never a booking authorization or permission to overbook.
2. **Revisioned PostgreSQL materialization:** `services/420bnb/migrations/023_availability_projection.sql` creates a bounded projection keyed by property/unit/half-open UTC window, storing property version, monotonically incrementing projection revision, source digest, available quantity and refresh/invalidation timestamps. Upserts are serialized with `bnb_property ... FOR UPDATE`, retaining the property row lock invariant used by authoritative inventory mutations. All schema checks now require 23 immutable ordered migrations; earlier migration files were not rewritten.
3. **Bounded public read:** `GET /v1/bnb/availability/projected` accepts a timezone-aware bounded window (at most 90 days, validated by existing window guard), published property only, max 100 units; it recomputes under the property lock for each request and returns only a nonbinding availability, source-version/revision and timestamp projection. No guest IDs, exact property coordinates, private addresses or payment permissions are included.
4. **Invalidation and stale read:** projection module provides invalidation; optional persisted projection reads fail closed on invalidation, wrong property version, suspension, stale timestamp (max 30 seconds) or wrong expected version. The public projected endpoint always refreshes rather than serving stale persisted rows. Replaying or repeating observations cannot create more capacity than canonical source checks allow.
5. **Timezone and DST:** the established `calendar_engine.strict_local_instant` and `local_stay_window` retain explicit zone/fold validation. New tests cover nonexistent DST gap and ambiguous fold. Existing host calendar blocks, independent signed source import/replay verification and booking hold locking are preserved unchanged.
6. **Packaging and deployment:** Dockerfile copies the projection module and BNB-4.2 outbox module into the non-root service image. Production and app CI enforce 23-migration schema and backup/restore ledger integrity, rather than silently downgrading requirements.

Files changed in this step: `services/420bnb/availability_projection.py`, `services/420bnb/migrations/023_availability_projection.sql`, `services/420bnb/api.py`, `services/420bnb/Dockerfile`, `services/420bnb/tests/test_bnb43_projection.py`, migration/ops tests, `services/420bnb/production.py`, baseline verifier, and `.github/workflows/bnb-runtime.yml`.

## Exact-SHA Level 1 qualification evidence

- **420BnB Runtime Slice** [run 38444841140](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38444841140), job `115460409745`: **COMPLETED SUCCESS** against exact implementation SHA `6e0d95f20528564a08a355fec2b73ddb42718799`.
- Logs: **8 operations/migration tests passed** and **241 full app/API/security tests passed** = **249 total test passes**, no reported failures. Includes all BNB-4.3 source/revision/freshness/DST tests, retained booking/hold/concurrency/adversarial suites, migration integrity, isolated TLS, backup-and-restore, non-root image build/staging, browser accessibility smoke and runtime configuration checks.
- **Nine retained 420BnB BNB-1.1…1.9 workflows SUCCESS** on same SHA: `38444840835`, `38444841121`, `38444841200`, `38444840789`, `38444840973`, `38444841096`, `38444841026`, `38444841008`, `38444841080`.
- Global Docs run `38444841236`: **SKIPPED** and not credited. Oracle audit run `38444841070`: **QUEUED** at inspection and not credited. Independent Oracle provider deployment is an external gate, not substituted by synthetic app tests.
- Superseded failing CI runs diagnosed root causes: concurrent-migration assertion at 22 rather than 23, backup/restore ledger count still 22, and API container missing the new projection module. These were corrected in test expectations, CI schema inventory and Dockerfile respectively; prior failures were never counted PASS.

## Security limits, deferrals and next work

- No independent Calendar issuer or operational feed authorization was asserted. Real calendar source ingestion remains **T-BNB-CALENDAR-1 DEFERRED** until independently signed issuer/key/revocation and end-to-end feed evidence exist.
- Existing provider gates for Identity, property, Travel/Location/Search, Compliance, Pay/Wallet, media/reputation, manual accessibility and operational/security/legal approvals remain under [BNB-TESTNET-WORK-ROADMAP.md](BNB-TESTNET-WORK-ROADMAP.md). `travel.bnb_booking=false`; no payment or live booking activation.
- The projection is deliberately **on-demand** rather than a continuously pushed availability subscription. Production-equivalent high-concurrency load/performance, authorized external feed scenarios and actual cross-process operation are not witnessed in this Level 1 repository certificate. The canonical capacity and financial invariants remain enforced by authoritative transactional writers.
- M4-A Level 2 at **BNB-4.7**, M4-B Level 2 at **BNB-4.11**, full Level 3 at **BNB-4.12**, not triggered for this ordinary step. Keep PR #631 draft/unmerged.

**Exit assessment:** source-authoritative versioned read model implemented and app-specific negative/source freshness/DST/ops/security suites pass on a single exact SHA; restricted external acceptances remain explicitly blocked.

**Next canonical step: BNB-4.4 — Privacy-safe Search and Travel consumer synchronization.**
