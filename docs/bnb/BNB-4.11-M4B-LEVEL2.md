# BNB-4.11 — M4-B End-to-End App Integration — Level 2 certificate

**Disposition: REPOSITORY LEVEL 2 PASS.** External connected-provider, live/testnet, human and operational gates remain blocked individually and MUST NOT be represented as synthetic PASS.

## Canonical milestone, branch and single qualified SHA

- Canonical [BNB-PHASE4-ROADMAP.md](BNB-PHASE4-ROADMAP.md) step **BNB-4.11 — M4-B end-to-end app milestone**: freeze accumulated Phase 4 application SHA; retained guest/host/admin, payment-status, Travel/Compliance/Identity/notification journey checks; negative privacy/security/accounting/recovery matrix; individual external scenarios recorded blocked.
- **Exact qualified implementation SHA `02c9ab8adaabd5b081bcff5a6c507cbdb05c7abc`.** No later executable changes inherit qualification automatically.
- Repository `abvhiael/420-integrated-v0.1`; branch `audit/bnb-phase4-bnb-4-1-baseline-20261013`; [PR #631](https://github.com/abvhiael/420-integrated-v0.1/pull/631) DRAFT, OPEN and UNMERGED. Original Phase 4 base `81c21541acdc1b900b9a15c6f6b75ff2d7c2b5d9`. At review, current main `959288c8bd33b6da0325b6a5d060e00e7bcf0e48`; branch 136 ahead / 408 behind. No current-main reconciliation claimed at M4-B: that is BNB-4.12.
- Previously completed M4-A BNB-4.7 and step-level BNB-4.8/4.9/4.10 certificates inherited with retained tests; no separate repeat of global Foundry/Genesis/Integrated/Docs at this milestone.

## End-to-end app integration requirement matrix

| Consumer path | App-level checks and negative acceptance | Evidence | Disposition |
| --- | --- | --- | --- |
| Guest: public search/discovery, quote, inventory, request, saved stays, payment status, cancellation and receipt | Nonbinding status, private session, absent identity, pending/recovery/finality distinctions, no wallet custody or self-issued payment approval | `browser_accessibility.py`, retained guest/host API, `test_bnb411_m4b_integration.py`, `test_bnb47_m4a_integration.py` | **Repository PASS** |
| Host: private draft, independent property gates, booking inbox, calendar, delegated view access, casework and operations | Revoked/expired authority, IDOR, independent reviewer separation, permission loss, private address and original payer minimization | `test_bnb48_host_casework.py`, `test_bnb48_review_integration.py`, `test_bnb411_m4b_integration.py`, browser smoke | **Repository PASS** |
| Admin/reviewer/moderation and legal hold | Externally signed reviewer grants, reporter/host/appeal conflict exclusion, legal retention floor, immutable audit and replay prohibition; no Pay or escrow privilege | `test_bnb39_trust_safety.py`, `test_bnb48_retention.py`, `test_bnb48_review_integration.py`, M4-B negative case | **Repository PASS; independent reviewers not live** |
| Pay/Wallet status and independent case/disbursement | Original payer/invoice constraints, finality/reorg recovery, signed revision case lifecycle, reserved/finalized refund and payout conservation, overdraw denial, no BNB custody | `test_bnb46_saga.py`, `test_postgres_adversarial.py`, `test_bnb47_m4a_integration.py`, M4-B negative matrix | **Repository PASS; real providers gated** |
| Travel/Location/Search/Compliance eligibility consumption | Coarse public metadata, eligibility/retraction, stale consumer and private address filtering, travel feature flag false, no booking authority | `test_bnb44_discovery_sync.py`, `test_bnb47_m4a_integration.py`, `test_travel_authority.py`, `test_bnb411_m4b_integration.py` | **Repository PASS; live consumers gated** |
| Identity, messaging, notifications, accessibility and device state | Identity subject/role permissions, revoked-account/session denial, message cursor and outbox replay, no unapproved provider send, keyboard/axe and resilient guest/host UI | `test_identity.py`, `test_bnb45_delivery.py`, `test_bnb42_outbox.py`, `browser_accessibility.py`, M4-B negative matrix | **Repository PASS; external devices and human acceptance gated** |
| Operational recovery and rollback | Independent operator approval, migration checksums, immutable event receipts, fenced leases, privacy-minimized alerts, no destructive schema rollback or unauthorized live reactivation | `test_bnb410_recovery.py`, `test_bnb214_operations.py`, runtime backup/restore and non-root staging, M4-B negative matrix | **Repository PASS; production drills gated** |

**M4-B implementation:** added `services/420bnb/tests/test_bnb411_m4b_integration.py` for combined cross-tenant guest/host/admin denial, Pay-case/reorg/refund conservation, outbox content minimization and operational recovery authority. New tests uncovered an actual security defect in `services/420bnb/outbox.py`: the previous top-level payload key blocklist rejected `address` but did not reject `private_address`. Updated validator rejects sensitive suffix-key variants (`_address`, `_email`, `_phone`, `_token`, `_secret`, `_password`, `_private_key`, `_authorization`) without weakening original payload validation. No external authorization or money-moving functionality added.

## Exact-SHA execution evidence

- Required full app [420BnB Runtime Slice `38503020503`](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38503020503), job `115654106322`, **terminal SUCCESS** on exact SHA `02c9ab8adaabd5b081bcff5a6c507cbdb05c7abc`.
- 8 PostgreSQL migration/operations tests PASS plus 301 runtime/API/security tests PASS = **309 passed / 0 failed**. Retained migration, concurrent transaction, recovery, browser axe/Playwright, secure nonroot image, logical backup/restore, TLS and deployment configuration checks completed in same job.
- All **nine retained BNB workflows terminal SUCCESS on same SHA**: Source `38503020483`; Product `38503020490`; Domain `38503020500`; Authority `38503020413`; Finance `38503020527`; Backend `38503020514`; Guest/Host `38503020485`; Security/Privacy `38503020443`; Operations `38503020511`.
- Predecessor Runtime Slice `38502914407` was a deterministic **FAIL**: 300 passed, 1 failed. Failure `test_m4b_payment_dispute_reorg_conservation_and_replay_redaction` revealed the actual `private_address` redaction defect. Fixed the root cause and ran new exact-SHA CI, no reclassification of predecessor as PASS.
- Skipped global Docs and unrelated 420Hz/Governance failures are not credited to M4-B. Separate Oracle integration does not substitute for BNB cross-provider contract tests.

## Individual external/production acceptance gates (BLOCKED, not synthetic PASS)

1. **Identity:** independently configured real issuer/key rotation, revoked device/session propagation, real role and consent consumption — **BLOCKED**.
2. **420Pay/420Wallet:** live invoices, wallet consent, real issuer signatures, chain finality/reorg, actual settlement, original-payer refund and independent dispute resolution — **BLOCKED**.
3. **Compliance/jurisdiction/property:** production verified property/legal eligibility, independently accepted jurisdiction and source revocations — **BLOCKED**.
4. **Travel, Location and Search:** actual production consumer SDK end-to-end integration, retraction propagation and independently accepted publication — **BLOCKED**.
5. **Notifications/delivery:** real private device/inbox delivery, retries, revoked-device response and external consumer receipts — **BLOCKED**.
6. **Human accessibility:** NVDA/VoiceOver/TalkBack sessions and independent jurisdictional WCAG/legal approval — **BLOCKED**.
7. **Security/privacy/legal:** independent security review, privacy retention and operational legal approval — **BLOCKED**.
8. **Operational recovery:** production managed PostgreSQL encryption/backup custody, failover/RTO/RPO real drills, monitoring/on-call and independent operator signoff (`T-BNB-OPS-214`, `T-BNB-SECURITY-213`) — **BLOCKED**.

All other individually named T-BNB gates remain owned by [BNB-TESTNET-WORK-ROADMAP.md](BNB-TESTNET-WORK-ROADMAP.md); this certificate does not retire them or override their more specific dispositions. Preserve `travel.bnb_booking=false`, `booking_enabled=false`, `financial_execution=false`. Do not call fixture/contract PASS a live provider PASS.

## Closeout boundary and next step

**BNB-4.11 M4-B: Level 2 REPOSITORY COMPLETE.** PR #631 remains draft/open/unmerged. Phase 4 is **not complete**. Next canonical step **BNB-4.12 — Phase 4 closeout**, reconciling one exact current-main merge-candidate SHA and performing canonical full Solidity once, independent Genesis address authority (no duplicate Foundry), 420 Integrated, global Docs and affected app/client/Indexer/Search/RPC/security/deployment suites once at Level 3 before requesting merge authorization.

This certificate is evidence-only. Its commit SHA may differ from the qualified executable SHA; no recursive CI is needed unless executable source, tests, workflow, dependencies, configuration or substantive requirements change.
