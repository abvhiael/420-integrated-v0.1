# LIFTd PT-06 — Privacy and evidence Level 1 qualification

**Status:** Supplemental PT-06 repository-side implementation Level 1 **PASS**. Canonical L03.5 independent deployed acceptance and L03.10 official-testnet integration remain **NOT ACCEPTED**.

- **Exact qualified implementation SHA:** `24a49a403e2d939f07e94f84c1547a7368ced56f`.
- **Reconciliation base:** `010f21d9f190d90faf44b745a679ea5c32c40f55` (merged PT-05/main branch base).
- **Branch:** `audit/liftd-pt06-privacy-evidence-20261017`; [PR #716](https://github.com/abvhiael/420-integrated-v0.1/pull/716).
- **Dedicated Level 1 workflow:** [LIFTd PT-06 Privacy Evidence #39081427411](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39081427411); job `117538971706`, **SUCCESS**; GitHub log confirms checkout of exact implementation SHA.
- **Tests:** retained LIFTd application suite **129 PASS / 0 FAIL**, isolated PostgreSQL 16 privacy request/retention/evidence lifecycle integration **1 PASS / 0 FAIL**, **130 tests PASS, 0 FAIL total**. PostgreSQL fixture is real, not an in-memory mock. Both test commands executed on same SHA.
- **Implementation:** `rideshare/src/privacy-retention.mjs` now rejects authority responses with wrong action or trip resource, missing subject/account/session/device, invalid recovery epoch or unsafe expiry before accessing privacy requests, exports or erasure. Retains before/after session authorization checks and protected evidence/financial holds.
- **Negative regression:** `rideshare/test/postgres/privacy-retention.test.mjs` verifies wrong action, mismatched trip resource and invalid expiry fail closed without creating request; retains redaction, incident/evidence/financial hold, idempotency, immutable audit and retention sweep test.
- **CI owner:** `.github/workflows/liftd-pt06-level1.yml` exact checkout and app plus PostgreSQL scope. No separate global qualification dispatched.
- **Previously qualified:** canonical L03.5 Level 1 and M-L03-A Level 2 evidence remain unaltered; no duplicate broad suites.
- **Remaining genuine external acceptance:** trusted production privacy authority and scheduler, legal retention/erasure policy approval, replicas/backups/providers deletion, deployed hold propagation, encrypted evidence vault, independent privacy/security review, telemetry/log redaction and SLA signoffs. These remain NOT ACCEPTED under existing L03.5 deployed/privacy testnet roadmap. Official L03.10 and production passenger operation remain blocked.
- **Level 2:** not initiated for PT-06. **Level 3:** not initiated. **Merge:** pending separate final authorization and fresh main comparison.
- **Next canonical roadmap:** unchanged locked L03.8 → L03.9 → L03.10 → M-L03-B → L03.11 → L03.12; do not treat PT series as replacements.

This certificate is evidence-only: it does not modify the executable SHA or qualification inputs.
