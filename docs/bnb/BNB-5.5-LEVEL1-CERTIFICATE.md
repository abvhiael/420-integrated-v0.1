# BNB-5.5 — Level 1 exact-SHA qualification certificate

**Disposition: COMPLETE — REPOSITORY LEVEL 1 PASS (2026-10-14).**

- Canonical step: BNB-5.5 — Correct incremental discovery feeds.
- Qualification: ordinary app-scoped Level 1; M5-A Level 2 BNB-5.7 and M5-B BNB-5.13 deferred to their canonical milestones; Phase 5 Level 3 BNB-5.14 deferred.
- Qualified implementation SHA: `a5f7ddb05f71dd9399f39f9e5e8ac0bb3e50bb29`.
- Starting Phase 5 / PR base SHA: `3f2cf64897e96c4f16213bcaf93564db72a174c9`.
- Current main observed during certification: `eeaa4e593e8f5f16e2bc566b20ddbe04576589c1`. Ordinary app-scoped step is not a full main reconciliation.
- Audit branch: `audit/bnb-phase5-bnb-5-1-baseline-20261014`; PR #644 draft/open/unmerged.
- Evidence: GitHub Actions [420BnB Runtime Slice run 38643989080](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38643989080), job `116126204855`, completed **success**. Logs independently show exact checkout and HEAD assertion for the qualified implementation, 8 operations tests passing and **409 app tests passing** in verified-TLS PostgreSQL, including BNB-5.5 tests. The targeted job also reports PASS for transactional migration/ledger, security/API, backup/restore, syntax/compile, immutable non-root Docker image, packaged migration, worker failure-closed check, container readiness, host/browser accessibility, deployment/TLS configuration and artifact upload. Evidence artifact `bnb32-infrastructure-a5f7ddb05f71dd9399f39f9e5e8ac0bb3e50bb29` (ID 11931229219) is tied to that SHA.
- Historical skipped 420Docs run on this SHA is **not** counted as success and is **not required** for this ordinary app-scoped Level 1 step; it remains within Level 3 ownership. No full Solidity, Genesis, Integrated or global Docs inventory was substituted for app-specific qualification.

## Exit criteria, individually reviewed

1. **Stable global cross-property cursor and per-property revision:** PASS. Transactional commit-ordered journal/clock and monotone individual revisions; simultaneous timestamp/interleaved property tests.
2. **Resumable bounded pagination:** PASS. Frozen high-watermark/epoch, 1–50 page bounds, 10,000-position catch-up cap, future/invalid cursor rejection and concurrent-update tests.
3. **Tombstones:** PASS. Deletion, re-creation and current-authority retraction/redaction tests; journal identity and revision retained.
4. **Authorized scoped resynchronization:** PASS. Persisted request-key/actor/consumer-bound session, expiry/epoch and per-page reauthorization, deterministic property order, replay and post-snapshot incremental continuation tests; signed internal HTTP forgery/scope/revocation checks.
5. **Replay, equal timestamps and concurrency:** PASS. Tests for equal timestamps, interleaved commits, competing writers, transaction rollback, commit order and restart.
6. **Least privilege, privacy and invariant boundaries:** PASS. Runtime cannot forge/reset journal or alter resync sessions, database privilege verification, allowlisted public/coarse payloads and no private address export. No live publication, booking, payments or external notifications enabled.
7. **Append-only schema/infrastructure qualification:** PASS. Migration 029 and historical upgrade fixture, verified-TLS database, restore and deploy packaging tests. No rewrites of migrations 001–028.

## Changed implementation surface

`services/420bnb/discovery_feed.py`, `discovery_sync.py`, `api.py`, `production.py`, `migrations/029_incremental_discovery.sql`, `tests/test_bnb55_discovery_feed.py`, supporting runtime/upgrade/infrastructure tests and `.github/workflows/bnb-runtime.yml`; design/roadmap at `docs/bnb/BNB-5.5-INCREMENTAL-DISCOVERY.md` and `BNB-PHASE5-ROADMAP.md`. Exact touched set is authoritative in the qualified commit.

## Deliberate deferrals, limitations, security gates

M5-A Level 2 BNB-5.7, M5-B BNB-5.13, and comprehensive reconciled exact-merge-candidate Level 3 BNB-5.14 are not executed or claimed. Live issuer/consumer transport and real Search/Travel publication belong to BNB-5.6 and separate external/testnet acceptance. Journal retention/pruning and operational recovery require future documented policy and live acceptance. A restore must preserve journal continuity or independently coordinate epoch rotation and consumer reset. The existing 17 external/testnet gates remain unchanged, including `travel.bnb_booking=false`, `booking_enabled=false`, `financial_execution=false`.

This certificate is evidence-only. Any later executable/test/workflow/configuration/requirements changes require fresh applicable qualification. The certificate commit is not itself the qualified implementation SHA. **Next canonical step: BNB-5.6 — Search/Travel consumer transport contracts.**
