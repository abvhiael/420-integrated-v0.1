# S-09 — Live two-provider milestone status and qualification evidence

**Milestone status: BLOCKED, not COMPLETE.** Offline evidence-manifest validator and targeted tests implemented; actual S-09 Level 2 funded testnet evidence is not present.

- Implementation candidate SHA: `f3e7f658e72e54293353f9bd5d6c0aa8666f81ae`.
- Branch: `cmp-s09-two-provider-testnet-gates-20261008`; stacked PR #583 on S-08 PR #581 and the preceding S-01–S-07 stack.
- S-08 inherited parent SHA: `d3eb5c311d5abc5cfa36e9bfeb8ccfbf8fe77c6f`; main at initial S-09 inspection: `ffc6a4028676907c266714b5c1ae8ba3af9a7137`.
- Changed files: `compute/ingestion/src/milestone.mjs`, `compute/ingestion/test/milestone.test.mjs`, `compute/ingestion/package.json`, `.github/workflows/cmp-s09-milestone.yml`, `docs/compute-market/CMP-S09-LIVE-MILESTONE-TESTNET.md`.
- First exact-head workflow run `37847295375` FAILED on superseded SHA `79ecd0d5814077832810b91e2aada92c6af3e12e`: source validator rejected valid short chain IDs. Corrected to numeric chain-ID validation on implementation SHA above. The failed run is not accepted as successful evidence.
- Corrected targeted [CMP S-09 Testnet Milestone Gate run 37847377392](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37847377392). **CI outcome must be verified independently before qualifying repository Level 1.**
- The verifier demands both distinct BOINC/Folding@home lanes, source approval, participant proof, accepted work-unit receipts, canonical attestation, one-time consumption, governed/treasury authority, funded Wallet/Indexer/420Compute reconciliation, independent operator and reviewer, adversarial evidence, finality and exact release references.
- IMPORTANT: manifest values are untrusted assertions until provider/operator/RPC evidence and signatures are independently verified. A passing fixture test establishes only local gate logic.
- No network endpoints were contacted, no native funds transferred and no live source approved.
- Deferred canonical requirements: live source acceptance, two authenticated provider identities, authorized attester/reward policy, real funded testnet payout, durable deployed Indexer and Wallet reconciliation, finalized receipt hashes, adversarial/reorg drills, operator and independent review signoff.
- Level 2: requires real testnet milestone; **not run or claimed**. Level 3: phase closeout deferred; no full Foundry/Genesis duplicate run.
- Next canonical step after S-09 closes: **S-10 — Operational soak, CMP-9 and CMP-10 handoff**.

This document is evidence-only relative to the source implementation SHA and may be updated after run conclusion.
