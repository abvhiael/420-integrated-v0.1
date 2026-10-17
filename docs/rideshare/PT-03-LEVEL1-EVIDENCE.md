# LIFTd PT-03 — Pay integration Level 1 evidence

**Disposition:** PT-03 repository-side engineering **PASS**; canonical L03.10 official testnet **NOT ACCEPTED**.

- **Qualification level:** Level 1, scoped Pay; Level 2 and Level 3 not dispatched.
- **Exact qualified implementation SHA:** `365d612a5255693f4aed1044c7e6b10e202489c1`.
- **Reconciliation base SHA:** `4527d832c0ff85b5210290476a0d2ff4f17cea37` (main when branch opened).
- **PR:** [#712](https://github.com/abvhiael/420-integrated-v0.1/pull/712); branch `audit/liftd-pt03-pay-integration-20261017`.
- **Scoped CI:** [LIFTd PT-03 Pay Level 1 run #39077261707](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39077261707), job `117526896520`, **SUCCESS**.
- **Tests:** retained application/security suite **125 PASS / 0 FAIL**; isolated PostgreSQL16 canonical Pay integration **16 PASS / 0 FAIL**, total **141 PASS / 0 FAIL**. Real isolated Postgres name `liftd_qualification`; no mocked SQL substitute. Job checks out exact implementation HEAD.
- **Code:** `rideshare/src/pay-authority.mjs` now refuses Wallet consent signer key overlap with prepare, event, operation, meter, rules and funding authority keys while retaining intentional Wallet/beneficiary signer sharing. `rideshare/test/pay-authority-isolation.test.mjs` proves rejection for each forbidden domain.
- **Retained Pay coverage:** quote/intent and explicit Wallet consent, transaction idempotency, receipt equivocation/replay, finalized canonical captures, independent reorg recovery, original payer refunds, component ceilings, compensation projections, platform funding, payout reservations/finality, operation recovery and account scoping.
- **Known limitation:** fixtures generated keys and local Postgres demonstrate only repository-side correctness. Official deployed 420Pay, Wallet authority, funded settlement, actual refunds, payouts, independent authority rotation and consumer receipt observability all remain **NOT ACCEPTED**, kept in original L03.10 and TN-0–TN-6 ledger. Public passenger/payment operation must stay disabled.
- **Merge disposition:** pending final HEAD/main compatibility and explicit merge instruction. No global Solidity/Genesis/Geth/Integrated/Docs workflows manually dispatched.
- **Next proposed pretestnet package:** PT-04 — Registry and chain state; not advancement of canonical L03.10 acceptance.

Evidence-only certificate: qualification attaches to the tested implementation SHA and does not imply reruns for this Markdown addition.
