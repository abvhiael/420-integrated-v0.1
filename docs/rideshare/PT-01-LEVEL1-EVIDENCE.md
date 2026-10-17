# LIFTd PT-01 — local Identity and consent guard Level 1 evidence

**PT-01 is a supplementary pre-testnet work package, not a canonical L03.10 completion.**

- **Exact qualified implementation SHA:** `055a42b328e5625444b55a3b3eae8b0566864324`.
- **GitHub Actions:** [PT-01 Level 1 run #39071100441](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39071100441), job `117508714752`, completed **SUCCESS**.
- **Exact checkout:** job log confirms checkout of `055a42b328e5625444b55a3b3eae8b0566864324`.
- **Tests:** **123 PASS, 0 FAIL**, retained rideshare unit/security suites and PT-01 negatives.
- **Files:** `rideshare/src/identity-consent-guard.mjs`, `rideshare/test/identity-consent-guard.test.mjs`, `.github/workflows/liftd-pt01-level1.yml`, `docs/rideshare/PT-01-IDENTITY-CONSENT.md`.
- **Baseline:** candidate branched from contemporary `main` and PR #707 was zero commits behind at reconciliation check.
- **Scope qualified:** fresh signed Identity/session authorization + durable opt-in reader, role/account/session/device/recovery revalidation, purpose allowlist and fail-closed revoked/expired/unavailable states.
- **Unfinished repository integration:** this new guard is not yet demonstrably wired to every consumer of optional marketing, location-history or trip-notification permission; do not mark PT-01 *fully complete* until consumers and invocation points are verified and any required wiring is scoped-qualified.
- **Live external acceptance:** separately operated Identity issuer/session signer, rotation/revocation/outage and network evidence remain **NOT ACCEPTED**, tracked under existing `LIFTd-TN-ID`, TN-0 to TN-6. No public passenger operations authorized.
- **Qualification:** scoped Level 1 only; no global suites manually dispatched. Level 2 / Level 3 not initiated.
- **Status:** new guard **QUALIFIED**, overall PT-01 **PARTIAL / consumer verification pending**.
