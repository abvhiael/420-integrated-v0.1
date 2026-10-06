# CMP-4.6 — Result provenance qualification evidence

Status: **COMPLETE**

## Roadmap step

- Step: **CMP-4.6 — Result provenance**
- Qualification level: **Level 1 + first CMP-4 Level 2 integration milestone**
- Level 3: deferred to **CMP-4.10 — Phase closeout**

## Qualified implementation / closeout candidate

- Exact implementation/closeout SHA: `01824d6488a14d74d86ea6f1c6c8a4ecbd45d878`
- Audit branch: `cmp-4.1-scientific-work-unit-20261005`
- Pull request: **#527 — CMP-4 scientific compute framework**
- Qualification base/main SHA at run time: `f32a9c322e085634e47f20b84861338811198454`
- Current `main` at evidence-only closeout time: `f5fe16414893a1e4bd4f3db22eb36b685a2030f5`
- The later `main` movement is not represented as requalified or reconciled here; CMP-4.10 Level 3 owns accumulated current-main reconciliation.

## Implementation summary

CMP-4.6 adds canonical scientific result provenance without creating a second result, verifier, correctness, settlement, or reward authority.

`ComputeScientificResultSource420` is a read-only adapter over existing canonical Compute state:

- `ComputeJobRegistry420` for job/result/verification commitments and references;
- `ComputeJobWorkerSnapshotEvidence420.verdictContext` for the exact result-bearing attempt, worker, canonical result commitment, and receipt-bound execution evidence.

`ComputeScientificResultProvenance420` reconstructs the exact CMP-4.1 `ScientificWorkUnitV1` commitment from canonical/frozen inputs and records immutable provenance only when the canonical worker result and canonical verification decision are already present.

The provenance identity binds chain, registry/source, job/unit, scientific work-unit commitment, result-bearing attempt, worker, canonical result commitment, receipt/execution evidence, verifier, verification decision reference, and output schema.

## Files implemented / updated

- `contracts/src/compute/ComputeScientificResultProvenance420.sol`
- `contracts/test/ComputeScientificResultProvenance420.t.sol`
- `contracts/config/compute-market/cmp-4.6-result-provenance.json`
- `docs/compute-market/CMP-4.6-RESULT-PROVENANCE.md`
- `scripts/verify-cmp-4-6-result-provenance.py`
- `.github/workflows/compute-market.yml`
- `docs/compute-market/CMP-4.1-SCIENTIFIC-WORK-UNIT-SPECIFICATION.md`
- `docs/compute-market/CMP-4.5-REPRODUCIBLE-EXECUTION-ENVIRONMENTS.md`
- `contracts/config/compute-market/cmp-4.5-execution-environments.json`
- canonical post-CMP1 roadmap

## Exit-criterion disposition

1. canonical source adapter binds JobRegistry result state to worker `verdictContext` — **PASS**
2. CMP-4.1 scientific work-unit commitment is reconstructed from canonical/frozen inputs — **PASS**
3. result-bearing attempt, worker, result and receipt-bound execution evidence are immutable provenance inputs — **PASS**
4. nonzero canonical verifier and verification decision are required before recording — **PASS**
5. provenance identity is domain/chain/registry/source/job/unit bound — **PASS**
6. byte-identical duplicate provenance is idempotent and conflicting provenance fails closed — **PASS**
7. cross-unit scientific commitment replay and altered binding fail closed — **PASS**
8. canonical source drift makes `isCanonical` fail closed — **PASS**
9. raw outputs/receipts/private evidence remain off-chain — **PASS**
10. provenance creates no correctness/access/economic/governance authority — **PASS**
11. dedicated tests and mechanical verifier are committed — **PASS**
12. Level 1 plus retained Compute Market Level 2 integration pass the exact implementation SHA — **PASS**

## Exact-head Level 1 + Level 2 qualification

Required owner: **Compute Market Qualification**

- Workflow: **Compute Market Qualification #418**
- Run ID: `37418605649`
- Job ID: `112122702586`
- Exact SHA: `01824d6488a14d74d86ea6f1c6c8a4ecbd45d878`
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

The retained `Compute*.t.sol` suite serves as the app-focused Level 2 integration gate for this first CMP-4 convergence milestone.

## Supporting exact-head workflow evidence

The same exact SHA also completed successfully in:

- Solidity Contracts **#5044** — SUCCESS
- Genesis Address Authority **#1889** — SUCCESS
- 420Docs Qualification **#5842** — SUCCESS
- Compute Worker Fast Qualification **#411** — SUCCESS
- 420Indexer **#2426** — SUCCESS
- 420Oracle audit qualification **#1183** — SUCCESS
- 420Registry REG-AUDIT-4 **#1709** — SUCCESS

These are supporting monorepo evidence. They are not promoted into additional CMP-4.6 Level 1/Level 2 requirements.

## Security / adversarial / invariant results

CMP-4.6 qualification proves:

- zero or malformed scientific bindings fail closed;
- unverified results cannot be recorded as scientific provenance;
- altered or cross-unit scientific-work-unit commitments fail closed;
- canonical result/worker/attempt/receipt-evidence and verifier decision are bound into provenance identity;
- duplicate identical provenance is idempotent;
- canonical source drift causes `isCanonical` to fail closed;
- provenance registration creates no correctness, settlement, reward, slash, dataset-access, governance, or worker-selection authority;
- raw outputs, receipts, secrets, credentials and private evidence are not placed into canonical provenance state.

No test, assertion, authorization boundary, or safety condition was weakened to obtain qualification.

## Milestone status

CMP-4.6 is the **first CMP-4 Level 2 integration milestone**.

This milestone is appropriate because CMP-4.1 scientific-unit semantics, CMP-4.2 project identity, CMP-4.4 dataset commitment, CMP-4.5 execution-environment commitment, canonical worker result/receipt evidence, and canonical verifier decision converge here for the first time.

The retained full Compute Market Solidity suite passed on the same exact implementation SHA.

## Intentionally deferred

- CMP-4.7 scientific metadata and lineage;
- CMP-4.8 publication / retention policy;
- CMP-4.9 research dashboard;
- CMP-4.10 comprehensive Level 3 scientific-framework closeout;
- CMP-7 SDK/API/indexer expansion;
- CMP-8 Compute UI;
- CMP-9.13 live scientific workload demonstration.

## Limitations

CMP-4.6 records provenance for already-canonical result and verification state. It does not itself:

- prove scientific truth;
- re-run or replace verifier logic;
- publish raw result bytes or receipts;
- grant dataset access;
- define retention/publication policy;
- create payment/reward/slash entitlement;
- perform live/testnet deployment.

Those boundaries remain owned by their canonical phases.

## Blockers

**No repository blocker remains for CMP-4.6 itself.**

Current-main reconciliation after the qualified SHA is intentionally deferred to the accumulated CMP-4 phase closeout rather than creating redundant ordinary-step qualification.

## Evidence-only closeout rule

This closeout commit changes documentation/evidence only. It changes no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state, or substantive requirements.

Per the phase qualification policy, it therefore inherits the already-qualified exact implementation SHA without recursive qualification.

## Formal status

**CMP-4.6 — Result provenance: COMPLETE.**

Next canonical step: **CMP-4.7 — Scientific metadata and lineage**.
