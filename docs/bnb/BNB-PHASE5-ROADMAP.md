# 420BnB — Phase 5 roadmap

Status: BNB-5.3 COMPLETE / REPOSITORY LEVEL 1 PASS on 2026-10-14. Phase 4 integration prerequisite satisfied by explicitly authorized merge of PR #631. Phase 5 repository-side development only; no live booking/payment or external acceptance approval.

## Starting prerequisite

Phase 4 was merged through explicitly authorized PR #631 as `3f2cf64897e96c4f16213bcaf93564db72a174c9`, now the Phase 5 starting main. Its tree exactly equals Phase 4 certificate HEAD `3a7cdf175840e11c337e36d1321490929b5634f3`, qualified executable `7ccc76fe613ba4fdc162d459827f5ec95fae3385`. PR #631 is CLOSED/MERGED. Do not transfer its historical draft restriction to the new Phase 5 PR, which remains draft/unmerged until its phase closeout. [Phase 4 certificate](BNB-4.12-PHASE4-LEVEL3-CLOSEOUT.md).

## Sequence and exit requirements

| Step | Name | Requirements |
| --- | --- | --- |
| BNB-5.1 | Integrated baseline and runtime ownership | Verify Phase 4 integration and certificate provenance. Inventory APIs, migrations, workers, consumers, feature flags and CI. Map each remaining repository task to its existing external acceptance gate. |
| BNB-5.2 | Supervised background-worker runtime | Deployable bounded outbox worker entry point, graceful shutdown, connection recovery, lease renewal/fencing, competing-worker and restart/crash qualification. |
| BNB-5.3 | Independent consumer delivery state | Explicit subscriptions and durable per-consumer delivery/receipt state; one acknowledgment cannot complete another consumer. Duplicate/conflicting receipt, partial delivery, revoked-consumer, retry and dead-letter qualification. |
| BNB-5.4 | Transactional projection invalidation and refresh | Durable refresh work from inventory/hold/reservation/cancellation/expiry/authority changes, with transactional consistency, authoritative admission, lost-wakeup and concurrent/replayed/restart tests. |
| BNB-5.5 | Correct incremental discovery feeds | Stable cross-property change cursor plus per-property revisions, resumable pagination, tombstones, bounded catch-up and authorized resynchronization; equal timestamps, concurrent/interleaved updates and replay tests. |
| BNB-5.6 | Search/Travel consumer transport contracts | Authenticated versioned transport and acknowledgments against repository-controlled consumers; authority revalidation, privacy, expiry/retraction; no unapproved real publication. |
| BNB-5.7 | M5-A Level 2 integration milestone | One accumulated SHA for 5.2–5.6: source mutation through projection/event/consumer/acknowledgment/retraction, including failure, race, outage and recovery matrices. |
| BNB-5.8 | Notification delivery and device lifecycle | Durable recipient/device delivery state, preferences, revocation/reconnect recovery, cross-account/privacy/replay tests; no general-event message bodies or external provider activation. |
| BNB-5.9 | Authenticated operational controls | Least-privilege health/dead-letter/replay/reconciliation APIs and console actions; independent operator authority, current permissions, bounded requests and auditable decisions; forged authority, escalation and concurrency tests. |
| BNB-5.10 | Continuous Pay/Wallet reconciliation | Supervised consumption of canonical provider observations with provenance, monotone state, original-payer binding, finality revocation and conservation; no BnB signing/spending/custody/settlement authority. |
| BNB-5.11 | Service health and synchronization monitoring | Bounded redacted backlog/lease/retry/dead-letter/freshness/acknowledgment/revocation metrics, readiness and alerts; stale/missing consumers and misleading-health tests. |
| BNB-5.12 | Multi-instance recovery and deployment rehearsal | Isolated CI multi-API/worker shared-PostgreSQL failover, exhaustion, migration compatibility, restore reconciliation and interrupted deployment; reproducible operator procedures, external production acceptance preserved. |
| BNB-5.13 | M5-B end-to-end Level 2 milestone | One accumulated SHA covering guest/host/operator, notifications, provider status, privacy, accessibility automation and recovery; each unwitnessed external scenario separately recorded. |
| BNB-5.14 | Final Level 3 phase closeout | Reconcile current main, qualify one final implementation through canonical Solidity once (~4 shards), independent Genesis, Integrated, full Docs and affected interface/app/security/deployment suites; certificate and explicit merge authorization. |

## Qualification and authority

Level 1: directly affected app checks for ordinary steps, exact implementation SHA, no skipped/cancelled/missing results as success. Level 2 only at BNB-5.7 and BNB-5.13 or a materially changed dependency. Level 3 once at BNB-5.14: canonical Solidity full source/test/script inventory once in approximately four runner-aware shards with safe cache reuse, invariants, size checks and coverage; separate Genesis addresses/namespaces/collisions/predeploy/frozen-manifest authority without duplicate Foundry; Integrated, full Docs and affected clients/services/app suites. Evidence-only commits can inherit qualification only when substantive requirements, source/tests/workflows/dependencies/configuration/runtime artifacts remain unchanged.

All existing testnet gates remain authoritative in [BNB-TESTNET-WORK-ROADMAP.md](BNB-TESTNET-WORK-ROADMAP.md), with unchanged criteria/status. BnB consumes Identity, lawful property, Pay/Wallet, Compliance, Travel/Location/Search and independent issuer authority; it cannot create it. Keep `travel.bnb_booking=false`, `booking_enabled=false`, `financial_execution=false`. No live deployment, real notifications, property publication, fund movement or independent accessibility/legal/production approval is authorized by this plan.

Current step: **BNB-5.3 — Independent consumer delivery state**, COMPLETE / Level 1 PASS at `1ef28f61238e61adc490fc1f60759aeece34a99c`. [Certificate](BNB-5.3-LEVEL1-CERTIFICATE.md). [Implementation and evidence](BNB-5.3-INDEPENDENT-CONSUMERS.md). BNB-5.1 and 5.2 remain qualified at their recorded implementations. Next: **BNB-5.4 — Transactional projection invalidation and refresh**.
