# BNB-5.12 — Multi-instance recovery and deployment rehearsal — Level 1 certificate

**Disposition: REPOSITORY LEVEL 1 PASS** for the exact executable SHA below. This is an isolated-CI/repository rehearsal, not independently approved production failover or external deployment acceptance.

## Authority, step and reconciliation context

- Canonical requirement in `docs/bnb/BNB-PHASE5-ROADMAP.md`: **BNB-5.12 — Multi-instance recovery and deployment rehearsal**: isolated CI multi-API/worker shared-PostgreSQL failover, exhaustion, migration compatibility, restore reconciliation and interrupted deployment; reproducible operator procedures, external production acceptance preserved.
- Repository `abvhiael/420-integrated-v0.1`; audit branch `audit/bnb-phase5-bnb-5-1-baseline-20261014`, [PR #644](https://github.com/abvhiael/420-integrated-v0.1/pull/644), **draft, open and unmerged**.
- **Qualified executable implementation SHA: `6acc0df07c0f09af9873bc6105cb2b568e3f7ae2`**.
- PR reconciliation/base SHA `3f2cf64897e96c4f16213bcaf93564db72a174c9`. At qualification branch is **103 commits ahead and 576 behind** current `main`. This is app Level 1 only; full reconciliation is reserved for BNB-5.14.
- This certificate is an evidence-only follow-on: its commit must change no executable behavior/tests/workflows/dependencies/configuration or runtime artifacts. Qualification remains bound to the executable SHA, not the evidence commit.

## Implementation, testing and reproduced operations

- New `services/420bnb/tests/test_bnb512_multi_instance.py` runs on the retained verified-TLS PostgreSQL runtime fixture. Rehearses two supervisors competing against the same transactional outbox, exactly one durable receipt per event, bounded attempts, follow-on fresh worker connection and idempotent recovery.
- Deliberately dead-lettered exhausted work blocks the restore assessment until an explicitly authorized, audited replay queues redrive. Confirms a fresh worker consumes the redriven event; destructive schema rollback is never approved.
- Revalidates the installed ordered migrations **1–30** before recovery, and explicitly rejects a simulated stale schema. The existing BNB-3.2 infrastructure suite separately covers concurrent controlled migrations, TLS certificate/hostname rejection, migrator/runtime privilege separation, packaging, schema privilege drift and isolated logical backup/restore.
- Adds two independent HTTP API clients against shared PostgreSQL, tests health visibility before and after creation of durable work, interrupts one client, completes delivery with a separate worker and verifies state from the surviving API client. This is an isolated test-client-level API rehearsal, not a claim of multi-host externally deployed infrastructure.
- Retains the older BNB-5.2 worker tests for actual process-death-after-commit, SIGTERM, bounded adapter timeouts, competing workers, poison events, lease ABA fencing and connection-outage recovery. Retains Search/Travel HTTPS, identity/session, redaction, notification and signed receipt regressions.
- New reproducible operator procedure `docs/bnb/BNB-5.12-RECOVERY-REHEARSAL.md` documents preconditions, multi-instance startup, interruption, migration check, failure/exhaustion, recovery assessment, verified tests, evidence capture and external acceptance boundaries.
- No new migration or production ability to sign, spend, hold funds, settle, enable booking, publish real listings or activate external notification providers.

## Exact-SHA Level 1 CI evidence

- [420BnB Runtime Slice **#38778711659**](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38778711659), job **#116573122776**: terminal **SUCCESS** on `6acc0df07c0f09af9873bc6105cb2b568e3f7ae2`. **478 application tests + 8 operations tests = 486 passing tests**, zero failed job steps. Verified-TLS PostgreSQL, migrations, logical backup/restore, packaged nonroot API/web, deployment topology, browser accessibility, runtime/security/API tests passed.
- Infrastructure artifact `bnb32-infrastructure-6acc0df07c0f09af9873bc6105cb2b568e3f7ae2.zip`, artifact ID **11994334146**.
- Nine BnB guardrail workflows terminal **SUCCESS** on this exact SHA:
  - BNB-1.1 #38778711939; BNB-1.2 #38778711963; BNB-1.3 #38778711692.
  - BNB-1.4 #38778711755; BNB-1.5 #38778711961; BNB-1.6 #38778711647.
  - BNB-1.7 #38778711571; BNB-1.8 #38778711705; BNB-1.9 #38778711724.
- 420Oracle audit #38778711887 was **IN PROGRESS at final evidence check**; not counted as a BNB Level 1 owner or success.
- 420Docs qualification #38778711703 was **SKIPPED**, neither a pass nor required at this app Level 1 boundary. No global Solidity, Genesis, Integrated, Geth or Docs Level 3 qualification was initiated.
- Superseded/cancelled runs against earlier implementation commits are not counted as exact-SHA evidence.

## Explicit limits and next step

- Synthetic fixture identity, single CI runner, shared local PostgreSQL, test-client API instances and controlled backup restore **do not** constitute production-grade multi-host failover or independently approved live recovery. Production credentials, external operator issuer, jurisdiction and deployment acceptance, independent restore facility, live Pay/Wallet and Search/Travel provider acceptance remain external/testnet gates. Do not mark them complete.
- Preserve `booking_enabled=false`, `travel.bnb_booking=false` and `financial_execution=false`; no production publication, live notification or settlement/custody.
- **BNB-5.12: COMPLETE — REPOSITORY LEVEL 1 PASS** for the qualified SHA. Retain PR #644 draft/open/unmerged.
- **Next canonical step: BNB-5.13 — M5-B end-to-end Level 2 milestone.** Accumulated app tests and guest/host/operator, notification, provider status, privacy, accessibility, failover/recovery acceptance on one SHA; record unwitnessed external scenarios individually. Comprehensive main-reconciled Level 3 remains solely at BNB-5.14.
