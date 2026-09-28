# CMP-1.3.3 — canonical capability detail and admission predicates

Status: **CANDIDATE QUALIFIED; final evidence-recording head qualification pending.**

CMP-1.3.3 resolves the remaining opacity in the CMP-1.3.1 worker capability commitment. The worker record continues to carry one immutable-per-revision `capabilityProfileHash`, while this step publishes a bounded canonical preimage and deterministic matching predicates for new admission.

## Scope

This step adds:

- `ComputeWorkerCapabilityProfile420`;
- a canonical V1 profile commitment covering:
  - supported architectures;
  - CPU classes;
  - GPU classes;
  - VRAM;
  - system memory;
  - storage capacity and class;
  - network throughput and capability;
  - software capabilities;
  - runtime capability;
- bounded, strictly ordered capability sets with a maximum of 16 entries per set;
- exact worker-revision publication requiring the existing worker operator;
- commitment equality with the already-authorized `ComputeWorkerRegistry420.capabilityProfileHash`;
- immutable historical profile detail per worker revision;
- scalar minimum and exact-class/hash matching predicates;
- canonical resource-compute-class enforcement so a worker claim cannot broaden its resource;
- `ComputeWorkerCapabilityEligibility420`, composing detailed capability matching with the existing CMP-1.3.2 trusted-attestation path.

## Trust model

Publishing a detailed capability profile does **not** make the claim trusted hardware truth.

A caller may use the self-report matching path only when its policy allows self-reported capability. If a policy requires trusted capability evidence, `ComputeWorkerCapabilityEligibility420` also requires a live exact-revision CMP-1.3.2 attestation.

The capability-detail registry grants no:

- Vault/custody authority;
- verifier authority;
- job correctness authority;
- matching acceptance authority;
- settlement authority;
- stake/slash authority;
- governance, bridge, validator, or wallet authority.

## Canonical representation

Opaque commercial hardware model strings are not promoted to consensus enums. Architecture, CPU, GPU, and software classes are versioned opaque `bytes32` identifiers supplied as strictly increasing bounded sets.

The profile hash commits all detail. A profile cannot be published unless the commitment exactly equals the worker revision's pre-authorized `capabilityProfileHash`.

This permits profile precommitment during worker registration while preventing a later publisher from changing the meaning of that commitment.

## New-admission matching

The matcher can require:

- exact canonical resource compute class;
- one required architecture;
- one required CPU class;
- one required GPU class;
- one required software capability;
- minimum VRAM;
- minimum system memory;
- minimum storage;
- minimum network throughput;
- exact storage-class commitment;
- exact network-capability commitment;
- exact runtime-capability commitment.

All requirements are conjunctive and fail closed.

The matcher first requires `ComputeWorkerRegistry420.isEligible(workerId, workerRevision)`, preserving parent/provider/node/resource status and exact resource revision. Old worker revisions therefore remain reconstructable but cannot be reused for fresh admission after a material profile change.

## Qualification tests

`contracts/test/ComputeWorkerCapabilityProfile420.t.sol` covers:

1. all required capability dimensions are exposed;
2. exact class membership and scalar minimums;
3. canonical resource class cannot be broadened by worker claims;
4. trusted policies reject self-report until independently attested;
5. profile mutation invalidates old admission and requires explicit republish;
6. historical profile detail remains unchanged;
7. unauthorized publication fails;
8. commitment substitution fails;
9. duplicate publication fails;
10. noncanonical and oversized sets fail;
11. parent/resource suspension still overrides detailed capability matching.

## Invariant mapping

CMP-1.3.3 advances:

- CMP-INV-002/003 — exact stable worker/revision identity owns the profile;
- CMP-INV-005 — capability publication grants no unrelated authority;
- CMP-INV-007/008 — capability selection cannot broaden accepted constraints;
- CMP-INV-019 — one worker revision cannot consume another revision's profile;
- CMP-INV-023 — self-report and trusted evidence remain separate;
- CMP-INV-026 — historical execution capability remains reconstructable;
- CMP-INV-028/029 — profile/resource changes cannot silently alter fresh admission;
- CMP-INV-030 — the capability model remains provider-neutral and general-purpose.

## Deferred boundaries

CMP-1.3.3 does not implement:

- 420Trust reputation references;
- CMP-1.5 compute collateral references;
- accepted-job worker snapshot integration;
- deployment and ProtocolRegistry publication.

Those remain later CMP-1.3 slices.

## Completion gate

CMP-1.3.3 is complete only after the exact candidate head passes:

- Solidity Contracts qualification, all required shards;
- 420 Integrated Qualification;
- 420Docs Qualification.

The exact candidate SHA and run evidence are then recorded, followed by retained exact-head qualification of the evidence-recording head before final closeout.


## Candidate qualification evidence

Candidate exact head:

`4d0ccd94c7160cc40d5a737620c679c70da41c96`

Repository qualification on that exact candidate head:

- Solidity Contracts #3238 — run `36363277882` — **SUCCESS**, all 16 PR shards passed;
- 420 Integrated Qualification #5776 — run `36363277877` — **SUCCESS**, including offline-core, production-dependencies, fault-matrix, and geth-engine;
- 420Docs Qualification #3159 — run `36363277886` — **SUCCESS**.

This evidence qualifies the executable CMP-1.3.3 candidate. The documentation update recording that evidence creates a distinct final evidence-recording head; applicable retained exact-head qualification must pass on that new head before CMP-1.3.3 is marked COMPLETE.
