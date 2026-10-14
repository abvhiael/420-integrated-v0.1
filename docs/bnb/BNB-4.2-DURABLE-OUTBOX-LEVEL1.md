# BNB-4.2 — Durable Notifications and Outbox Delivery / Level 1 audit record

**Canonical roadmap:** [BNB-PHASE4-ROADMAP.md](BNB-PHASE4-ROADMAP.md), BNB-4.2. **Current state: REPOSITORY IMPLEMENTATION COMPLETE / LEVEL 1 PASS / EXTERNAL DELIVERY DEFERRED.** This record is application-source audit evidence, not live provider/operator acceptance or a Phase 4 merge authorization.

## Authority and baseline

- Owner-approved Phase 4 app roadmap; predecessor BNB-4.1 qualified Level 1 with exact executable `a562181a1a0a3d6bb05df401c8182f7a1f768152`, evidence `69e347cf8e8af122a0d2464460d8090365343877`.
- Main baseline: `81c21541acdc1b900b9a15c6f6b75ff2d7c2b5d9`, audit branch `audit/bnb-phase4-bnb-4-1-baseline-20261013`, draft [PR #631](https://github.com/abvhiael/420-integrated-v0.1/pull/631). Do not merge yet.
- Producer events are inserted in `services/420bnb/api.py` into `bnb_outbox` in the same PostgreSQL transaction as held/booking/finality accounting. BNB is never a Pay/Wallet finality issuer; external sending is disabled without separate provider authorization.

## Implementation and retained security properties

1. `services/420bnb/migrations/022_durable_outbox.sql` extends the existing outbox with lease owner/expiry, attempt counter, time-delayed retry, dead-letter marker, sanitized failure code and delivered consumer. It introduces `bnb_outbox_receipt(event_id,consumer)` uniqueness and an available-event partial index. The old schema's transactionally admitted event IDs/payloads remain intact.
2. `services/420bnb/outbox.py` is a restricted internal worker/adaptor boundary, not a new public endpoint. Claims are deterministically ordered with PostgreSQL `FOR UPDATE SKIP LOCKED`, bounded batches, per-worker leases and ownership/expiry fencing. Claims are committed before calling the consumer adapter. Failed deliveries retry with capped exponential backoff and, after eight attempts, enter dead-letter storage.
3. The worker uses immutable `event_id` and a durable receipt digest for consumer idempotency. Consumer adapters must independently deduplicate using the same event ID because external acceptance may precede internal acknowledgment or the worker may crash; this is **at-least-once transport**, not a false exactly-once network-delivery claim. Competing workers and stale acknowledgers cannot acknowledge other workers' leases.
4. `process_batch(connect,worker,adapter)` is deliberately adapter-injected with no default external transport. `_event` enforces a restricted known producer event-type allowlist and bounded flat, redacted schema, rejecting credential-like payload keys and oversized/nested content. Unknown or poison events are isolated and retried/dead-lettered; a poison event cannot block the remainder of the batch. No arbitrary email/SMS/push sending or unapproved transport credentials are configured.
5. Manual dead-letter replay is isolated from public APIs; it requires an explicit independent operator-authorization callback (fail-closed by default), a bounded reason and audit event. Authorization is not inferred from an arbitrary actor string. Deletion/redaction, provider-managed key security and actual ops reviewer signoff remain under existing independent gates.
6. The service runtime, production readiness and deployment/database role checks, app CI migration expectations, and retained legacy migration tests now require the 22-migration canonical schema. Historical migration checksums are not modified.
7. Future BNB-4.3/4.4 projection consumers must derive current authority from canonical source states and reject stale/out-of-order revisions before acting; BNB-4.2 does not grant Search, Calendar, Travel or notification-provider issuer rights.

## Application tests and CI classification

- Added `services/420bnb/tests/test_bnb42_outbox.py` to the retained app runtime suite. Exercises locked competing claims, stale-worker fencing and lease expiry, repeated failures/exponential backoff/dead-letter/replay, unauthenticated replay rejection, toxic/private payload isolation, unapproved consumer names, crash-after-durable-consumer-accept and recovery without duplicate acceptance.
- Updated exact-schema regression assertions in `services/420bnb/tests/test_bnb214_operations.py`, `test_bnb32_infrastructure.py`, `test_bnb41_phase4_baseline.py`, `services/420bnb/api.py`, `production.py` and `.github/workflows/bnb-runtime.yml`. These are necessary schema-version changes, not weakened checks.
- Diagnosed two previous app CI failures instead of rerunning unchanged deterministic defects: source count test in workflow still expected 21 after migration 022, and API/production readiness expected schema 21; a later build also identified a parallel-migration expected list and a test transaction that rolled back its own fixture. All were corrected on later source SHAs. Prior failing builds are superseded, **not** counted PASS.
- **Exact Level 1 implementation candidate:** `7199b6ea32c3d64e04472a0dc1a255c1333a338b`. Required 420BnB Runtime Slice [run 38441362926](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38441362926) and retained applicable BNB workflows are **TERMINAL SUCCESS** on exact tested evidence HEAD `d2ba9f204614d91505268e3460c2daf63c466c96`. The required Runtime Slice run `38441558434`, job `115449614790`, completed SUCCESS: **8 migration/ops tests PASS + 236 retained runtime/API/adversarial tests PASS = 244 tests PASS, zero failures**; browser smoke, restricted image/build, schema 022/production and backup/restore checks PASS. BNB-1.1 through BNB-1.9 all **9/9 SUCCESS**, run IDs: `38441558355`, `38441558523`, `38441558589`, `38441558334`, `38441558618`, `38441558271`, `38441558436`, `38441558313`, `38441558052`. Skipped Docs `38441558159` was not required/credited; Oracle `38441558378` was still in progress at this inspection and was not credited as PASS. Historical cancelled/replaced run `38441362926` was **not** counted as passing.
- No complete Foundry/Genesis/Integrated/Geth/global Docs are required for this app-only ordinary step. M4-A at BNB-4.7, M4-B at BNB-4.11 and global Level 3 at BNB-4.12 remain mandated later.

## Final exit checklist

- [x] Trace canonical BNB-4.2 scope to actual PostgreSQL producer/outbox, API, production operations and CI.
- [x] Implement lease and crash/restart-safe recovery, bounded retries and dead letters; retain transactionally admitted outbox events.
- [x] Implement consumer event ID deduplication, adapter non-activation, poison/forged privacy rejection, manual replay authorization and audit.
- [x] Add source-bound adversarial tests and preserve historical migration integrity.
- [x] Qualify final changed source against terminal exact-SHA BNB Runtime Slice **244 passing tests**, nine retained BNB workflows success and exact job IDs recorded above.
- [x] Refresh main divergence: **latest main `959288c8bd33b6da0325b6a5d060e00e7bcf0e48`**, audit branch at evidence inspection **21 ahead / 408 behind**. The `main` advance since branch creation spans 264 reported changed files, **none under `services/420bnb/**`, `web/bnb/**`, or `.github/workflows/bnb-runtime.yml`** in the compare response. Integration against the newly advanced main is a future phase/merge operation, **not yet certified or performed**. This evidence-only closeout inherits the exact tested source SHA and does not rewrite or silently overwrite current main.

**External dependencies intentionally deferred:** T-BNB-IDENTITY-1/2, PROPERTY-1, INTEGRATION-1, MEDIA-1, ACCESSIBILITY-1, CALENDAR-1, QUOTE-1, BOOKING-1, PAY-2, SETTLEMENT-3, TRAVEL-210/210A, REPUTATION-211, COMPLIANCE-212, SECURITY-213, OPS-214. Real external signing/provider approval, operational worker deployment/managed DB and SMS/email/push traffic remain independently blocked. `travel.bnb_booking=false`, no live booking/financial execution.

**No Level 2 or Level 3 was run or falsely represented as passing.** Production providers/actual independent operations are blocked, but repository-side BNB-4.2 Level 1 is qualified. Preserve the draft PR and reconcile latest main before any eventual merger.

**Next canonical roadmap step:** **BNB-4.3 — Real-time availability and calendar projections**.
