# BNB-5.3 — Independent consumer delivery state

Status: COMPLETE / REPOSITORY LEVEL 1 PASS. [Durable certificate](BNB-5.3-LEVEL1-CERTIFICATE.md).

## Canonical requirement and repository baseline

Explicit subscriptions and durable per-consumer delivery/receipt state; one acknowledgment cannot complete another consumer. Duplicate/conflicting receipt, partial delivery, revoked-consumer, retry and dead-letter qualification. This is ordinary Level 1; milestones remain BNB-5.7/5.13 and phase closeout BNB-5.14.

PR #644 remains draft/open/unmerged on `audit/bnb-phase5-bnb-5-1-baseline-20261014`. Starting evidence HEAD `2e412c093f0c8f7e3a42f0d8389b3420be4093c6`; prior qualified implementation `fd2612e695337faed1d6bfba0ff2ab04dcc43c08`. Main/base `3f2cf64897e96c4f16213bcaf93564db72a174c9` was reverified unchanged. BNB-5.1 and 5.2 certificates remain historical exact-source evidence, not new BNB-5.3 results.

Gap analysis: the previous outbox had event-level attempts, lease and delivered_at. One local receipt completed the whole event; no subscription registry, consumer-specific retry state or current revocation binding existed. BNB-5.2's supervisor was valid for the then-existing local single-sink primitive, with independent consumers explicitly outstanding. BNB-5.3 replaces the production worker path without duplicating unrelated global qualification.

## Durable model and invariants

Append-only migration `027_independent_consumers.sql` adds `consumer_managed`, a bounded subscription registry, versioned configuration history and per-event/per-consumer delivery state. Migrations 001–026 remain byte-for-byte unchanged. Existing completed events retain historical completion and gain no fabricated consumer receipt. Undelivered legacy events can be enrolled only after any legacy live lease expires.

Trusted `configure` requires an independently established authority callback and exact expected revision; no HTTP endpoint or caller-supplied approval boolean is introduced. Current identical configuration is idempotent; stale revisions conflict. Only allowlisted event kinds, bounded consumer identities and a maximum of 64 registered consumers are accepted. Revocation/configuration changes advance the revision and are durably recorded with actor. These records are local configuration history, not independent legal/consumer approval.

Enrollment locks each event and snapshots all current subscribed consumers atomically into delivery rows before marking it managed. It is bounded to 100 events and 64 consumers per event. No empty fanout, implicit late-subscriber backfill or acceptance is created. A later consumer applies to subsequent unenrolled work; authorized catch-up/transport contracts remain BNB-5.6. Global registry lock and row locks serialize enrollment against competing enrollment/configuration.

Every delivery independently owns its subscription revision, envelope digest, attempt count, availability, lease owner/expiry, receipt and dead-letter state. A consumer's receipt cannot acknowledge another consumer; no event completion occurs until every snapshotted delivery has its own durable receipt. Partial delivery, dead letters and revoked pending consumers leave event completion unset. Already accepted historical receipts remain historical if a consumer is subsequently revoked.

Current active revision and event-kind scope are rechecked under locks for acknowledgment, renewal, failure and replay. Expired/reclaimed/wrong owners cannot mutate delivery; production generates a unique owner for each claim. Renewal and completion use database wall time after lock waits. An identical completed receipt is idempotent only for its completing owner/current valid scope; a different receipt conflicts. Envelope changes cannot receive a false receipt. Poison payloads are isolated before adapter invocation and retry only their consumer delivery.

Each consumer has the existing eight-attempt retry/dead-letter budget, including crashes without explicit fail. Its failure does not change another consumer's attempts or accepted receipt. Replay requires independent operational authorization, bounded reason, current active event scope and no live lease; it affects only that consumer. Accepted deliveries cannot be replayed. Re-enabling a revoked subscription does not revive old work automatically: old generation work needs explicit authorized replay.

The legacy whole-event primitives remain for unsubscribed historical callers, but reject managed events and work with active subscriptions. Revoking all consumers cannot make managed work eligible for legacy bypass. Production worker always uses the consumer-specific path; its opt-in local rehearsal sink creates only its own explicit subscription. Startup preserves narrowed existing configuration and refuses a revoked local subscription rather than reactivating it. Independent external consumers are not automatically registered or approved.

## Runtime, schema and qualification owners

`worker.py` routes claim/renew/ack/fail through `consumer_delivery.py` in production while retaining bounded supervision, unique claims, shutdown, connection recovery and local sink deduplication. API/readiness, least-privilege production schema guard, recovery assessment, current-schema test assertions and workflow migrate/restore checks advance strictly to 27. They do not relax the complete migration sequence/checksum requirement. Recovery counts include consumer-specific retry/dead-letter work and retain conservative restore/replay gates.

Files: new consumer module, migration and consumer test suite; worker/outbox integration; Dockerfile packaging; API readiness, production and recovery schema guards; existing operations/infrastructure/recovery/current-baseline tests and isolated worker fixture; BnB runtime workflow; this report and Phase 5 roadmap. No frozen address, contract, financial authorization, external issuer, booking flag or external-gate criterion changes.

Required Level 1 owner: existing `420BnB Runtime Slice`, exact PR head checkout and explicit HEAD assertion. It runs all BnB tests including new real PostgreSQL tests, prior worker crash/SIGTERM tests, app/API/security regression, TLS/runtime-role, migration ledger/parallelism, browser/accessibility automation, nonroot images, packaged commands, backup/restore and topology/ingress checks. New tests fail if the required database is absent; skipped checks are not passing evidence. Current migration expectations advance to 27 while pinned historical baseline remains 26.

New tests cover independent partial/all completion, duplicate/conflicting/cross-consumer receipts, revoked consumer claim/renew/ack/fail, re-enable/replay scope, independent retries/dead letters/crashes, atomic rollback and competing enrollment, competing workers and concurrent acknowledgments, registry authority/CAS/history, absent/late subscriptions, legacy bypass prevention, changed/poison payloads, supervised and actual-process crash-after-accept restart, schema-26 upgrade without historical requalification, verified-TLS role DML and revoked production restart.

## Boundaries and next step

The local validation adapter is not Search/Travel publication or an external consumer's acceptance. At-least-once transport requires each approved adapter to atomically deduplicate event identity and bind its receipt. This step adds no arbitrary URL/plugin transport or untrusted acknowledgment endpoint. Consumer transport authentication and publication approval remain BNB-5.6 and existing external gates; operational credential/API controls remain BNB-5.9. Revocation blocks local processing/receipt commits but cannot recall an already transmitted external side effect; approved transports must enforce their own revocation/receipt contract.

Preserve all 17 external gates, especially T-BNB-INTEGRATION-1, T-BNB-TRAVEL-210A and T-BNB-OPS-214. Identity, Pay, Wallet, Compliance/legal, Travel/Search, human accessibility and production operations remain independently gated. Keep `travel.bnb_booking=false`, `booking_enabled=false`, `financial_execution=false`. No live deployment, external delivery, funds movement or authority approval is claimed.

Qualified implementation `1ef28f61238e61adc490fc1f60759aeece34a99c`; Runtime Slice run `38619541943`, job `116043162751`: SUCCESS, 360 directory tests passed plus eight repeated operations executions. All required packaging/browser/TLS/restore/deployment steps succeeded. [Certificate](BNB-5.3-LEVEL1-CERTIFICATE.md) records individual exit criteria and inspected exact-source evidence. Level 2 intentionally remains at BNB-5.7/5.13, Level 3 at BNB-5.14. No full Solidity, Genesis, Integrated or global Docs run is required or manually dispatched for this app-only step.

Next canonical step after BNB-5.3 qualifies: **BNB-5.4 — Transactional projection invalidation and refresh**.
