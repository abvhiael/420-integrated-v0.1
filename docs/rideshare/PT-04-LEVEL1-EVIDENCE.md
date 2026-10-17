# LIFTd PT-04 — Registry and chain-state Level 1 evidence

**Disposition:** Supplemental PT-04 repository-side safeguards **PASS**. Canonical L03.10 deployed/official-testnet integration **NOT ACCEPTED**.

- **Qualification level:** Level 1. Level 2 and Level 3 not dispatched.
- **Exact qualified implementation SHA:** `cbbe21afbcf23a7c0f5d09c207a22120e594f4f3`.
- **Reconciliation base SHA:** `6e7a7167da6fc4fa2371338bc0fef861ff688962` (main at branch creation).
- **PR:** [#713](https://github.com/abvhiael/420-integrated-v0.1/pull/713), branch `audit/liftd-pt04-registry-chain-state-20261017`.
- **GitHub Actions:** [LIFTd PT-04 Registry Chain State Level 1 #39077727273](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39077727273), job `117528256465`, completed **SUCCESS** with exact checkout verified.
- **Actual results:** retained LIFTd suite **126 PASS, 0 FAIL**. Includes PT-04 security regression for driver/vehicle signer separation and existing eligibility/revocation/scope regressions.
- **Implementation:** `rideshare/src/eligibility.mjs` rejects driver and vehicle Registry signers sharing public signing keys at configuration/assembly time, in addition to retaining independent transport signer checks; `rideshare/test/eligibility.test.mjs` tests forbidden key alias and healthy distinct issuer path; dedicated Level 1 workflow.
- **Chain-state preservation:** retained `rideshare/src/payments.mjs` performs signed event/operation proof binding, finality gates, reorg recovery, refund and payout safety; previous PT-03 qualification had 125 app tests and 16 isolated PostgreSQL Pay tests passing (run #39077261707). This PT-04 run **does not rerun** PostgreSQL Pay tests and does not claim new live chain finality evidence.
- **Outstanding official-testnet/independent requirements:** actual Registry issuer certificates, independently operated revocation propagation, deployed multi-instance dispatch, real blockchain confirmation/reorg, funded Pay transactions and consuming-service proofs remain NOT ACCEPTED under original L03.10 and existing TN-0–TN-6 ledger. L03.8/L03.9 independent approvals also remain outstanding.
- **Current status:** PT-04 scoped repository readiness PASS; merge pending final reconciliation and authorization. Next proposed pre-testnet package PT-05; **not** advancement of canonical L03.10.
- **No global workflows manually dispatched.** This evidence-only record does not alter qualified executable inputs.
