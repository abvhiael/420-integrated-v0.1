# LIFTd PT-05 — exact-SHA Messaging and notifications Level 1 qualification

**Disposition:** Local PT-05 repository engineering **PASS**; canonical L03.10 and deployed Messaging operational signoff **NOT ACCEPTED**.

- **Exact tested implementation SHA:** `ea171b9a93ed30db9aaefb5d1d8bfd69a22fae43`.
- **PR:** [#714](https://github.com/abvhiael/420-integrated-v0.1/pull/714), branch `audit/liftd-pt05-messaging-notifications-20261017`.
- **Qualification owner:** dedicated [PT-05 Level 1 run #39078330916](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39078330916), job `117530001074` **SUCCESS**, exact checkout SHA confirmed.
- **Tests:** **129 PASS, 0 FAIL** retained LIFTd application/security tests. Includes new driver reassignment, stale notification revision, cross-participant sender tests.
- **Code:** `rideshare/src/trip-communications.mjs` verifies trip membership continuity including account/session/device/recovery and exact driver/rider/state/revision before Messenger send/read. Notification path requires rider-specific authenticated consent, checks calling session and current trip revision before publish, blocks notification of another participant using unrelated caller credentials, keeps unsafe driver notification sends disabled.
- **Existing authority:** Messenger still alone issues transport-capable grants; LIFTd neither self-signs nor escalates grants. PT-01 Identity consent guard remains mandatory. Unconfigured dependencies fail shut.
- **Reconciliation base:** repository main at branch creation, originally latest PR #713 merged commit `ae42f5b5ba8a14736e230bdb4b3300d0a2565c72`; reconfirm current main at merge time.
- **Live acceptance pending:** independent encrypted Messenger deployment, delivery-time revocation, abuse/moderation controls, encrypted transport receipts, provider-side idempotency and operator/privacy approval remain **NOT ACCEPTED**, tracked under original LIFTd-TN-MSG and TN-0–TN-6; app not approved for public dispatch.
- **Level 2 / Level 3:** not run; no global inventories dispatched.
- **Next supplementary pre-testnet item:** PT-06 — Privacy and evidence; canonical L03.10 unchanged.

This evidence-only certificate does not modify the tested source, workflow, fixture or executable artifact.
