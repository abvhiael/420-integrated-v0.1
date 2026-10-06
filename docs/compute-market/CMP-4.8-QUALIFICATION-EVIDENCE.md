# CMP-4.8 — Publication / retention policy qualification evidence

Status: **COMPLETE**

## Roadmap step

- Step: **CMP-4.8 — Publication / retention policy**
- Qualification level: **Level 1**
- Level 2: **not required at this ordinary step**
- Previous CMP-4 Level 2 milestone: **CMP-4.6 — Result provenance**
- Level 3: deferred to **CMP-4.10 — Phase closeout**

## Qualified implementation

- Exact implementation/closeout SHA: `fae498b72b2693f4264df3f208ebbe6a1e1d44bf`
- Audit branch: `cmp-4.1-scientific-work-unit-20261005`
- Pull request: **#527 — CMP-4 scientific compute framework**
- Carried reconciliation base before CMP-4.8: `f5fe16414893a1e4bd4f3db22eb36b685a2030f5`
- Current `main` at evidence closeout: `23ebff000a471bfbc4439894f797f3b17a530867`
- Later `main` movement after that base contains no Compute/CMP-4 surface changes.
- PR #527 is currently non-mergeable because of accumulated branch/main divergence; that is a CMP-4.10 Level 3 reconciliation concern, not a CMP-4.8 ordinary-step qualification defect.

## Implementation summary

CMP-4.8 adds `ComputeScientificPublicationRetention420`, a versioned publication/access/retention policy commitment layer over canonical CMP-4.7 scientific metadata/lineage records.

The policy layer:

- authenticates the exact CMP-4.7 publisher;
- creates one deterministic policy identity per canonical lineage record;
- supports explicit PRIVATE, RESTRICTED and PUBLIC visibility semantics;
- requires nonzero access-policy and retention-policy commitments;
- requires an exact publication-manifest commitment for RESTRICTED/PUBLIC modes;
- supports optional embargo and finite-or-indefinite retention windows;
- preserves append-only, predecessor-linked revision history;
- supports explicit activation/deactivation;
- fails closed if underlying CMP-4.7 lineage stops being canonical;
- exposes current publication authorization without storing or retrieving raw scientific bytes.

CMP-4.8 deliberately does not create storage, deletion, correctness, dataset-access, settlement, reward, slash or governance authority.

## Files implemented / updated

- `contracts/src/compute/ComputeScientificPublicationRetention420.sol`
- `contracts/test/ComputeScientificPublicationRetention420.t.sol`
- `contracts/config/compute-market/cmp-4.8-publication-retention.json`
- `docs/compute-market/CMP-4.8-PUBLICATION-RETENTION-POLICY.md`
- `scripts/verify-cmp-4-8-publication-retention.py`
- `.github/workflows/compute-market.yml`
- `docs/compute-market/CMP-4.7-SCIENTIFIC-METADATA-LINEAGE.md`
- canonical post-CMP1 roadmap

## Exit-criterion disposition

1. policy identity is chain/registry/lineage/provenance/scientific-unit/publisher bound — **PASS**
2. only the project-authenticated CMP-4.7 publisher can create or revise policy — **PASS**
3. one deterministic current policy exists per lineage with append-only revision history — **PASS**
4. PRIVATE, RESTRICTED and PUBLIC modes have explicit fail-closed field semantics — **PASS**
5. access and retention policy commitments are always nonzero — **PASS**
6. RESTRICTED/PUBLIC require an exact publication-manifest commitment — **PASS**
7. optional embargo and finite-or-indefinite retention windows are validated — **PASS**
8. current publication authorization fails closed for private, inactive, embargoed, expired or noncanonical lineage — **PASS**
9. stale, no-op, duplicate and unauthorized mutations fail closed — **PASS**
10. raw metadata/results/evidence remain off-chain and no mutable URL is canonicalized — **PASS**
11. policy creates no storage, deletion, access, correctness, economic or governance authority — **PASS**
12. dedicated tests and mechanical verifier pass exact-head Level 1 qualification — **PASS**

## Exact-head Level 1 evidence

Required owner: **Compute Market Qualification**

- Workflow: **Compute Market Qualification #425**
- Run ID: `37496866215`
- Job ID: `112383527372`
- Exact SHA: `fae498b72b2693f4264df3f208ebbe6a1e1d44bf`
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
- CMP-4.3 researcher/institution identity verifier — PASS
- CMP-4.4 dataset-manifest verifier — PASS
- CMP-4.5 reproducible-execution-environment verifier — PASS
- CMP-4.6 result-provenance verifier — PASS
- CMP-4.7 scientific metadata/lineage verifier — PASS
- CMP-4.8 publication/retention verifier — PASS

## Qualification repair history

Initial candidate `786bb7a75b2e436b5c3545fd2eccaf75c8d711d0` completed the retained Compute Solidity suite with **516 passed, 0 failed, 0 skipped**, compiled the verification scripts, and passed CMP-4.1 through CMP-4.7 verifiers.

The only failure was the CMP-4.8 mechanical verifier requiring a documentation token not literally present in the specification. No contract, protocol, authorization, security or test defect was found.

The verifier-only repair aligned the token check to the specification's existing semantics. The resulting exact SHA `fae498b72b2693f4264df3f208ebbe6a1e1d44bf` then passed Compute Market Qualification #425 completely.

No assertion, authorization rule, safety boundary or protocol behavior was weakened.

## Supporting exact-head workflow evidence

The same exact SHA also completed successfully in:

- Solidity Contracts **#5073** — SUCCESS
- Genesis Address Authority **#1968** — SUCCESS
- 420Docs Qualification **#5970** — SUCCESS
- Compute Worker Fast Qualification **#422** — SUCCESS
- 420Indexer **#2438** — SUCCESS
- 420Oracle audit qualification **#1310** — SUCCESS
- 420Registry REG-AUDIT-4 **#1781** — SUCCESS

These are supporting evidence. They are not promoted into extra CMP-4.8 Level 1 requirements.

Solidity Contracts correctly classified the change as Compute-scoped and did not require a redundant full repository Foundry inventory for this ordinary step.

## Security / adversarial / invariant results

Dedicated CMP-4.8 coverage proves:

- private policies cannot become public authorization;
- public/restricted policies require an exact publication manifest;
- outsiders cannot create policy for another lineage publisher;
- stale revisions and no-op revisions fail closed;
- policy history is append-only and predecessor-linked;
- invalid embargo/retention relationships fail closed;
- expired retention fails closed;
- underlying lineage drift invalidates current policy/publication authorization;
- explicit deactivation fails closed;
- exact policy commitment/revision checks are deterministic;
- policy state grants no raw-byte storage/deletion, correctness, settlement, reward, slash, dataset-access or governance authority.

The privacy boundary remains commitment-only. Raw research metadata, datasets, results, receipts, credentials, logs and private evidence remain off-chain under existing Compute privacy/storage rules.

## Milestone status

CMP-4.8 is an ordinary **Level 1** step.

CMP-4.6 remains the most recent CMP-4 Level 2 integration milestone. CMP-4.8 adds a bounded policy overlay over already-qualified CMP-4.7 lineage without introducing a new economic or cross-service authority requiring another Level 2 run.

**No additional Level 2 qualification is required at CMP-4.8.**

## Intentionally deferred

- CMP-4.9 research dashboard;
- CMP-4.10 comprehensive Level 3 scientific-framework closeout;
- CMP-7 SDK/API/indexer expansion;
- CMP-8 Compute UI;
- CMP-9 public/testnet storage enforcement and scientific demonstration.

## Limitations

CMP-4.8 declares publication and retention policy commitments. It does not itself:

- store or retrieve raw bytes;
- guarantee deletion from third-party or already-public copies;
- erase immutable blockchain history;
- grant dataset/result access;
- replace legal, contractual, consent, institutional or jurisdictional retention duties;
- prove scientific truth or correctness;
- deploy live storage infrastructure;
- make any mainnet/testnet deployment claim.

## Blockers

**No repository blocker remains for CMP-4.8 itself.**

PR #527 is currently non-mergeable because `main` has advanced substantially since the branch base. Repository comparison shows no Compute/CMP-4 changes in that later `main` movement, so this does not invalidate CMP-4.8 Level 1 qualification.

Accumulated current-main reconciliation is intentionally deferred to **CMP-4.10 Level 3 phase closeout**, where one final merge-candidate SHA must be qualified comprehensively.

## Evidence-only closeout rule

This closeout commit changes documentation/evidence only. It changes no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements.

It therefore inherits the already-qualified exact implementation SHA without recursive qualification.

## Formal status

**CMP-4.8 — Publication / retention policy: COMPLETE.**

Next canonical step: **CMP-4.9 — Research dashboard**.
