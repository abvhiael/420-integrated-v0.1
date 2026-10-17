# LIFTd PT-02 — durable Wallet Level 1 qualification

**Disposition:** Repository-side PT-02 implementation QUALIFIED (Level 1). Original canonical L03.10 official-testnet integration remains **NOT ACCEPTED**.

- **Exactly tested implementation SHA:** `aeda7aacfadc5485fdf2f4e148429a564dcae192`.
- **Successful scoped workflow:** [LIFTd PT-02 Wallet Level 1, run #39072401030](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39072401030), job `117512531454` completed **SUCCESS**; job log verified checkout of the exact implementation SHA.
- **Results:** retained LIFTd suite **124 PASS, 0 FAIL**; canonical Wallet SDK consumer tests **3 PASS, 0 FAIL**; total **127 PASS, 0 FAIL**.
- **Qualified changes:** `rideshare/src/payment-protocol.mjs` checks exact intent and prepared direct ERC-20 settlement binding, explicit consent and expiry, and rechecks chain/controller/smart-account ownership after asynchronous wallet preparation; no broadcast, blanket allowance or implicit authorization. `rideshare/test/sdk/payment-wallet.test.mjs` validates chain switching, expiry and explicit consent; `.github/workflows/liftd-pt02-level1.yml` builds SDK and covers affected tests.
- **Failure history:** initial run #39072336990 failed because an adversarial test used an invalid Proxy override of frozen SDK methods; fixed the test harness with explicit SDK adapter and qualified the corrected SHA in run #39072401030. The failed run is not counted as PASS.
- **Reconciliation base:** `30321d02437d7abb2d4fd95d5c8dd8820350420c` (PR base at qualification/evidence review); compare with current `main` again before merging.
- **PR:** [#710](https://github.com/abvhiael/420-integrated-v0.1/pull/710); branch `audit/liftd-pt02-wallet-integration-20261017`.
- **Level 2 / Level 3:** not run; not required for this preparatory ordinary Level 1 step.
- **External boundary:** actual live Wallet/Pay authority, production-equivalent account/session revocation, transaction submission, finality/reorg, refund/payout and independent approval remain under existing L03.10 TN-0–TN-6 roadmap. No live acceptance or public passenger operations authorized.
- **Next supplementary pre-testnet package:** PT-03 — Pay integration; do not mark L03.10 accepted.

This document is administrative evidence only. Preserve the exact tested SHA and avoid redundant retesting unless the qualified executable input changes.
