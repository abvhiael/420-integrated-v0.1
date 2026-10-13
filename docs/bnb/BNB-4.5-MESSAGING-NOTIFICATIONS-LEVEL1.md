# BNB-4.5 — Guest and host messaging / notifications — Level 1 certificate

**Disposition: REPOSITORY LEVEL 1 PASS; live notification/provider and human/legal acceptance deferred.**

## Canonical step and exact source

- Canonical phase: [BNB-PHASE4-ROADMAP.md](BNB-PHASE4-ROADMAP.md) BNB-4.5, following certified BNB-4.4.
- Qualified executable SHA: **`3033e2c2fd9531ab95426b022feb0a7e46c57df3`**.
- Repository `abvhiael/420-integrated-v0.1`, audit branch `audit/bnb-phase4-bnb-4-1-baseline-20261013`, [draft PR #631](https://github.com/abvhiael/420-integrated-v0.1/pull/631) remains open/unmerged.
- Original Phase 4 base: `81c21541acdc1b900b9a15c6f6b75ff2d7c2b5d9`. Latest observed main SHA: **`959288c8bd33b6da0325b6a5d060e00e7bcf0e48`**. Audit branch **64 ahead / 408 behind** at exact executable qualification; no Phase 4 merge/main reconciliation authorized by this Level 1 certificate.

## Implementation and requirements

1. Retained existing `bnb_guest_message` booking-request-scoped messaging, nonce/replay protection, 30/hour sender rate limit, moderation visibility filter, abuse reports, independent moderation/appeal decisions and retention holds. These still own the existing casework; BNB-4.5 does **not** give a host self-issued media-review authority or pretend that a local 90-day hold is legal retention signoff.
2. Centralized `message_thread_scope` in `services/420bnb/api.py`: every message read, send, device replay and acknowledgement requires current active 420Identity-derived session/account, exact booking-request role, owner-of-current-property or unrevoked time-limited `handle_requests` manager grant. Unrelated tenant, deleted/revoked account, wrong property, unapproved manager and closed/declined/withdrawn/expired/cancelled request fail closed. Existing signed owner/manager grant issuance and revocation authority is preserved.
3. Nonempty message body remains bounded to 3000 characters. Added control-character rejection, server-side visible moderation filters, nonce conflict handling, request closure checks and existing rate limiting. Messages are never exposed in discovery/search, outbox payloads, public logs or external integrations.
4. Migration `025_message_delivery.sql` establishes per-request, per-active-subject, per-device cursor for resumable multi-device delivery; the authenticated GET/ACK routes validate device bounds, page-size bounds, message membership and visible moderation status. Acknowledgement cannot rewind past a later acknowledged cursor. Live notification recipients are **not** inferred from arbitrary user-supplied emails/phones.
5. In the same transaction as successful message creation, inserts redacted `bnb.message.created` event into the canonical BNB-4.2 durable outbox. Payload carries only `request_id` and `message_id`; no raw body, personal contact details or externally provisioned push provider. `outbox.py` allows this bounded event; crash/retry/dead-letter/receipt contracts remain the owner of delivery semantics.
6. Retained production role separation, fail-closed v25 schema readiness, PostgreSQL migration ordering and backup/restore exact ledger equality. BNB-4.5 adds no new Genesis contracts or external issuer permissions.

Changed files: `services/420bnb/api.py`, `outbox.py`, `migrations/025_message_delivery.sql`, `tests/test_bnb45_delivery.py`, `production.py`, `tests/test_bnb214_operations.py`, `tests/test_bnb32_infrastructure.py`, `tests/test_bnb41_phase4_baseline.py`, `.github/workflows/bnb-runtime.yml`.

## Exact-SHA Level 1 GitHub evidence

- Required [420BnB Runtime Slice **38453042612**](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38453042612), job **`115488566664`**, terminal **SUCCESS** against `3033e2c2fd9531ab95426b022feb0a7e46c57df3`. Logs: **8 migration/operations tests PASSED + 248 app/API/security tests PASSED = 256 tests passed**, zero failed. Includes v25 migration concurrency/readiness, hostile input, role scope denial, cancellation, active account, delivery bounds, browser accessibility smoke, staged non-root build, TLS, backup/restore, and fail-closed packaged production checks.
- Nine retained BNB 1.1–1.9 workflows all **SUCCESS** on same SHA: `38453042529`, `38453042165`, `38453042327`, `38453043027`, `38453042321`, `38453042824`, `38453042456`, `38453042454`, `38453042452`.
- Global Docs run `38453042938` intentionally **SKIPPED**, not credited. 420Oracle `38453042970` **IN PROGRESS** at inspection, unrelated to app-only Level 1; not credited.
- Superseded failures were investigated: `38452471424` exposed a test fixture that did not model canonical manager grant lookups; `38452849613` identified literal `\\n` characters accidentally committed in the fixture. Fixed the fixture without bypassing manager-grant checks or relaxing test assertions. Prior failed and superseded SHAs are not counted PASS.

## Limits, deferrals and milestones

Repository Level 1 covers **authenticated app-local messaging and the deferred outbox notification marker**. It does NOT prove operational push/SMS/email provider delivery, independent identity issuer/session revocation on real hardware, production multi-instance/offline device acceptance, independently staffed moderation or legal retention approval. These remain under the existing [BNB testnet work roadmap](BNB-TESTNET-WORK-ROADMAP.md): Identity, Property, Media/Reputation, Travel/Location, Compliance, Accessibility, Pay/Wallet, Security/Operations and jurisdictional/legal/privacy approvals. Do not claim actual external notification activation. Keep `travel.bnb_booking=false`; no live booking/financial or listing activation.

Current message request-state rules preserve existing prebooking guest/host communication; an accepted payment or stay cannot be inferred merely from thread messages. Legitimate cancellation/recovery remains in existing booking lifecycle handlers, not granted by this notification step.

The current implementation provides per-device polling/ACK and server-side durable outbox **seams**. It does not claim a deployed independent transport, instant push, or human accessibility screen-reader acceptance. The full BNB-4.7 M4-A app integration milestone, BNB-4.11 M4-B and BNB-4.12 Phase 4 Level 3 remain unexecuted.

**BNB-4.5 repository Level 1 PASS.** Before any eventual merge, reconcile 408 intervening main commits and requalify any substantively changed executable candidate.

**Next canonical step: BNB-4.6 — Booking Orchestration and Economic Reconciliation.**
