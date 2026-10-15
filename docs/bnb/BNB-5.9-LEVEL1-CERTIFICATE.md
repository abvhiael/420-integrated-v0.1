# BNB-5.9 — Authenticated operational controls — Level 1 certificate

**Disposition: COMPLETE / REPOSITORY LEVEL 1 PASS** for the exact executable SHA below. This is not live operator issuer approval, production recovery authorization or Phase 5 Level 3 closeout.

## Canonical requirement and source authority

- Repository `abvhiael/420-integrated-v0.1`; [draft PR #644](https://github.com/abvhiael/420-integrated-v0.1/pull/644) remains **open and unmerged**.
- Phase 5 roadmap `docs/bnb/BNB-PHASE5-ROADMAP.md`, **BNB-5.9 — Authenticated operational controls**: least-privilege health/dead-letter/replay/reconciliation APIs and console actions; independent operator authority, current permissions, bounded requests and auditable decisions; forged authority, escalation and concurrency qualification.
- **Qualified executable SHA: `3d1d7706cf476ec59c3a1c48215082a13bba31d7`**.
- Branch `audit/bnb-phase5-bnb-5-1-baseline-20261014`. PR phase base `3f2cf64897e96c4f16213bcaf93564db72a174c9`; comparison with current `main` at qualification: **82 ahead / 561 behind** (merge base same phase base). This is an ordinary Level 1, not main reconciliation. Reconcile at BNB-5.14.
- Previous BNB-5.8 certificate `docs/bnb/BNB-5.8-LEVEL1-CERTIFICATE.md`, qualified executable SHA `63d12022dabfc20048da6055efb5aa418dcccb7d`; certificate-only commit `0d3e3f0edd251f7d9a5de26cdd05f100941aac0b`.

## Implementation, access control and invariants

1. **Authenticated operations APIs** in `services/420bnb/api.py`: internal operator health, redacted bounded dead-letter inventory, four non-destructive recovery/reconciliation assessments, exact-event legacy outbox replay and explicit Search/Travel consumer-scoped replay. Public readiness remains separate and does not grant operator privileges.
2. **Independent current operator authority** in `services/420bnb/operational_controls.py`: requires an independently provisioned `BNB_OPERATIONS` RS256 issuer/audience/public key and a signed purpose `bnb-operator` proof with exact action `capability`, subject, bounded expiry and issuer session ID. Rechecks an unrevoked/unexpired database identity session bound to that same external issuer, and active account, on each privileged request. Missing, invalid, expired, revoked and cross-capability proofs fail closed; BnB does not mint issuer credentials or approvals.
3. **Least-privilege/redaction**: health exposes only aggregate pending/dead counts and disabled execution; dead-letter records expose bounded event IDs, event types, attempts, time and consumer scope, never event payloads, addresses, financial details or message bodies. Aggregate inventory includes legacy outbox and independently managed per-consumer deliveries.
4. **Fenced manual replay**: signed permission must bind the *exact event UUID* and optional Search/Travel consumer, plus an operation nonce. Database uniqueness prevents reuse of that nonce; the preexisting transactional `outbox.replay` and `consumer_delivery.replay` primitives own lease, subscriber, dead-letter, receipt and subscription revision fences. HTTP acknowledgment means queued redrive, not successful external delivery. No arbitrary live consumer, unsigned review, broad admin bypass or on-chain authority.
5. **Auditable decisions**: successful read/assessment/replay decisions append bounded records in existing `bnb_audit`; replay nonce claims use existing transactional `bnb_request_dedupe`. No new migrations or broad runtime database role privileges were introduced.
6. **Operator console** `services/420bnb/operator_console.py`: restricted command-line actions for health, bounded dead letters, non-executing reconciliation assessment and event/consumer-specific replay; explicit HTTPS origin, certificate trust, mounted restricted-permission bearer-token file, no inline token argv, URL credentials, redirects or insecure fallback. Does not execute restore, rollback, deploy, settlement or other privileged external work.
7. **Negative/adversarial coverage**: `test_bnb59_operations.py` exercises malformed authentication, wrong action, revoked/missing session, unsafe endpoint/credentials, invalid and duplicate nonces, replay targeting and bounded parameter failure; `test_bnb59_postgres.py` exercises current TLS/PostgreSQL session revocation, nonexistent event inability to redrive, genuine dead-letter replay with audit and replay rejection, and actual RSA signature forgery/expired proof denial. Retained BnB worker, consumer, concurrency, migration, browser, replay and infrastructure regression tests remained enabled.

## Exact-SHA qualification

- Required app **[420BnB Runtime Slice #38691759549](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38691759549)**, runtime job **#116279147524**: terminal **SUCCESS**, exact SHA asserted `3d1d7706cf476ec59c3a1c48215082a13bba31d7`. **457 application tests passed + 8 operations tests passed = 465 test executions**; zero failed runtime steps. Verified-TLS PostgreSQL, migration ledger/parallel deployments, production runtime security, nonroot images, browser accessibility, topology and backup/restore retained.
- BnB guardrail workflows **9/9 SUCCESS** on exact SHA:
  - BNB-1.1 #38691759765; BNB-1.2 #38691759203; BNB-1.3 #38691759593.
  - BNB-1.4 #38691759171; BNB-1.5 #38691759178; BNB-1.6 #38691759285.
  - BNB-1.7 #38691759341; BNB-1.8 #38691759542; BNB-1.9 #38691759423.
- Infrastructure artifact **`bnb32-infrastructure-3d1d7706cf476ec59c3a1c48215082a13bba31d7.zip`**, GitHub artifact ID **11951369610**.
- 420Docs global qualification #38691759514: **SKIPPED**, not counted as a PASS or ordinary Level 1 owner; reserved for Phase 5 Level 3.
- 420Oracle audit #38691759522: **IN PROGRESS at certificate preparation**; not counted as PASS or as a mandatory BNB-5.9 app qualification owner.
- Earlier superseded/cancelled/queued/failed runs are not included in the above passing evidence; no global Solidity, Genesis, Integrated or Docs suites were used to substitute for app Level 1.

## External gates, milestone and handoff

All controls are repository scoped and require independent operational tokens and current identity sessions at runtime. Independent operator identity-provider provisioning, privileged issuer grant issuance/revocation services, external Search/Travel acceptance, real recovery personnel/approvals, production infrastructure and jurisdictional legal/security signoff remain on `docs/bnb/BNB-TESTNET-WORK-ROADMAP.md`. Do not treat fixture keys, local database checks or an allowed replay request as live acceptance.

Preserve `travel.bnb_booking=false`, `booking_enabled=false`, `financial_execution=false`, no production listing publication, no live notification-provider activation, no BnB signing/spending/custody authority. **No merge** of PR #644. Level 2 remains at BNB-5.13; full current-main reconciliation and Level 3 only at BNB-5.14.

**BNB-5.9: COMPLETE — REPOSITORY LEVEL 1 PASS. Next canonical roadmap step: BNB-5.10 — Continuous Pay/Wallet reconciliation.**
