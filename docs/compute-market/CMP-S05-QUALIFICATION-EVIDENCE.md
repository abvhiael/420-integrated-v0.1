# S-05 — Canonical record binding and cross-provider deduplication

**Status: OFFLINE IMPLEMENTATION LEVEL 1 QUALIFIED; CANONICAL LIVE EXIT GATES DEFERRED TO TESTNET.**

- Step S-05; Level 1; implementation SHA `d4ed86f9bcd0ebd40220f0cfe03842f434d29ba7`.
- Stacked audit branch `cmp-s05-canonical-dedup-20261008`, PR #578 on S-04 PR #577 (S-03 #576, S-02 #575, S-01 #574).
- Main initial reconciliation baseline: `04b9f63775754c96cb73d38cccd02e2fc682cbd9`; inherited S-04 evidence parent `6b4fb257f89e5b8bcbf3b30d2f935fb3490fa8b9`.
- Files: `compute/ingestion/src/binding.mjs`, `compute/ingestion/test/binding.test.mjs`, `compute/ingestion/package.json`, `.github/workflows/cmp-s05-binding.yml`, `docs/compute-market/CMP-S05-CANONICAL-BINDING.md`.
- Required exact-SHA [CMP S-05 Canonical Binding run 37845294451](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37845294451) SUCCESS, job `113544544058` SUCCESS. Node 22 targeted `npm run qualify` includes retained S-02–S-04 regressions and S-05 tests.
- Positive checks: governing CMP-5.7 canonical mappings are inputs; permitted chain-scoped idempotent same-work observation; historical trace; consumed state inspection remains read-only.
- Negative checks: unverified identity/source, wrong chain, unsupported provider, revoked or mismatched attester record, consumed claim, unavailable guard state, incompatible wrappers, mutated credits and names not used to create a second entitlement. Read model always rewardEligible:false.
- Canonical interfaces: CMP-5.1/5.2 normalization, CMP-5.5 proof/credit source binding, CMP-5.7 attested canonical-work mapping, CMP-5.6 authorized one-time guard. No source-local SHA digest is asserted equal to Solidity keccak ABI commitment. Actual contract events/tx/proof remain untested.
- **Live blockers intentionally moved to testnet:** actual provider-authorized evidence, known matching cross-provider work identity, deployed CMP-5.5–5.7 addresses/attesters, CMP-5.6 authorized consumer consumption, Indexer reorg/backfill/dispute/correction durability and wallet-linked contributor identity; in-memory trace cannot qualify cross-process rebuild.
- Level 2: S-06 actual app/Indexer convergence; Level 3: one accumulated closeout. No broad Foundry/Genesis/Geth/Docs inventory rerun on S-05.
- Next canonical step: S-06 — Read model, app, and Level 2 evidence-ingestion milestone.

Evidence-only qualification closeout inherits exact implementation SHA and does not represent real-work settlement.
