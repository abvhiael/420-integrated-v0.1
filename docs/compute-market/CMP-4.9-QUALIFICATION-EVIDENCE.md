# CMP-4.9 — Research dashboard qualification evidence

Status: **COMPLETE**

## Roadmap step

- Step: **CMP-4.9 — Research dashboard**
- Qualification level: **Level 1 + second CMP-4 Level 2 integration milestone**
- Previous CMP-4 Level 2 milestone: **CMP-4.6 — Result provenance**
- Level 3: deferred exclusively to **CMP-4.10 — Phase closeout**

## Qualified implementation

- Exact implementation SHA: `12186148274f643dfe4b1d07b194d3fffd3aa23b`
- Audit branch: `cmp-4.1-scientific-work-unit-20261005`
- Pull request: **#527 — CMP-4 scientific compute framework**
- Current `main` at evidence closeout: `23ebff000a471bfbc4439894f797f3b17a530867`
- Current-main reconciliation remains intentionally deferred to CMP-4.10, where the single comprehensive Level 3 merge-candidate qualification is required.

## Implementation summary

CMP-4.9 adds `ComputeResearchDashboard420`, a versioned, read-only canonical consumer surface over the scientific framework accumulated through CMP-4.2, CMP-4.6, CMP-4.7 and CMP-4.8.

The dashboard composes:

- exact current and historical CMP-4.2 research-project state;
- canonical CMP-4.6 scientific result provenance and canonical result-source state;
- CMP-4.7 scientific metadata and lineage;
- CMP-4.8 publication / retention policy;
- reconstruction of the exact CMP-4.1 scientific work-unit commitment from canonical/frozen witnesses.

The dashboard owns no mutable scientific authority. It does not create project, job, dataset, result, verification, publication, settlement, reward, slash, governance, storage, indexer or UI authority.

## Files implemented / updated

- `contracts/src/compute/ComputeResearchDashboard420.sol`
- `contracts/test/ComputeResearchDashboard420.t.sol`
- `contracts/config/compute-market/cmp-4.9-research-dashboard.json`
- `docs/compute-market/CMP-4.9-RESEARCH-DASHBOARD.md`
- `scripts/verify-cmp-4-9-research-dashboard.py`
- `.github/workflows/compute-market.yml`
- canonical post-CMP1 roadmap and CMP-4.8 handoff material

## Exit-criterion disposition

1. dashboard construction binds one exact compatible project/provenance/result-source/lineage/publication graph — **PASS**
2. project views resolve current and exact historical CMP-4.2 revisions without parallel project state — **PASS**
3. result views reconstruct the exact CMP-4.1 scientific work-unit commitment and cross-check CMP-4.6/CMP-4.7 bindings — **PASS**
4. canonical result-source attempt/result/evidence/output/verifier fields must agree with provenance — **PASS**
5. canonical verification must already exist before a scientific result view is accepted — **PASS**
6. noncanonical CMP-4.6 provenance or CMP-4.7 lineage fails closed — **PASS**
7. CMP-4.8 missing/stale/noncurrent policy is represented explicitly and never promoted to publication authorization — **PASS**
8. direct parent lineage is exposed only for canonical lineage records — **PASS**
9. zero, altered, cross-wired or mismatched query/component witnesses fail closed — **PASS**
10. raw scientific bytes, credentials and private evidence remain off-chain and unsurfaced — **PASS**
11. dashboard remains read-only and creates no correctness, economic, access, governance, storage or UI authority — **PASS**
12. dedicated tests, retained Compute integration suite and mechanical verifiers pass the same exact SHA — **PASS**

## Exact-head Level 1 + Level 2 qualification

Required owner: **Compute Market Qualification**

- Workflow: **Compute Market Qualification #427**
- Run ID: `37501862650`
- Job ID: `112401251296`
- Exact SHA: `12186148274f643dfe4b1d07b194d3fffd3aa23b`
- Result: **SUCCESS**

Passing decisive steps:

- checkout exact qualification head — PASS
- verify exact qualification head — PASS
- build Compute Market contracts — PASS
- retained Compute Market Solidity suite — PASS
- compile Compute Market verification scripts — PASS
- CMP-4.1 scientific work-unit verifier — PASS
- CMP-4.1 scientific work-unit boundary test — PASS
- CMP-4.2 Research Project Registry verifier — PASS
- CMP-4.3 researcher / institution identity verifier — PASS
- CMP-4.4 dataset-manifest verifier — PASS
- CMP-4.5 reproducible-execution-environment verifier — PASS
- CMP-4.6 result-provenance verifier — PASS
- CMP-4.7 scientific metadata/lineage verifier — PASS
- CMP-4.8 publication/retention verifier — PASS
- CMP-4.9 research-dashboard verifier — PASS

The retained full `Compute*.t.sol` suite is the app-focused Level 2 integration gate, consistent with the first CMP-4 Level 2 milestone at CMP-4.6. No redundant second workflow is required.

## Supporting exact-head workflow evidence

The same exact SHA also completed successfully in:

- Solidity Contracts **#5095** / run `37501862474` — SUCCESS
- 420Registry REG-AUDIT-4 **#1817** / run `37501862618` — SUCCESS
- 420Docs Qualification **#6031** / run `37501862635` — SUCCESS
- Genesis Address Authority **#2004** / run `37501862263` — SUCCESS
- 420Indexer **#2441** / run `37501862339` — SUCCESS
- Compute Worker Fast Qualification **#426** / run `37501862458` — SUCCESS
- 420Oracle audit qualification **#1370** / run `37501862528` — SUCCESS

These are supporting exact-head evidence and are not promoted into additional CMP-4.9 qualification requirements.

## Security / adversarial / invariant results

CMP-4.9 qualification proves the dashboard fails closed for incompatible component graphs, wrong project revision/commitment, altered scientific witnesses, result/evidence/output/verifier mismatches, absent canonical verification, noncanonical provenance and noncanonical lineage.

Missing or stale publication policy remains explicitly non-authorizing. The dashboard does not mutate canonical scientific state, disclose raw research data, replace verifier decisions, or create settlement/reward/slash/governance authority.

No test, assertion, authorization rule, safety boundary or semantic requirement was weakened to obtain qualification.

## Milestone status

CMP-4.9 is the **second CMP-4 Level 2 integration milestone**.

This milestone is appropriate because the accumulated scientific graph converges into one canonical consumer/read-model surface: project identity, scientific result provenance, metadata/lineage and publication/retention policy are jointly validated and exposed without creating parallel authority.

The retained full Compute Market Solidity suite passed on the same exact implementation SHA.

## Intentionally deferred

- comprehensive reconciliation with current `main` — CMP-4.10;
- the single CMP-4 Level 3 comprehensive qualification — CMP-4.10;
- exhaustive project/result enumeration and indexed search — CMP-7;
- human-facing 420Compute UI — CMP-8;
- public/testnet scientific workload and live-data demonstration — CMP-9.

## Limitations

CMP-4.9 is a canonical read model. It does not itself:

- enumerate all projects/results on chain;
- provide a human-facing web application;
- store or retrieve raw scientific bytes;
- prove scientific truth;
- grant dataset/result access;
- revise publication or retention policy;
- create payment, reward or slash entitlement;
- make any live/testnet deployment claim.

## Blockers

**No repository blocker remains for CMP-4.9 itself.**

Current-main reconciliation is intentionally deferred to **CMP-4.10**, where the complete accumulated CMP-4 branch must be reconciled and qualified once as the Level 3 phase closeout candidate.

## Evidence-only closeout rule

This closeout changes documentation/evidence only. It changes no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements.

It therefore inherits the already-qualified exact implementation SHA without recursive qualification.

## Formal status

**CMP-4.9 — Research dashboard: COMPLETE.**

Next canonical step: **CMP-4.10 — Phase closeout**.
