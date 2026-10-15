# BNB-5.8 — Notification delivery and device lifecycle — Level 1 certificate

**Status: COMPLETE — REPOSITORY LEVEL 1 PASS** for the exact executable implementation SHA below. This certificate is **not** a live notification-provider activation, independent identity approval, production deployment, or Phase 5 closeout.

## Authority and exact SHAs

- Canonical source: `docs/bnb/BNB-PHASE5-ROADMAP.md`, **BNB-5.8 — Notification delivery and device lifecycle**: extend messaging notices with durable recipient/device delivery state, preferences, revocation and reconnect recovery; enforce cross-account/privacy/duplicate/expired authority boundaries; message bodies and private account data never enter general events; provider activation external.
- **Qualified executable implementation SHA:** `63d12022dabfc20048da6055efb5aa418dcccb7d`.
- Repository: `abvhiael/420-integrated-v0.1`. Branch: `audit/bnb-phase5-bnb-5-1-baseline-20261014`. [PR #644](https://github.com/abvhiael/420-integrated-v0.1/pull/644), draft/open/unmerged.
- Original Phase 5 PR base: `3f2cf64897e96c4f16213bcaf93564db72a174c9`. At qualification, comparison with `main` showed **67 commits ahead and 558 behind**, merge-base `2e6dbfdfe3565e7088ca757a43417c1e8cb1ebb4`. This app Level 1 is **not** a main-reconciliation certification. Reconcile complete phase at BNB-5.14, not on this ordinary step.
- Prior accumulated BNB-5.7 M5-A Level 2 certificate: `docs/bnb/BNB-5.7-LEVEL2-CERTIFICATE.md`, implementation SHA `85a110e12243469a52b800a903fdc6b85627e32a`, evidence commit `15565c6e97c9eb64f5b362f52239db28cf0af5d2`.
- This new certificate is **evidence-only** and does not change the qualified code/tests/CI/configuration. The resulting certificate commit is evidence SHA, not a newly qualified executable SHA.

## Implementation and original exit criteria

1. **Durable recipient/device state:** `services/420bnb/migrations/030_message_device_lifecycle.sql` establishes account-scoped device authority with expiration/revocation/preferences, and indexed, individually acknowledged notification notices, with uniqueness on message/recipient/device.
2. **Authenticated account and device APIs:** `services/420bnb/api.py` adds account-scoped device registration, notification preference changes, revocation, private metadata-only pending-notice retrieval and acknowledgment routes. Existing thread message recovery and cursor acknowledgments now revalidate device authority; existing request/identity boundaries remain in effect.
3. **Recipient isolation and bounded delivery:** `services/420bnb/notification_delivery.py` validates device IDs and authority expiry, disallows reuse of revoked device IDs, updates preferences, returns bounded pending metadata, acknowledges each notice with idempotent replay handling, and prevents cross-account/device access through the account-subject predicate.
4. **Durable transactional fanout:** a new message, its device-specific notice records and its existing general outbox marker share one transaction. Recipient selection is derived from the current request's guest/host subject and currently active/unrevoked/nonexpired opted-in registered devices. Duplicate enrollment for the same message/recipient/device is prevented by a PostgreSQL unique constraint and conflict-safe insert.
5. **Privacy and external activation:** `bnb.message.created` general event remains restricted to `request_id` and `message_id`. Message bodies remain in the authenticated guest-message store, never general events, notices or response metadata. Provider/push/SMS/email activation remains **false/not implemented**; no production provider token or consumer authority is provisioned.
6. **Schema/operational continuity:** `production.py`, `recovery_operations.py`, `api.py`, `.github/workflows/bnb-runtime.yml` and affected retained tests verify the ordered **30-migration** ledger, fail-closed startup/readiness, privileges and backup/restore. Historical migration-upgrade fixtures now remove and restore migration 030 consistently before simulating earlier versions; actual migration order and checksum enforcement have not been weakened.
7. **Adversarial/recovery tests:** `services/420bnb/tests/test_bnb58_notifications.py` exercises verified-TLS PostgreSQL registration, preference suppression and reenabling, revocation/re-enrollment rejection, expiry, invalid device identifiers, account isolation, transactionally durable recipient fanout and duplicate prevention, idempotent acknowledgment/replay rejection for outsiders, and reconnect on a fresh database connection. Retained BNB-4.5/BNB-5.* messaging/auth and DB/infrastructure regressions also run.

## Exact-SHA Level 1 CI evidence

- Required **[420BnB Runtime Slice run #38687244960](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38687244960)**, runtime job **#116265197117**, terminal **SUCCESS** on `63d12022dabfc20048da6055efb5aa418dcccb7d`. Logs: **446 application tests passed + 8 operations tests passed = 454 tests**, zero failed runtime steps. Exact checkout/HEAD, verified-TLS PostgreSQL, 30-migration schema/migrator/runtime roles, isolated transactional tests, backup/restore, web/accessibility, non-root image/config and infrastructure artifact qualified.
- Runtime artifact `bnb32-infrastructure-63d12022dabfc20048da6055efb5aa418dcccb7d`, artifact ID **11949823892**.
- Same exact SHA: retained BNB-1.1 through BNB-1.9 workflows all **SUCCESS**:
  - BNB-1.1 #38687244970; BNB-1.2 #38687245080; BNB-1.3 #38687244952.
  - BNB-1.4 #38687245062; BNB-1.5 #38687245009; BNB-1.6 #38687244974.
  - BNB-1.7 #38687245024; BNB-1.8 #38687245159; BNB-1.9 #38687245044.
- Global 420Docs #38687245075 was **SKIPPED**, not counted as passing; global Level 3 Docs remains scheduled for BNB-5.14.
- 420Oracle audit #38687245113 remained **IN PROGRESS** at certificate construction, **not counted as a pass** or an app Level 1 owner.
- Superseded failed and cancelled runs are not qualification evidence. Earlier v30 introduction exposed deterministic v29 hard-coded workflow/readiness/recovery and migration-upgrade fixture expectations; corrected root causes without bypassing ledger integrity or weakening tests. The final cited SHA passed.

## Deferred gates and roadmap

Repository-only client messaging and device-notice delivery are qualified. No independent approval exists here for an externally provisioned identity authority/device revocation network, real push/SMS/email provider, public production endpoint, independent jurisdiction/legal/privacy/operational review, or live booking/financial deployment. Retain these on `docs/bnb/BNB-TESTNET-WORK-ROADMAP.md`; preserve `travel.bnb_booking=false`, `booking_enabled=false` and `financial_execution=false`. Neither synthetic credentials nor local database fixtures constitute real-world acceptance.

**BNB-5.8: COMPLETE / REPOSITORY LEVEL 1 PASS.** Level 2 next at documented BNB-5.13 milestone, unless a materially affected shared dependency independently requires it. Full main reconciliation and expensive Level 3 at BNB-5.14 only. **PR #644 stays draft, open and unmerged.**

**Next canonical step: BNB-5.9 — Authenticated operational controls**: least-privilege health/dead-letter/replay/reconciliation APIs and console actions; independent operator authority, current permissions, bounded requests and auditable decisions; forged authority, escalation and concurrency tests.
