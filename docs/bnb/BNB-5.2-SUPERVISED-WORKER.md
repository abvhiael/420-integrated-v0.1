# BNB-5.2 — Supervised background-worker runtime

Status: COMPLETE / REPOSITORY LEVEL 1 PASS. [Durable certificate](BNB-5.2-LEVEL1-CERTIFICATE.md).

## Canonical scope and baseline

Canonical Phase 5 requirement: deployable bounded outbox worker entry point, graceful shutdown, connection recovery, lease renewal/fencing, competing-worker and restart/crash qualification. Level 1 ordinary step; Level 2 remains BNB-5.7/5.13 and Level 3 BNB-5.14.

Main/base `3f2cf64897e96c4f16213bcaf93564db72a174c9` remained unchanged at implementation inspection. Audit PR #644 is draft/open/unmerged on `audit/bnb-phase5-bnb-5-1-baseline-20261014`; predecessor evidence HEAD `55aed5e5b0a3f76f4ca66e13974c9433852c6fb9`, qualified BNB-5.1 implementation `7652862c9047f74df69fc1a8cb5d93a1339e1617`.

Existing outbox has transactional claims, retry/dead-letter and receipt fencing but lacked a running supervisor, heartbeat and bounded shutdown. Repeated crashes could bypass the explicit failure attempt limit. Existing Compose had only API/web/ingress/migration services. Those are the BNB-5.2 gaps; independent per-consumer completion and real Search/Travel transports remain BNB-5.3/5.6.

## Implementation and operational procedure

`worker.py` supplies a supervisor with one in-flight event, bounded polling, fresh connections, capped reconnect backoff, unique claim incarnation, live lease heartbeat, redacted state codes and SIGTERM/SIGINT handling. Current delivery may finish during shutdown; no new event is claimed after the stop signal. Grace/total delivery deadlines abandon uncertain work without acknowledging it or releasing a lease still associated with a running accept. The process exits nonzero for supervisor restart; a new process reclaims after expiry. The local adapter's idempotent durable receipt closes the crash-after-accept/before-ack ambiguity.

`outbox.py` adds live-only renewal and wall-clock fencing of acknowledgment/failure, plus dead-lettering expired crash-only attempts at the existing eight-attempt bound. Expired/stale/wrong owners cannot revive, acknowledge or fail a claim. Existing manual replay authorization remains required.

`LocalValidationSink` atomically records an immutable event-envelope digest and deterministic receipt in the existing dedupe table, rejects conflicting content and stores no envelope/private payload. It is explicitly **local validation**, not an independent projection, user notification or external consumer acknowledgment. Existing outbox event-level completion remains until BNB-5.3. It does not establish Search/Travel/Pay/Wallet publication or delivery.

The nonroot API image packages the worker. Production Compose adds an opt-in `worker` profile with the same digest-pinned image, read-only filesystem, dropped capabilities, no-new-privileges, runtime-only secret mount, backend network, no published port and `unless-stopped` restart. It has a 15-second stop grace. No misleading API healthcheck is inherited by the worker; dedicated freshness/readiness monitoring belongs to BNB-5.11.

Operator rehearsal, only with separately approved deployment bindings: `docker compose -f services/420bnb/compose.production.yml --profile worker up -d worker`. Stop with `docker compose -f services/420bnb/compose.production.yml --profile worker stop worker`. The profile only selects `BNB_WORKER_SINK=local-validation`. Do not run this profile against a real event stream as a substitute for independent downstream acceptance: local completion is not downstream delivery. No live deployment is performed or authorized by this qualification.

Direct `python worker.py` startup validates the production deployment contract, exact image/release, mounted-only credentials, disabled execution flags and verified-TLS least-privilege runtime role. Arbitrary module/plugin/provider URLs are not accepted. Missing/unapproved sink or bindings fail closed without printing inputs. Connections have 5-second connect/statement and 2-second lock bounds; no migrator credentials or migrations in the worker.

## Files and requirement verification

- `services/420bnb/worker.py`: entry point, local durable sink and supervisor.
- `services/420bnb/outbox.py`: renewal, clock fencing, crash-attempt bound.
- `services/420bnb/Dockerfile`: package worker.
- `services/420bnb/compose.production.yml`: explicit hardened worker profile.
- `services/420bnb/tests/test_bnb52_worker.py`: isolated PostgreSQL and real child-process tests.
- `.github/workflows/bnb-runtime.yml`: preserve exact-head owner; validate worker topology and packaged fail-closed command.
- This report and Phase 5 roadmap: scope, operating limits and evidence.

Tests cover competing supervisors, one durable local receipt, conflicting envelopes, live/wrong/expired/reclaimed owners, in-flight heartbeats, drain-without-new-claims, bounded blocked adapter, transient database reconnect/backoff and log redaction, poison payload isolation, eight crash attempts, actual process death after durable commit and idempotent restart, actual SIGTERM, input bounds and startup redaction. Dedicated schemas isolate worker tests from prior outbox tests. The new database fixture fails if its required database is missing rather than skipping.

The retained BnB Runtime Slice also rechecks existing API/security, authorization, accounting, PostgreSQL schema/TLS/roles, migrations, browser/accessibility automation, backup/restore, packaged images and fail-closed deployment. No migration, API, contract, frozen address, external gate criteria or financial authority changes.

## Qualification and boundaries

Qualified implementation `fd2612e695337faed1d6bfba0ff2ab04dcc43c08`; Runtime Slice run `38606011412`, job `115996970065`: SUCCESS. 327 app tests (19 new worker cases), plus eight repeated dedicated operations executions; all browser/container/TLS/deployment steps successful. [Certificate](BNB-5.2-LEVEL1-CERTIFICATE.md) verifies each canonical exit criterion. Syntax checked locally; PostgreSQL/container acceptance executed successfully through the exact-head GitHub runtime owner. No broad Solidity, Genesis, Integrated or global Docs qualification is required or manually dispatched for this app-only ordinary step. Supplemental skipped/wrong-SHA/queued workflows are never counted as passing required evidence.

Preserve all 17 existing external gates, particularly T-BNB-OPS-214 and T-BNB-SECURITY-213; live supervisor acceptance, independent operator authority, production restart/failover and actual consumer deployments remain external. Keep `travel.bnb_booking=false`, `booking_enabled=false`, `financial_execution=false`. All Identity, Pay, Wallet, Compliance, Travel, legal, human accessibility and production acceptances remain independent.

Next canonical step after this step qualifies: **BNB-5.3 — Independent consumer delivery state**.
