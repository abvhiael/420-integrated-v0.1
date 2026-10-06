# CMP-5.2 — Qualification Evidence

Status: **COMPLETE — Level 1 + first CMP-5 Level 2 exact-head qualified.**

## Qualification identity

- Roadmap step: **CMP-5.2 — BOINC adapter**
- Qualification level: **Level 1 + first CMP-5 Level 2 integration milestone**
- Exact implementation SHA: `f463deb41f5e9de396a81d5ffbe0fc205c72f5a0`
- Base/main SHA: `721a7f358e802bce91835851721eb93c4340f501`
- Branch: `cmp-5.1-folding-at-home-adapter-20261006`
- PR: **#539**
- Branch disposition at qualification: **0 commits behind main**
- Level 3: **deferred to CMP-5.8 — Phase closeout**

## Implementation qualified

The exact SHA introduces the second CMP-5 external-compute family and the first shared adapter convergence surface:

- `contracts/src/compute/IComputeExternalContributionAdapter420.sol`
- `contracts/src/compute/ComputeBoincAdapter420.sol`
- reconciled `ComputeFoldingAtHomeAdapter420` implementation of the common identity interface;
- `contracts/test/ComputeBoincAdapter420.t.sol`
- `contracts/test/ComputeExternalContributionAdapters420.t.sol`
- `contracts/config/compute-market/cmp-5.2-boinc-adapter.json`
- `docs/compute-market/CMP-5.2-BOINC-ADAPTER.md`
- `scripts/verify-cmp-5-2-boinc-adapter.py`
- Compute Market workflow ownership and roadmap reconciliation.

## Exit criteria disposition

1. Stable BOINC adapter/system/protocol identities — **PASS**.
2. Contribution identity binds project, work unit, participant, optional host and assignment — **PASS**.
3. Full normalized record binds application, result, timing, credit and evidence — **PASS**.
4. Missing required bindings and impossible time ordering fail closed — **PASS**.
5. Optional host and zero-credit records normalize without implying reward eligibility — **PASS**.
6. BOINC and Folding-at-home expose the common provider-neutral identity interface — **PASS**.
7. Adapter/system/protocol domains remain distinct across families — **PASS**.
8. No verification/reward/settlement/stake/slash/duplicate-prevention authority is introduced — **PASS**.
9. CMP-5.6 and CMP-5.7 remain authoritative future owners of duplicate prevention and external truth — **PASS**.
10. Dedicated tests, integration tests, verifier and retained app qualification pass exact head — **PASS**.

## Exact-head CI evidence

### Compute Market Qualification #446

- Run: `37518847675`
- Job: `112459253007`
- Exact-head checkout/verification — **PASS**
- Build Compute Market contracts — **PASS**
- Retained `Compute*.t.sol` Solidity suite — **PASS**
- Verification-script compilation — **PASS**
- Retained verifier chain — **PASS**
- CMP-5.1 Folding@home verifier — **PASS**
- CMP-5.2 BOINC verifier — **PASS**
- Final result — **SUCCESS**

This retained suite is the app-focused Level 2 integration gate for the first CMP-5 adapter-family convergence milestone.

### Solidity Contracts #5173

- Run: `37518847861`
- Compute-fast job: `112459015467` — **SUCCESS**
- Exact-head verification — **PASS**
- Compute Market build — **PASS**
- Retained Compute Solidity suite — **PASS**
- Full repository Foundry job — **SKIPPED as expected**
- Full repository PR shards — **SKIPPED as expected**

CMP-5.2 does not require Level 3 repository-wide Solidity qualification.

## Supporting exact-head workflows

- Genesis Address Authority #2135 / run `37518847628` — **SUCCESS**
- 420Docs Qualification #6265 / run `37518847521` — **SUCCESS**
- Compute Worker Fast Qualification #452 / run `37518847855` — **SUCCESS**
- 420Indexer #2462 / run `37518847668` — **SUCCESS**
- 420Oracle audit qualification #1603 / run `37518847657` — **SUCCESS**
- 420Registry REG-AUDIT-4 #1945 / run `37518847580` — **SUCCESS**

These supporting workflows are recorded as observed exact-head evidence; they do not convert CMP-5.2 into a Level 3 closeout.

## Security / adversarial disposition

Dedicated and cross-adapter tests cover:

- project/work-unit/participant/host/assignment substitution;
- application/result/deadline/report-time/credit/evidence substitution;
- required zero bindings;
- invalid issue/deadline/report ordering;
- optional host identity;
- zero-credit normalization without reward authority;
- cross-family adapter-kind/system/protocol collision prevention;
- retention of CMP-5.1 commitment semantics under the shared identity interface;
- forbidden economic, verification and stake/slash authority surfaces.

## Intentionally deferred

- CMP-5.3 — Research-cluster adapter;
- CMP-5.4 — University/HPC gateway;
- CMP-5.5 — External proof/credit adapters;
- CMP-5.6 — Double-reward prevention;
- CMP-5.7 — External-result attestation;
- CMP-5.8 — Level 3 phase closeout;
- CMP-6 useful-computation reward economics;
- live BOINC project API/RPC integration and project-specific administrative approval.

## Completion

**CMP-5.2 is repository COMPLETE at Level 1 + the first CMP-5 Level 2 integration milestone on exact implementation SHA `f463deb41f5e9de396a81d5ffbe0fc205c72f5a0`.**

This evidence-only follow-up does not redefine the qualified implementation SHA.

## Next canonical step

**CMP-5.3 — Research-cluster adapter**
