# CMP-5.1 — Qualification Evidence

Status: **COMPLETE — Level 1 exact-head qualified.**

## Qualification identity

- Roadmap step: **CMP-5.1 — Folding@home adapter**
- Qualification level: **Level 1**
- Exact implementation SHA: `aa8ebaeb243946b679766fb6d023f39acec42dc2`
- Reconciliation/base `main` SHA: `721a7f358e802bce91835851721eb93c4340f501`
- Branch: `cmp-5.1-folding-at-home-adapter-20261006`
- PR: **#539**
- Branch disposition at qualification: **0 commits behind main**
- Level 2: **not required at CMP-5.1**
- Level 3: **deferred to CMP-5.8 — Phase closeout**

## Implementation qualified

The exact implementation SHA adds the first CMP-5 external distributed-compute adapter:

- `contracts/src/compute/ComputeFoldingAtHomeAdapter420.sol`
- `contracts/test/ComputeFoldingAtHomeAdapter420.t.sol`
- `contracts/config/compute-market/cmp-5.1-folding-at-home-adapter.json`
- `docs/compute-market/CMP-5.1-FOLDING-AT-HOME-ADAPTER.md`
- `scripts/verify-cmp-5-1-folding-at-home-adapter.py`
- targeted Compute Market fast-workflow ownership;
- canonical roadmap status/integration notes.

The adapter deterministically normalizes externally supplied Folding@home contribution material into a stable contribution identity and a complete normalized-record commitment. It is pure/stateless and deliberately does not become an external truth oracle, verifier, reward authority, Vault/settlement authority, stake/slash authority, or duplicate-reward authority.

## Exit criteria disposition

1. Stable versioned Folding@home protocol commitment — **PASS**.
2. Domain-separated contribution identity binds project, work unit, donor and assignment — **PASS**.
3. Full record binds result, optional team, credit, timestamps and evidence — **PASS**.
4. Zero/malformed required fields fail closed — **PASS**.
5. Completion-before-assignment and zero-credit records fail closed — **PASS**.
6. Optional team identity does not weaken the rest of the record — **PASS**.
7. Adapter is stateless and has no Compute lifecycle/economic authority — **PASS**.
8. External truth attestation remains deferred to CMP-5.7 — **PASS**.
9. Double-reward prevention remains deferred to CMP-5.6 — **PASS**.
10. Dedicated tests, verifier and exact-head app-specific qualification pass — **PASS**.

## Exact-head CI evidence

### Compute Market Qualification #443

- Run: `37515056292`
- Job: `112445946047`
- Exact-head checkout/verification — **PASS**
- Build Compute Market contracts — **PASS**
- Retained `Compute*.t.sol` Solidity suite — **PASS**
- Compile Compute Market verification scripts — **PASS**
- Retained Compute verifier chain — **PASS**
- `Verify CMP-5.1 Folding@home adapter` — **PASS**
- Final result — **SUCCESS**

### Solidity Contracts #5159 classification

The shared Solidity workflow classified the change as Compute-only:

- full monolithic Foundry job — **SKIPPED as expected**
- full repository PR shards — **SKIPPED as expected**
- Compute fast path selected and exact-head verification/build passed before its retained suite continued.

CMP-5.1 does not require a repository-wide Solidity inventory. The canonical app-specific Compute Market workflow above is the authoritative Level 1 completion evidence, consistent with the phase qualification policy.

## Security / adversarial disposition

Dedicated tests and the mechanical verifier cover:

- project/work-unit/donor/assignment substitution;
- result/team/credit/time/evidence substitution;
- zero required commitments;
- invalid time ordering;
- zero credited points;
- deterministic normalization;
- optional team identity;
- forbidden authority surfaces for verification, settlement, Vault custody, rewards, stake/slash and worker assignment.

The adapter produces **normalization evidence only**. It does not prove that Folding@home accepted, credited or scientifically validated a contribution.

## Intentionally deferred

- CMP-5.2 — BOINC adapter;
- CMP-5.3 — Research-cluster adapter;
- CMP-5.4 — University/HPC gateway;
- CMP-5.5 — External proof/credit adapters;
- CMP-5.6 — Double-reward prevention;
- CMP-5.7 — External-result attestation;
- CMP-5.8 — Level 3 phase closeout;
- CMP-6 useful-computation reward economics;
- live Folding@home service/API integration and any external administrative permission/approval.

These are not CMP-5.1 Level 1 blockers.

## Completion

**CMP-5.1 is repository COMPLETE at Level 1 on exact implementation SHA `aa8ebaeb243946b679766fb6d023f39acec42dc2`.**

This evidence document is an evidence-only follow-up and does not redefine the qualified implementation SHA.

## Next canonical step

**CMP-5.2 — BOINC adapter**
