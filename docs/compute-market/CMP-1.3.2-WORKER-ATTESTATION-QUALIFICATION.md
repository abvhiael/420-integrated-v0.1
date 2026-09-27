# CMP-1.3.2 — trusted worker capability attestation enforcement

Status: **IMPLEMENTATION COMPLETE; exact-head repository qualification required before COMPLETE.**

CMP-1.3.2 implements the first independent trust gate over the self-reported capability profile introduced by CMP-1.3.1. It does not create a universal hardware oracle, compute collateral, Trust reputation score, verifier authority, custody authority, or settlement authority.

## Scope

This step adds:

- `ComputeWorkerAttestation420`, a provider-neutral evidence registry;
- append-only, revisioned attestation policy publication;
- governance-scoped trust assignment for independent attesters;
- immutable evidence records bound to an exact worker ID and revision;
- automatic binding to the canonical resource ID/revision, capability profile commitment, and execution-key commitment stored in worker history;
- validity windows, policy revisioning, attester withdrawal, and explicit evidence revocation;
- replay protection for identical evidence commitments;
- `ComputeWorkerAttestedEligibility420`, a fail-closed new-admission predicate that composes CMP-1.3.1 worker eligibility with independent evidence when policy requires it.

## Trust boundary

A worker registration remains only a claim. When `requireAttestation == true`, worker self-report cannot satisfy admission.

The attestation authority is deliberately separate from `ComputeWorkerRegistry420`. Authorized attesters may publish or revoke evidence only. They cannot:

- register, activate, suspend, or retire workers;
- move provider/node/resource parentage;
- change execution keys or capability profiles;
- move Vault funds;
- authorize matching, verification, settlement, staking, slashing, governance, bridge, or wallet actions.

Governance may define a policy and its currently trusted attesters for **new admission**. Historical evidence remains readable after policy supersession, attester removal, or evidence revocation.

## Exact-subject binding

Each evidence record binds:

- worker ID;
- exact worker revision;
- canonical resource ID;
- exact resource revision captured by the worker record;
- capability profile commitment;
- execution-key commitment;
- attestation policy ID and exact policy revision;
- evidence hash;
- attester;
- not-before and expiry timestamps.

The canonical worker fields are read from `ComputeWorkerRegistry420.revision(...)`; an attester cannot substitute a different resource/profile/key subject into the on-chain record.

## Fail-closed behavior

Attestation-required admission rejects:

- missing evidence;
- unknown or inactive policy;
- stale policy revision;
- untrusted attester;
- future-dated evidence;
- expired evidence;
- revoked evidence;
- wrong worker or worker revision;
- stale capability profile;
- stale execution key;
- stale resource revision;
- cross-worker reuse;
- exact evidence replay.

Capability/profile or execution-key mutation creates a new worker revision and therefore invalidates prior evidence for new admission until the new revision is independently attested.

## Qualification tests

`contracts/test/ComputeWorkerAttestation420.t.sol` covers:

1. self-reported capability cannot bypass required attestation;
2. valid authorized evidence binds exact canonical state;
3. capability refresh invalidates old evidence;
4. execution-key rotation invalidates old evidence;
5. future/expired/revoked evidence fails closed;
6. attester removal invalidates new admission;
7. policy supersession invalidates stale evidence;
8. unauthorized publication and exact replay fail;
9. cross-worker evidence reuse fails;
10. attestation authority cannot mutate worker lifecycle.

## Invariant mapping

This step directly advances:

- CMP-INV-005 — attestation registration grants no unrelated authority;
- CMP-INV-007/008 — trusted capability evidence cannot broaden accepted execution constraints;
- CMP-INV-019 — one worker cannot consume another worker's evidence;
- CMP-INV-023 — evidence is separate from correctness/custody/settlement authority;
- CMP-INV-026 — exact historical worker/evidence revisions remain reconstructable;
- CMP-INV-028/029 — capability/resource/key changes cannot silently preserve old admission semantics;
- CMP-INV-030 — evidence policy remains provider-neutral and general-purpose.

## Deferred boundaries

CMP-1.3.2 does **not** implement:

- detailed on-chain architecture/CPU/GPU/VRAM/memory/storage/network/software matching predicates;
- 420Trust reputation references;
- CMP-1.5 compute collateral;
- accepted-job worker snapshot integration;
- deployment/publication qualification.

Those remain later CMP-1.3 slices.

## Completion gate

CMP-1.3.2 is complete only after the exact candidate head passes:

- all required Solidity contract shards;
- 420 Integrated Qualification;
- 420Docs Qualification.

After candidate qualification, the run IDs and exact candidate SHA must be recorded here and the evidence-recording head must itself rerun the retained exact-head gates before final closeout.
