# CMP-1.3.14 — Cross-component adversarial and invariant qualification

Status: **COMPLETE — exact implementation SHA qualified; evidence-only closeout recorded without recursive rerun.**

## Canonical definition

The controlling roadmap defines CMP-1.3.14 as:

> Create a consolidated qualification campaign spanning the entire hardened WorkerRegistry graph.

Required:

- provider/node/resource state;
- authorization/delegation;
- capability profiles;
- attestation provenance;
- Trust and compute-stake bindings;
- accepted match/job state;
- execution-key signatures;
- capacity reservations;
- historical reconstruction;
- failure atomicity and authority-separation tests;
- explicit review of every `CMP-INV-001`–`CMP-INV-030` invariant as directly exercised, transitively exercised by retained tests, or non-applicable;
- invariant/fuzz testing where practical.

Exit:

> all applicable frozen ComputeMarket invariants have traceable test evidence against the complete WorkerRegistry graph.

## Authoritative baseline

CMP-1.3.14 began from merged `main` after CMP-1.3.13 closeout.

Base/main SHA:

`76e7f5732247efc091c8842efaecce2b11c6fc61`

Repository evidence inspected before modification included:

- `docs/compute-market/CMP-1-IMPLEMENTATION-ROADMAP.md`;
- `docs/420-COMPUTE-MARKET-V1-ARCHITECTURE.md`;
- `docs/compute-market/CMP-1.3.8-1.3.16-WORKER-REGISTRY-GAP-AUDIT.md`;
- CMP-1.3.1–CMP-1.3.13 implementation and qualification records;
- provider/node/resource identity tests;
- WorkerRegistry authorization/delegation tests;
- capability profile tests;
- attestation/provenance tests;
- Trust and compute-stake binding tests;
- accepted-job WorkerSnapshot/attempt/capacity tests;
- canonical read-model and SDK/client tests;
- retained funding/matching/verification/entitlement tests required to classify invariants outside WorkerRegistry authority.

## Pre-change gap analysis

### Satisfied retained coverage

The hardened WorkerRegistry graph already had strong component-local and several integration/adversarial suites:

- canonical provider/node/resource ancestry and history;
- worker registration/lifecycle/key rotation/profile revision history;
- capability-scoped mutation authorization/delegation;
- canonical detailed capability profile matching;
- trusted attestation/provenance including replay/schema/type/issuer negatives;
- Trust references and live correction behavior;
- compute-stake source/policy/reference binding;
- accepted worker snapshot and execution-key signing;
- capacity reservation/concurrency/release/failure/expiry;
- retry/cancellation/attempt history;
- canonical read model and non-AI client compatibility;
- integrated match/funding/verification/settlement protections.

### Blocking CMP-1.3.14 gaps

1. No single durable evidence matrix explicitly reviewed all `CMP-INV-001`–`CMP-INV-030`.
2. Existing evidence was distributed across many files, making it difficult to distinguish:
   - direct WorkerRegistry graph evidence;
   - retained/transitive ComputeMarket evidence;
   - invariants whose enforcing authority intentionally lives outside WorkerRegistry.
3. No mechanically enforced completeness check guaranteed all 30 frozen invariant IDs remained represented.
4. The complete read-model graph did not yet have one adversarial case that simultaneously:
   - invalidated live worker eligibility;
   - closed attestation admission;
   - closed Trust admission;
   - closed compute-stake admission;
   - proved the already-accepted worker snapshot, references, capacity reservation and historical worker revision remained unchanged.
5. Practical fuzz/property coverage was missing for arbitrary non-current worker revision admission against the complete read graph.

## Implementation

### 1. Consolidated invariant evidence matrix

Added:

`docs/compute-market/cmp-1.3.14-invariant-evidence.json`

The matrix contains exactly 30 entries, one for every canonical frozen invariant:

`CMP-INV-001` through `CMP-INV-030`.

Every invariant is classified as exactly one of:

- `direct` — directly exercised against the WorkerRegistry graph or its accepted-work integration;
- `transitive_retained` — enforced by retained ComputeMarket tests outside WorkerRegistry’s own authority but required for the integrated invariant;
- `non_applicable_worker_registry_authority` — explicitly outside WorkerRegistry authority, with the canonical enforcing slice identified.

Each entry records:

- invariant ID;
- disposition;
- exact repository evidence paths;
- exact test function/test-label references where applicable;
- an explanatory note.

### 2. Mechanical invariant-matrix verification

Added:

`scripts/verify-cmp-1-3-14-invariants.py`

The verifier fails unless:

- IDs are exactly `CMP-INV-001`–`CMP-INV-030`, in canonical order;
- there are no duplicates or missing IDs;
- every ID also exists in the frozen architecture document;
- every disposition is one of the allowed classifications;
- every invariant has at least one evidence reference and explanatory note;
- every referenced repository file exists;
- every referenced Solidity function or named client test label exists in that file.

Updated:

`.github/workflows/docs-qualify.yml`

so exact-head Docs qualification executes the invariant verifier.

### 3. Complete-graph adversarial admission shutdown

Extended:

`contracts/test/ComputeWorkerReadModel420.t.sol`

with:

`testCrossComponentAdmissionShutdownPreservesAcceptedHistoryAndCapacity`

The test begins from a fully accepted non-AI WorkerRegistry job with:

- canonical provider/node/resource;
- active worker revision;
- canonical capability profile;
- trusted capability attestation;
- Trust reference;
- compute-stake reference;
- accepted match/job;
- execution-key-authorized assignment;
- live capacity reservation.

It then:

1. suspends the worker;
2. closes the attestation policy for new admission;
3. closes the Trust policy for new admission;
4. closes the compute-stake policy for new admission.

It proves all four live admission predicates fail closed while simultaneously proving:

- the accepted historical worker revision remains readable and ACTIVE at the accepted revision;
- the accepted assignment snapshot commitment is unchanged;
- the accepted worker revision is unchanged;
- attestation provenance remains reconstructable;
- Trust history remains reconstructable;
- stake history remains reconstructable;
- the accepted reservation is still RESERVED;
- capacity accounting remains intact.

This directly exercises non-confiscatory post-acceptance mutation across the complete graph.

### 4. Practical fuzz/property test

Added:

`testFuzzNonCurrentWorkerRevisionNeverQualifies(uint64 candidateRevision)`

against the same fully wired graph.

For every arbitrary revision other than the exact current worker revision, the property requires:

- WorkerRegistry eligibility false;
- capability eligibility false;
- Trust eligibility false;
- compute-stake eligibility false.

This gives a direct property test for exact-revision fail-closed admission across the composed read model.

## Invariant disposition summary

The machine-readable matrix is the controlling per-invariant evidence record.

The high-level classifications are:

- direct WorkerRegistry/integrated graph evidence for identity stability, ancestry, authority separation, accepted constraints, accepted immutability, lifecycle safety, signature replay resistance, entitlement isolation, suspension semantics, Trust separation, private-input commitments, historical reconstruction, replaceable clients, capability mutation safety, identity mutation safety, and non-AI operation;
- retained/transitive evidence for funding authorization, economic maximums, beneficiary derivation, refunds, cumulative receipt semantics, verification policy, duplicate settlement, and emergency/custody behavior;
- explicitly non-applicable WorkerRegistry authority for off-chain execution/consensus and stake movement/slashing, whose canonical authority lies elsewhere.

No invariant is silently omitted.

## Security and authority conclusions

CMP-1.3.14 introduces no new production authority.

The new Solidity changes are tests only.

The qualification campaign specifically preserves:

- provider/node/resource ancestry;
- exact-revision worker identity;
- action/object-scoped worker delegation;
- execution-key/operator separation;
- attestation as evidence rather than correctness proof;
- Trust as evidence rather than routing/custody/settlement authority;
- compute-stake references without custody/slash authority;
- immutable accepted job/worker context;
- deterministic capacity accounting;
- historical reconstructability after live policy/lifecycle changes;
- non-confiscatory treatment of already-accepted work;
- general-purpose, non-AI-only ComputeMarket semantics.

## Qualification gate

Before COMPLETE, the exact qualification-relevant implementation SHA must pass:

- Solidity Contracts — all 16 required exact-head PR shards;
- 420 Integrated Qualification;
- 420Docs Qualification, including `verify-cmp-1-3-14-invariants.py`;
- focused cross-component adversarial test;
- fuzz/property test;
- retained WorkerRegistry, capability, attestation, Trust, stake, snapshot, capacity, read-model and broader ComputeMarket regression suites;
- current-main reconciliation review.

Any workflow triggered by the changed files is also required to finish successfully unless it is an aggregate wrapper intentionally skipped by workflow design.

A later documentation-only evidence commit may inherit the qualified implementation SHA under the repository evidence-only rule. Any later implementation/test/config/workflow/dependency/substantive-requirement change requires fresh exact-head qualification.

## Qualified implementation evidence

Qualified implementation SHA:

`c104211a8dfef83431f2ee2bfcf07c20f2b5380d`

Base/main SHA:

`76e7f5732247efc091c8842efaecce2b11c6fc61`

Current-main reconciliation immediately before closeout:

- current `main` remained exactly `76e7f5732247efc091c8842efaecce2b11c6fc61`;
- branch was ahead only and 0 commits behind;
- no qualification-affecting reconciliation commit was required.

Exact-SHA qualification:

- Solidity Contracts #3345 — run `36646566777` — **SUCCESS**, all 16 required PR shards passed; aggregate `foundry` wrapper skipped by workflow design;
- 420 Integrated Qualification #5982 — run `36646566684` — **SUCCESS**, including `offline-core`, `fault-matrix`, `production-dependencies`, and `geth-engine`;
- 420Docs Qualification #3358 — run `36646566716` — **SUCCESS**, including `verify-cmp-1-3-14-invariants.py`;
- 420Indexer #965 — run `36646566713` — **SUCCESS**;
- EXP-1.9 CI Qualification Automation #82 — run `36646566731` — **SUCCESS**;
- EXP-1.10 Phase Closeout Qualification #89 — run `36646566782` — **SUCCESS**.

The documentation-only evidence commit containing this section does not change contracts, tests, scripts, workflows, dependencies, configuration, or substantive CMP-1.3.14 requirements and therefore inherits the qualified implementation SHA under the repository evidence-only rule.

## Completion

**COMPLETE** — every canonical CMP-1.3.14 requirement and exit criterion is satisfied at implementation SHA `c104211a8dfef83431f2ee2bfcf07c20f2b5380d`. All applicable `CMP-INV-001`–`CMP-INV-030` invariants have traceable repository evidence, the complete WorkerRegistry graph has consolidated adversarial and fuzz/property coverage, and authority-separation/failure-atomicity/historical-reconstruction evidence is durably recorded.
