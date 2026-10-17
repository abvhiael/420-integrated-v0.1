# LIFTd PT-01 — identity and consent consumer closeout, repository Level 1

**Disposition:** **Repository-side PT-01 qualified**; live independently operated Identity/session integration and deployed consumer delivery remain **NOT ACCEPTED** under canonical L03.10/TN-0–TN-6.

## Qualified sources and inventory

- Implementation SHA: `71325310cba012ab88c784f7edebb002bf07d567`.
- Scoped [PT-01 Level 1 run #39071806834](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39071806834), job `117510792846`: **SUCCESS**, **124 tests passed, 0 failed**.
- Exact SHA checkout verified in GitHub Actions log; no skipped mandatory job.
- Original guard qualification retained: implementation `055a42b328e5625444b55a3b3eae8b0566864324`, [run #39071100441](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39071100441), 123 pass / 0 fail. Superseded for affected consumer code by the newer successful run; do not present original SHA as qualifying newer modifications.
- Affected files: `rideshare/src/identity-consent-guard.mjs`, `rideshare/src/trip-communications.mjs`, their tests and scoped `liftd-pt01-level1.yml` workflow.
- Consumer source discovery: `rider-preferences.mjs` owns `marketingConsent`, `locationHistoryConsent` and `tripNotifications`; `trip-communications.mjs` contains the active optional trip event notification side effect. No additional LIFTd source consumer of marketing/location history found. Travel consent and wallet consent are distinct, previously implemented purpose-specific paths.
- Notification consumer now requires an injectable `consentGuard.require` at assembly time, revalidates a rider's Identity/session and opt-in before publishing, refuses driver-token impersonation of rider opt-in and honors opt-out. Negative test verifies revocation denies publication.
- Scope: isolated local tests use controlled fake authorities (never an operational certificate). Live independent session/Identity issuers, delivery receipts, time-of-use authorization inside actual notification provider and multi-instance revocation propagation remain for canonical testnet work.
- Level 2: not run. Level 3: not run. No global workflows manually dispatched.
- Status: PT-01 **local consumer discovery / service-boundary integration PASS**. L03.10 **NOT ACCEPTED**; do not enable real public operations.
- PR: [#707](https://github.com/abvhiael/420-integrated-v0.1/pull/707) / `audit/liftd-pt01-identity-consent-20261017`.

This certificate is evidence-only and preserves the exact successful tested implementation SHA.
