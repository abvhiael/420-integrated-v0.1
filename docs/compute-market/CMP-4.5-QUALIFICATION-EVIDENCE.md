# CMP-4.5 — Reproducible execution environments qualification evidence

Status: **COMPLETE**

## Roadmap step

- Step: **CMP-4.5 — Reproducible execution environments**
- Qualification level: **Level 1**
- Level 2: **not required**
- Level 3: deferred to **CMP-4.10 — Phase closeout**

## Qualified implementation

- Exact implementation/closeout SHA: `31fc4fd39b283fd3a49eef514c55863551646da6`
- Audit branch: `cmp-4.1-scientific-work-unit-20261005`
- Pull request: **#527 — CMP-4 scientific compute framework**
- Qualification base/current main at that run: `53f5603520e02a492184a41801de0ad09af59b35`
- Later current-main reconciliation before CMP-4.6: `982826120bacf7631afe853c71cb87d048882672`, merging main `f32a9c322e085634e47f20b84861338811198454`
- CMP-4 relevant content was unchanged by that later main reconciliation.

## Implementation summary

CMP-4.5 adds `ComputeExecutionEnvironmentRegistry420`, a project-owned, revisioned execution-environment registry for scientific work.

Each exact environment revision binds:

- executable/container artifact commitment;
- runtime-profile commitment;
- dependency-lock commitment;
- command-spec commitment;
- platform commitment;
- sandbox-profile commitment;
- reproducibility-policy commitment;
- exact CMP-4.2 project revision and commitment;
- predecessor commitment, revision, and active state.

For CMP-4.1 scientific work, `executableContainerCommitment` resolves to the exact current environment revision commitment and new-work admission requires `isCurrentReproducible(...)`.

CMP-0.4 remains the signed execution-manifest authority. CMP-3 remains the worker/sandbox/runtime authority. Environment identity does not grant execution, dataset access, correctness, worker/verifier selection, funding, settlement, rewards, slashing, or governance authority.

## Files implemented / updated

- `contracts/src/compute/ComputeExecutionEnvironmentRegistry420.sol`
- `contracts/test/ComputeExecutionEnvironmentRegistry420.t.sol`
- `contracts/config/compute-market/cmp-4.5-execution-environments.json`
- `docs/compute-market/CMP-4.5-REPRODUCIBLE-EXECUTION-ENVIRONMENTS.md`
- `scripts/verify-cmp-4-5-execution-environments.py`
- `.github/workflows/compute-market.yml`
- CMP-4.1 scientific work-unit binding/config
- CMP-4.4 dependency bookkeeping
- canonical post-CMP1 roadmap

## Exit-criterion disposition

1. canonical chain/registry/project/controller-bound environment IDs — **PASS**
2. nonzero artifact/runtime/dependency/command/platform/sandbox/reproducibility commitments — **PASS**
3. exact current CMP-4.2 project binding required for new work — **PASS**
4. CMP-4.1 `executableContainerCommitment` resolves to exact environment revision commitment — **PASS**
5. project-owner-only exact-revision mutation — **PASS**
6. append-only predecessor-linked environment history — **PASS**
7. project drift and environment deactivation fail closed — **PASS**
8. cross-environment/stale replay fails closed — **PASS**
9. CMP-0.4 signed manifest and CMP-3 runtime/sandbox remain canonical execution owners — **PASS**
10. environment identity creates no execution/correctness/access/economic authority — **PASS**
11. dedicated tests and mechanical verifier committed — **PASS**
12. affected Compute Market Level 1 qualification passes exact implementation SHA — **PASS**

## Exact-head Level 1 evidence

Required owner: **Compute Market Qualification**

- Workflow: **Compute Market Qualification #408**
- Run ID: `37411714045`
- Job ID: `112101374538`
- Exact SHA: `31fc4fd39b283fd3a49eef514c55863551646da6`
- Result: **SUCCESS**

Passing decisive steps:

- checkout exact qualification head — PASS
- verify exact qualification head — PASS
- build Compute Market contracts — PASS
- retained Compute Market Solidity suite — PASS
- compile Compute Market verification scripts — PASS
- CMP-4.1 scientific work-unit verifier — PASS
- CMP-4.1 boundary test — PASS
- CMP-4.2 Research Project Registry verifier — PASS
- CMP-4.3 researcher/institution identity verifier — PASS
- CMP-4.4 dataset-manifest verifier — PASS
- CMP-4.5 reproducible-execution-environment verifier — PASS

Additional same-SHA workflows also completed successfully, including Solidity Contracts #5029, Compute Worker Fast #396, 420 Integrated #6488, 420Docs #5773, 420Indexer #2411, Genesis Address Authority #1838, 420Registry #1660, and 420Oracle #1115. They are supporting evidence rather than required CMP-4.5 Level 1 owners.

## Security / adversarial results

Dedicated tests prove:

- failed invalid registration does not consume identity/nonce;
- outsider revision is rejected;
- stale revision fails closed;
- no-op revisions fail;
- project revision drift invalidates new-work admission until explicit environment refresh;
- project pause/deactivation fails closed;
- reactivation requires current acceptable project state;
- cross-environment commitment replay fails;
- exact commitment mismatch fails;
- historical revisions remain reconstructable;
- environment validity is not execution or correctness authority.

No test/assertion/safety gate was weakened to obtain qualification.

## Milestone status

CMP-4.5 is an ordinary Level 1 step. It does not introduce a new worker implementation or a cross-service authority boundary requiring Level 2.

**Level 2 is not required at CMP-4.5.**

## Intentionally deferred

- CMP-4.6 result provenance;
- CMP-4.7 scientific metadata and lineage;
- CMP-4.8 publication / retention policy;
- CMP-4.9 research dashboard;
- CMP-4.10 Level 3 scientific-framework closeout;
- CMP-7 SDK/API/indexer expansion;
- CMP-8 Compute UI;
- CMP-9.13 live scientific workload demonstration.

## Limitations

Reproducible environment identity does not promise bit-identical outputs across hardware, driver, floating-point, or intentionally nondeterministic execution. The committed reproducibility policy defines the applicable tolerance/determinism semantics; result correctness/provenance is separate.

No live-network or production deployment claim is made by CMP-4.5.

## Blockers

**No repository blocker remains for CMP-4.5.**

## Evidence-only closeout rule

This evidence/status commit changes documentation only. It does not change executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state, or substantive requirements. It therefore references the already-qualified exact implementation SHA above without recursive Level 1 qualification.

## Formal status

**CMP-4.5 — Reproducible execution environments: COMPLETE.**

Next canonical step: **CMP-4.6 — Result provenance**.
