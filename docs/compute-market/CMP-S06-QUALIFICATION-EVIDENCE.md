# S-06 — Read model, app, and Level 2 evidence-ingestion qualification

**Status: REPOSITORY LEVEL 2 PASS; CANONICAL LIVE-SOURCE/INDEXER EXIT NOT COMPLETE.**
- Roadmap step: S-06 — Read model, app, and Level 2 evidence-ingestion milestone.
- Exact implementation SHA: `0e10c346bd10eb908f6b4ab0be9c7f26a26d65c1`.
- Branch: `cmp-s06-science-readmodel-20261008`; PR #579 stacked on S-05 #578, S-04 #577, S-03 #576, S-02 #575 and S-01 #574.
- Inherited parent: `89979790d536a7a643e82c4f3df143f039069ac1`; main baseline observed `04b9f63775754c96cb73d38cccd02e2fc682cbd9`.
- Changed files: isolated science read model and tests, 420Compute browser panel/validation tests and static build wiring, scoped Level-2 CI, explanatory docs.
- Required [CMP S-06 Science Read Model run 37845705853](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37845705853) **SUCCESS** on exact SHA, job `113545914341` **SUCCESS**, retained ingestion S-02–S-05 tests and full 420Compute web build/check/tests together. Superseded first run `37845631820` FAILED on prior SHA due to literal escaped newline in browser import; fixed on present exact SHA.
- Affected canonical [420Compute App Qualification run 37845705878](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37845705878): separate workflow; verify conclusion before treating it as additional passing evidence.
- Negative coverage: wrong chain, forged authority, malformed records, conflicting observation, excessive page bounds, stale/unfinalized states, revoked source, canonical rollback, nonmonetary credit units, indexer/browser schema rejection and UI non-entitlement labels.
- Security: `amount420:null`, `rewardEligible:false`, `authoritative:false` enforced; no source credential/workload/result payload publication, no browser signing of external rewards.
- Level 2 scope: integrated off-chain ingestion/attestation/claim projection simulation and browser consumption; not operational end-to-end provider-to-indexer chain evidence.
- Remaining testnet gates: provider-authorized live read-only observations, S-02 DNS-pinned networking, source-specific work-unit proof, wallet identity proof, durable/indexed record ingestion, live canonical attestation and claim events, endpoint `/v1/compute/external-science` actually implemented and deployed in 420Indexer, replay/reorg recovery, runtime wallet/indexer bindings and public production privacy/source permissions.
- Level 3: deferred to accumulated audit phase closeout; no redundant Foundry/Genesis/global inventories were ordered.
- Next canonical step: **S-07 — Economic eligibility and policy approval**.

Evidence-only closeout does not change qualified runtime, tests or interfaces.
