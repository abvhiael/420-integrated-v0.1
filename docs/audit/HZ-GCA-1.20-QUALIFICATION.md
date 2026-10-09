# HZ-GCA-1.20 — HZ-GCA-1 Level-2 milestone qualification evidence

Status: **COMPLETE — Level 2**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Work package: **HZ-GCA-1.20 — HZ-GCA-1 Level-2 milestone qualification**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` at qualification: `0993ff5b5b3b213a0768dbde90e4734df5ab4cc0`
- Final main-reconciliation commit: `2c9e626dea96706391536a4950245575c4b40f32`
- Qualified implementation SHA: `b8974c2aa68b7b0c027ce0cc7dc4784ca5ad02c1`
- Qualification level: **Level 2 — app integration milestone**
- Level 3: **DEFERRED to HZ-GCA-17**

## Current-main reconciliation

HZ-GCA-1.20 required qualification on a branch reconciled with current `main`.

The milestone initially reconciled CMP-7 shared Compute SDK/API/Indexer work, then `main` advanced again through RR-11.

Final main at qualification:

`0993ff5b5b3b213a0768dbde90e4734df5ab4cc0`

The branch was rebuilt as a true combined tree that:

- preserved current-main RR-11 ReeferReview state;
- preserved current-main CMP-7 SDK/API/Indexer state;
- retained only the intended HZ-GCA roadmap/architecture/config/verifier/workflow changes from the feature branch;
- removed the accidental effect of historical branch divergence that had made unrelated ReeferReview paths appear deleted.

The final reconciliation commit has both the HZ-GCA branch and current main as parents:

`2c9e626dea96706391536a4950245575c4b40f32`

After reconciliation PR #565 was mergeable.

## Milestone implementation

Added/qualified:

- `hz/config/gca-level2-milestone-v1.json`
- `docs/architecture/420hz/HZ-GCA-1.20-LEVEL2-MILESTONE.md`
- `scripts/verify-420hz-gca-1-20.py`
- conditional `HZ-GCA Level 2` job in `.github/workflows/420hz-gca.yml`

The Level-2 job retains the complete HZ-GCA-1 architecture suite and directly affected shared integration tests without invoking Level-3 repository-global work.

## Required retained Level-2 suite

The exact-head milestone run required and passed:

1. exact qualification-head verification;
2. current-main ancestry verification;
3. all GCA JSON manifest validation;
4. HZ-GCA-1.1 through HZ-GCA-1.19 verifiers;
5. HZ-GCA-1.20 milestone integration verifier;
6. retained 420Hz web verifier;
7. 420AI Compute integration verifier;
8. 420AI provider runtime tests;
9. 420AI provider runtime boundary verifier;
10. reconciled Compute SDK retained test suite;
11. reconciled Compute SDK build;
12. reconciled Compute API retained test suite;
13. reconciled 420Indexer retained test suite with live PostgreSQL integration.

## PostgreSQL skip repair

An earlier Level-2 run on SHA:

`2c980180d1077475c7245c8de6cd989a68d66226`

completed successfully at the job level but the retained 420Indexer suite reported one environment-gated skipped test:

`query service executes keyset pages and routed lookups against PostgreSQL`

That did **not** satisfy the user's milestone rule that missing/skipped required checks are not green.

The milestone workflow was repaired narrowly by:

- adding a PostgreSQL 16 service matching the canonical 420Indexer workflow;
- setting `INDEXER_PG_URL=postgresql://postgres:postgres@localhost:5432/indexer420` for the retained Indexer suite;
- changing Level-2 milestone detection from “manifest changed in this exact commit” to “milestone manifest exists”, so final reconciliation/evidence-preparation commits still execute the required Level-2 job.

No test assertion or application behavior was weakened.

In the final qualified run, all retained suite summaries reported:

`# skipped 0`

## Exact-head Level-2 qualification

Workflow:

**420Hz GCA Qualification**

Successful exact-head run:

- Run ID: **37803965886**
- Run number: **#261**
- Job: **HZ-GCA Level 2**
- Job ID: **113403242290**
- Exact tested SHA: `b8974c2aa68b7b0c027ce0cc7dc4784ca5ad02c1`
- Result: **PASS**

Every required Level-2 step completed successfully, including:

- PostgreSQL container initialization;
- exact SHA verification;
- reconciled-main ancestry verification;
- complete retained HZ-GCA verifier inventory;
- HZ-GCA-1.20 integration verifier;
- 420Hz web;
- 420AI/Compute integration;
- provider runtime/boundary checks;
- Compute SDK/API;
- 420Indexer with PostgreSQL integration.

No required Level-2 check was skipped, cancelled or missing.

## Exact-head Level-1 retained qualification

The same workflow/run also retained the ordinary architecture suite in:

- Job: **HZ-GCA Level 1**
- Job ID: **113403242346**
- Exact tested SHA: `b8974c2aa68b7b0c027ce0cc7dc4784ca5ad02c1`
- Result: **PASS**

HZ-GCA-1.1 through HZ-GCA-1.19 all passed on the same implementation SHA.

## Directly relevant collateral qualification

The same exact implementation SHA also passed:

- **420Hz Web Qualification #159**
- **420Docs Qualification #7406**

These are directly useful collateral checks for the retained web/documentation surfaces but do not substitute for the required HZ-GCA Level-2 job.

Other unrelated automatically triggered workflows are not HZ-GCA-1.20 gates.

## Integration assertions qualified

The Level-2 milestone proves that the accumulated architecture still preserves:

- one canonical owner per authority domain;
- zero unresolved authority duplication;
- Generate lifecycle/disclosure/provenance/rights/privacy/storage/economic consistency;
- Community source relations separate from Charts derived ranking and Awards voting/results;
- RAW_PLAY separate from QUALIFIED_PLAY;
- AwardVote separate from Chart/Community/Civic voting;
- Wallet-account voting separate from unique-human claims;
- minimum-disclosure, replay-safe unique-human eligibility;
- application-scoped moderation;
- optional/explicit, remedy-bounded Arbitration;
- actor/domain/resource/idempotency-bound mutations;
- derived read non-authority;
- canonical-first timeout/retry/restart recovery;
- privacy non-widening through dependency failure/recovery;
- reconciled CMP-7 unsigned Wallet-authorization and `authoritative:false` projection boundaries.

## Level-3 exclusions respected

HZ-GCA-1.20 did **not** run:

- canonical full Solidity inventory;
- Genesis/address-authority full qualification;
- 420 Integrated/global qualification;
- Geth/global fault/soak qualification;
- unrelated app audits;
- production deployment/config closeout.

Those remain later Level-3 responsibilities.

## Blockers

None.

## Completion state

**HZ-GCA-1.20 — COMPLETE (Level 2).**

**HZ-GCA-1 — COMPLETE at Level 2.**

Next canonical roadmap step:

**HZ-GCA-2 — Generation job and provider abstraction**
