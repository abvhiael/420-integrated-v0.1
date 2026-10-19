# ARC-0.6 — Exact-SHA Level 1 qualification certificate

**Step:** ARC-0.6 — Define project structure, module boundaries, dependencies and versioning rules  
**Level:** 1 — scoped requirements/architecture definition  
**Disposition:** PASS — all scoped module graph, versioning and negative-case checks successfully qualified. Actual game code and runtime packages are not yet implemented.

- **Qualified implementation SHA:** `ac610f6ad7fcfb6d180597d22c12d3ba7c73735e`
- **Reconciliation base:** `177ad9deb7ba3c616952665b8d1e7845bef8dfd1`
- **PR:** [#744](https://github.com/abvhiael/420-integrated-v0.1/pull/744)
- **Branch:** `audit/arcade-0-6-modules-dependencies-versioning-20261018`
- **Workflow:** `.github/workflows/arcade-0-6-level1.yml`
- **Successful workflow run:** [39192521696](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39192521696)
- **Successful job:** `117868221730` — completed/success.
- **Failed intermediate workflow:** [39192454659](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39192454659), job `117868014568`: failed deterministic verifier expected-order fixture mismatch. Corrected in `ac610f6ad7fcfb6d180597d22c12d3ba7c73735e`; its failed conclusion is preserved, not disguised as PASS.

## Tested contract

Eight architecture modules, unimplemented-status integrity, canonical eleven game bundles, module paths and ownership, deterministic acyclic dependencies, no cross-game/privileged authority, optional existing Gaming SDK dependency, content/ruleset/schema/assets/api versioning, frozen platform requirements and 24 adversarial/negative mutations.

**Other qualified work:** ARC-0.1 through ARC-0.5 implementation evidence and workflows remain unchanged. No Level 2 or Level 3 milestone was triggered. No global Solidity/Genesis/Integrated/Docs/Geth tests were manually launched.

**Main reconciliation:** main advanced after original base through Budtender character asset commits only; these do not modify Arcade policy, module graph, Gaming SDK or approved identities. Compare and verify GitHub merge eligibility again immediately before merge.

**External/testnet:** canonical Registry registration, deployed operators and GP-17.9 live testnet acceptance remain external. Actual browser/game module implementations, dependency lockfiles and client builds are later ARC implementation tasks, not falsely qualified here.

**Evidence-only SHA:** the commit adding this certificate is not the successful implementation SHA. Do not rerun the scoped suite solely for this evidence commit.
