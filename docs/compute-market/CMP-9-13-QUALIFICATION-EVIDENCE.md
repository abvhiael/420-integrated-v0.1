# CMP-9.13 — Scientific workload demonstration evidence

**Outcome:** Offline Level 1 PASS; canonical live scientific demonstration **NO-GO / NOT COMPLETE**.

- Implementation SHA `71310d4d52641986b10386fff48f1973f338d75a`, S-10 parent `6545539249a9b03409d7a497e11f6a9b26df2323`, `main` baseline at inspection `ffc6a4028676907c266714b5c1ae8ba3af9a7137`; branch `cmp-9-13-scientific-demonstration-20261008`, stacked PR #585 atop S-10 PR #584 and predecessor CMP S-01–S-09 PR chain.
- Code `compute/ingestion/src/scientific-demonstration.mjs`, tests `compute/ingestion/test/scientific-demonstration.test.mjs`, Node22 package check, app CI `.github/workflows/cmp-9-13-scientific.yml`, implementation and planning doc.
- Required [CMP 9.13 Scientific Demonstration Gate CI run 37863199688](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37863199688): **SUCCESS**, exact implementation SHA; job `113603610931` SUCCESS; Node syntax, new gate tests and retained S-02–S-10 regression tests completed.
- Negative checks: missing evidence, fixture impersonation of live work, unfunded/unqualified release and default operational NO-GO.
- Canonical purpose: real funded scientific workload while retaining general-purpose compute. Offline gate requires source receipts, real worker execution, independently verified accepted result, treasury/Vault-funded settlement, Wallet/Indexer/420Compute readbacks, finality, recovery and reviewed adversarial evidence.
- **Unmet live requirements:** actual verified scientific job/results, independent source/work-unit approval, participant identity and consent, isolation/worker verification, verified attester and CMP-6/Vault payout, on-chain receipt readback and recovery, exact-release Level 2 validation, operator and independent reviewer sign-off. None was demonstrated by fixture CI.
- Level 2 real funded workflow **not attempted / BLOCKED** until functioning testnet and approved providers. Level 3 broad phase qualification deferred; Solidity owns Foundry and Genesis verifies address authority without inventory duplication.
- Next CMP-9 step: **CMP-9.14 — Long-duration soak testing**; CMP-9.15 and CMP-10 follow only after required operational evidence.

Evidence-only update, qualified source SHA unchanged.
