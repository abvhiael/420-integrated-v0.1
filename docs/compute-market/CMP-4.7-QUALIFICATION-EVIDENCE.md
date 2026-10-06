# CMP-4.7 — Scientific metadata and lineage qualification evidence

Status: **COMPLETE**

## Roadmap step

- Step: **CMP-4.7 — Scientific metadata and lineage**
- Qualification level: **Level 1**
- Level 2: **not required at this ordinary step**
- Previous CMP-4 Level 2 milestone: **CMP-4.6 — Result provenance**
- Level 3: deferred to **CMP-4.10 — Phase closeout**

## Qualified implementation

- Exact implementation/closeout SHA: `f7389d8c9755721058a073a1ad19747ca95c4572`
- Audit branch: `cmp-4.1-scientific-work-unit-20261005`
- Pull request: **#527 — CMP-4 scientific compute framework**
- Reconciliation base before CMP-4.7 implementation: `f5fe16414893a1e4bd4f3db22eb36b685a2030f5`
- Current `main` at evidence closeout: `d86a3810d2901dc1082b65dc9061896c46e1911d`
- Repository comparison after the reconciliation showed later main movement did not touch Compute/CMP-4 surfaces; accumulated current-main reconciliation remains a CMP-4.10 Level 3 responsibility.

## Implementation summary

CMP-4.7 adds `ComputeScientificMetadataLineage420`, a project-authenticated metadata and derivation-lineage overlay over already-canonical CMP-4.6 scientific result provenance.

Canonical records bind:

- exact CMP-4.6 provenance ID;
- exact CMP-4.1 scientific-work-unit commitment;
- publisher authenticated as the owner of the exact historical CMP-4.2 project revision embedded in that work unit;
- metadata schema commitment;
- metadata content commitment;
- optional derivation/relation commitment;
- deterministic parent-provenance-set commitment;
- bounded direct parent count.

Root records require no parent and no relation commitment. Derived records require 1–32 canonical, strictly sorted, unique, already lineage-registered parent provenance IDs plus a nonzero relation commitment.

Parent-first registration makes the on-chain lineage graph append-only and prevents cycles without introducing a mutable graph authority.

## Files implemented / updated

- `contracts/src/compute/ComputeScientificMetadataLineage420.sol`
- `contracts/test/ComputeScientificMetadataLineage420.t.sol`
- `contracts/config/compute-market/cmp-4.7-scientific-metadata-lineage.json`
- `docs/compute-market/CMP-4.7-SCIENTIFIC-METADATA-LINEAGE.md`
- `scripts/verify-cmp-4-7-scientific-metadata-lineage.py`
- `.github/workflows/compute-market.yml`
- `docs/compute-market/CMP-4.1-SCIENTIFIC-WORK-UNIT-SPECIFICATION.md`
- `docs/compute-market/CMP-4.6-RESULT-PROVENANCE.md`
- canonical post-CMP1 roadmap

## Exit-criterion disposition

1. metadata binds exact canonical CMP-4.6 provenance and CMP-4.1 scientific work-unit commitment — **PASS**
2. publisher is authenticated as owner of the exact historical CMP-4.2 project revision — **PASS**
3. scientific binding witness is reconstructed and substitution fails closed — **PASS**
4. metadata schema/content commitments are nonzero and raw metadata remains off-chain — **PASS**
5. root and derived relation semantics are explicit and fail closed — **PASS**
6. parent provenance IDs are bounded, sorted, unique, nonzero and not self — **PASS**
7. every parent is canonical and already lineage-registered — **PASS**
8. lineage identity is domain/chain/registry/project/provenance/publisher bound — **PASS**
9. duplicate identical registration is idempotent and conflicting registration fails closed — **PASS**
10. canonical source drift invalidates `isCanonical` — **PASS**
11. metadata/lineage creates no correctness/access/publication/economic/governance authority — **PASS**
12. dedicated tests and mechanical verifier pass exact-head Level 1 qualification — **PASS**

## Exact-head Level 1 evidence

Required owner: **Compute Market Qualification**

- Workflow: **Compute Market Qualification #422**
- Run ID: `37424157830`
- Job ID: `112139897608`
- Exact SHA: `f7389d8c9755721058a073a1ad19747ca95c4572`
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
- CMP-4.6 result-provenance verifier — PASS
- CMP-4.7 scientific metadata/lineage verifier — PASS

The first qualification attempt at `9628a251bc845f80e8bbbaf41ade0396314cedaf` proved the complete retained Solidity suite green but exposed a mechanical documentation-token mismatch in the CMP-4.7 verifier (`Parent-first` versus required lowercase `parent-first`). The documentation wording was normalized without changing protocol semantics, and the corrected exact SHA above passed the full required Level 1 workflow.

## Supporting exact-head evidence

The same corrected SHA also completed successfully in the directly affected or automatically triggered supporting workflows already terminal at evidence time:

- Genesis Address Authority **#1929** — SUCCESS
- 420Registry REG-AUDIT-4 **#1744** — SUCCESS
- Compute Worker Fast Qualification **#417** — SUCCESS
- 420Docs Qualification **#5916** — SUCCESS
- 420Indexer **#2433** — SUCCESS
- 420Oracle audit qualification **#1256** — SUCCESS

These are supporting evidence, not additional CMP-4.7 Level 1 requirements. Repository-wide full-inventory qualification remains reserved for the CMP-4.10 Level 3 closeout.

## Security / adversarial / invariant results

Dedicated CMP-4.7 coverage proves:

- only the exact historical project owner can publish canonical metadata;
- scientific-unit witness substitution fails closed;
- root/derived relation misuse fails closed;
- zero, duplicate, unsorted, self, missing or unregistered parent references fail closed;
- parent count is bounded;
- canonical source drift invalidates lineage canonicality;
- byte-identical duplicate publication is idempotent;
- conflicting second publication cannot replace an existing canonical lineage record;
- metadata commitments and parent references do not grant raw-data access or publication rights;
- metadata/lineage does not create job, result, verifier, settlement, reward, slash, governance, worker or dataset-access authority.

No authorization rule, assertion, test, safety gate or canonical ownership boundary was weakened to obtain qualification.

## Milestone status

CMP-4.7 is an ordinary **Level 1** step.

CMP-4.6 remains the most recent CMP-4 Level 2 integration milestone. CMP-4.7 adds a bounded metadata/lineage overlay but does not introduce a new shared authority, cross-service lifecycle, or economic boundary requiring another Level 2 run.

**No additional Level 2 qualification is required at CMP-4.7.**

## Intentionally deferred

- CMP-4.8 publication / retention policy;
- CMP-4.9 research dashboard;
- CMP-4.10 comprehensive Level 3 scientific-framework closeout;
- CMP-7 SDK/API/indexer expansion;
- CMP-8 Compute UI;
- CMP-9.13 live scientific workload demonstration.

## Limitations

CMP-4.7 records commitments and lineage relationships only. It does not:

- publish raw scientific metadata or result bytes;
- prove scientific truth;
- grant access to parent datasets/results;
- define disclosure, retention or deletion policy;
- replace CMP-4.6 result provenance or verifier decisions;
- create funding, payment, reward or slash entitlement;
- make any live/testnet deployment claim.

## Blockers

**No repository blocker remains for CMP-4.7 itself.**

Later current-main movement is unrelated to Compute/CMP-4 at this ordinary-step boundary and is intentionally left for accumulated CMP-4.10 reconciliation rather than causing redundant per-step qualification.

## Evidence-only closeout rule

This closeout commit changes documentation/evidence only. It changes no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements.

It therefore inherits the already-qualified exact implementation SHA above without recursive qualification.

## Formal status

**CMP-4.7 — Scientific metadata and lineage: COMPLETE.**

Next canonical step: **CMP-4.8 — Publication / retention policy**.
