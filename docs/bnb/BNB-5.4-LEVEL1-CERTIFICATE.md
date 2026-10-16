# BNB-5.4 — Level 1 qualification certificate

**COMPLETE — REPOSITORY LEVEL 1 PASS, 2026-10-14. No live/testnet release acceptance.**

## Identity and reconciliation

- Step: **BNB-5.4 — Transactional projection invalidation and refresh**.
- Qualified implementation: `45774b43c77e53d4ce5fe4b000a4fea5de444f3f`.
- Current main/base reverified: `3f2cf64897e96c4f16213bcaf93564db72a174c9`; implementation is ahead by 19 commits, behind by zero, no reconciliation conflict.
- Starting qualified BNB-5.3 evidence HEAD: `d060572c1546b48705b7460a86100e44b535ee91`.
- PR #644: draft/open/unmerged; audit branch `audit/bnb-phase5-bnb-5-1-baseline-20261014`.
- Evidence SHA: commit introducing this certificate, report evidence/status and roadmap status. Its SHA is discoverable through Git history for this file. Only documentation changes; executable source, tests, workflows, configuration, dependencies, artifacts, interfaces, deployment state and substantive requirements remain unchanged. Inherits exact implementation qualification without recursive CI.

## Gap analysis, implementation and changed files

Existing availability refreshed on demand; discovery synchronized explicitly. Source writes did not consistently invalidate/schedule derived views, and time-only expiration had no durable refresh owner. Migration 028 introduces transactional source triggers, coalesced property requests and completed-revision/due-time tracking. projection_refresh.py and production worker integrate bounded property-first refresh transactions with independent consumer delivery. Current discovery authority is revalidated before consumer admission even while refresh is pending. Admission remains authoritative and projections remain nonbinding.

Changed executable/config/test files relative to BNB-5.3:
- services/420bnb/migrations/028_projection_refresh.sql; projection_refresh.py; worker.py; discovery_sync.py; Dockerfile; api.py; production.py; recovery_operations.py.
- services/420bnb/tests/test_bnb54_projection_refresh.py; test_bnb214_operations.py; test_bnb32_infrastructure.py; test_bnb410_recovery.py; test_bnb41_phase4_baseline.py; test_bnb53_consumers.py.
- .github/workflows/bnb-runtime.yml.
- Implementation report and Phase 5 roadmap.
Migrations 001–027, historical baseline inventory/certificates, contracts, frozen addresses, financial execution and all external gate criteria remain unchanged. Current schema guards advance strictly to 28; historical upgrade acceptance remains asserted.

## Every original exit criterion

| Canonical criterion | Individually verified result |
| --- | --- |
| Durable work from inventory changes | PASS: atomic property/unit/block/calendar mutation triggers invalidate cached windows and enqueue durable property work; real database mutations and trigger catalogue checked |
| Hold/reservation/cancellation changes | PASS: real hold creation and cancelled/expired/confirmed states, reservation creation and source write rollback; derived capacity re-reads authoritative occupancy |
| Expiry and authority changes | PASS: time-only hold expiry after clock advance; location/compliance/jurisdiction revocation/retraction and authority-expiry rejection; periodic due work rechecks current authoritative state |
| Transactional consistency | PASS: source write, invalidation and work revision roll back together; refresh, discovery event and work completion also roll back together; autocommit rejected |
| Authoritative admission | PASS: quote/hold admission unchanged; refresh calls existing authoritative occupancy; nonbinding cached data cannot confirm booking/finality; discovery acceptance locks property and revalidates current authority before checkpoint |
| Lost wakeups and concurrency | PASS: property-before-queue locking, SKIP LOCKED competing workers, a writer waiting behind refresh retains newer work; mutation after completion remains pending |
| Replay/idempotence | PASS: repeated refresh emits no duplicate discovery revision, completed work is not rerun before due, old consumer revisions/authority cannot be accepted; retained discovery replay regression passes unchanged |
| Restart/crash recovery | PASS: rolled-back refresh and actual child-process death before commit preserve pending work and leak no discovery event; next process completes it |
| Bounded runtime and failure recovery | PASS: one property and 1–100 windows per transaction; multi-batch continuation completes without restarting its batch; transient stale-calendar windows remain invalidated with bounded retry and recover automatically after source update |
| Production runtime integration | PASS: actual worker entrypoint executes refresh and independent local receipt over verified-TLS least-privilege runtime role; nonroot packaging and missing-bindings failure retained |

Suspended/missing-unit unavailable cached windows are removed; temporarily stale calendars retain invalidated windows for autonomous retry. These are read-model operations, never source booking-state edits. External consumer acceptance remains independent.

## Exact-source executed Level 1 evidence

[420BnB Runtime Slice run 38628930761](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38628930761), [runtime job 116075214415](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38628930761/job/116075214415): **completed / SUCCESS**, every required step successful. Decoded logs and job steps inspected.

- Checkout and explicit HEAD assertion bind `45774b43c77e53d4ce5fe4b000a4fea5de444f3f`; OCI revision/build artifact bind the same implementation, not synthetic PR merge `d1c3cb71269fe249045431f234afdf224af294f7`.
- Complete BnB test directory: **386 passed**, zero failed/skipped in summary; **26 new BNB-5.4 cases** above BNB-5.3's 360.
- Dedicated migration/parallel operations invocation: **8 passed**, repeated within the directory, not eight additional distinct tests.
- Schema 28 migration/ledger/parallelism, verified PostgreSQL TLS/runtime role, logical backup/restore including durable refresh work, Python compilation, nonroot API/web builds, packaged migration, fail-closed worker/direct API/production startup, staging readiness, browser/axe accessibility automation, front-end checks, restricted static surface, hardened Compose topology and ingress TLS syntax: **PASS**.
- Artifact **11925207001**, `bnb32-infrastructure-45774b43c77e53d4ce5fe4b000a4fea5de444f3f`; local API config `sha256:edf3baf0d0c24593f32aada63b3fd057b035fc9444cffae75adfd7b14ee2cc9e`; web `sha256:7c9ba49efa716fc64858497e8962dec74244c1d19e315d01f2877bcc90328fb4`. Registry publication and live acceptance remain false.
- Local final Python syntax compilation succeeded. This workspace lacks PostgreSQL/psycopg; database/browser/container execution is evidenced by the exact-source CI owner, not claimed local execution.
- Existing Starlette/httpx deprecation warning is nonfatal; no required checks/assertions disabled.
- Run 38628187800 failed a retained SOURCE_REVISION_STALE error-contract assertion (383 passed, one failed). Implementation now checks stale revision before stale authority, retaining both fences and the unchanged assertion. Subsequent executable/test fixes were qualified at the final SHA above. All failed/superseded/cancelled/skipped/queued/wrong-SHA runs are excluded from passing evidence.
- Global Docs was automatically skipped and is not claimed PASS. Oracle/unrelated/global workflows do not substitute for this exact app qualification.

## Disposition, limits and next step

All original BNB-5.4 exit criteria are satisfied; no remaining repository-side step blocker. Level 2 remains at BNB-5.7 / BNB-5.13. Comprehensive canonical Solidity, independent Genesis/address authority, Integrated and global Docs checks remain deferred to BNB-5.14; they are not required for this app-only ordinary step and no redundant broad qualification was manually dispatched.

All 17 external gates remain unchanged, especially T-BNB-CALENDAR-1, T-BNB-BOOKING-1, T-BNB-COMPLIANCE-212 and T-BNB-TRAVEL-210A. Identity, Pay/Wallet, signed calendar providers, Compliance/legal, Search/Travel publication, independent human accessibility and production operations remain externally gated. Keep `travel.bnb_booking=false`, `booking_enabled=false`, `financial_execution=false`. No live deployment, publication or funds movement.

Next canonical step: **BNB-5.5 — Correct incremental discovery feeds**.
