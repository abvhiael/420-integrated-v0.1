# CMP-1.3.11 — Hardware, benchmark, TEE, and inspection provenance hardening

Status: **IMPLEMENTED — candidate exact-head qualification pending**

## Canonical definition

The controlling roadmap requires strengthening trusted capability evidence so off-chain provenance is explicit and independently reconstructable.

Required:

- bind evidence type/schema revision, issuer/attester identity, evidence/source commitment, worker/revision/resource/profile/key subject, issuance/expiry, revocation, and policy revision;
- distinguish benchmark, TEE, and inspection provenance;
- signed/versioned/content-addressed evidence semantics where eligibility depends on off-chain manifests;
- preserve the rule that capability attestation is not proof of job-result correctness;
- reject forged provenance, wrong schema/type, stale policy, revoked issuer, evidence substitution, cross-subject reuse, and replay.

Exit: trusted hardware admission can identify exactly what evidence was accepted, under which schema/policy, for which worker revision.

## Authoritative baseline

Implementation began from current `main` at `3758148416e394ad3da0572ef3b39861764a9141`, after CMP-1.3.10 was merged.

Repository evidence inspected before modification:

- `docs/compute-market/CMP-1-IMPLEMENTATION-ROADMAP.md`;
- `docs/420-COMPUTE-MARKET-V1-ARCHITECTURE.md`;
- `docs/compute-market/CMP-1.3.8-1.3.16-WORKER-REGISTRY-GAP-AUDIT.md`;
- `docs/compute-market/CMP-1.3.2-WORKER-ATTESTATION-QUALIFICATION.md`;
- current WorkerRegistry, capability, attestation, accepted-job snapshot, capacity, and canonical wiring contracts/tests.

## Gap analysis

The retained CMP-1.3.2 implementation already provided valid foundations:

- independent attester policy and trust assignment;
- exact worker/revision/resource/profile/execution-key binding;
- policy revision, expiry, evidence revocation, issuer withdrawal, and replay rejection;
- historical evidence reads;
- explicit separation from worker lifecycle/custody/settlement/staking/slashing authority;
- distinct benchmark, TEE, and inspection type constants.

The CMP-1.3.11 audit identified the following remaining blocking gaps:

1. **Schema version provenance was incomplete.** Policy stored a schema hash but no explicit schema revision.
2. **Evidence source provenance was opaque.** Only one generic `evidenceHash` existed; the accepted off-chain source/content address was not separately reconstructable.
3. **No canonical signed provenance envelope existed.** Direct attester publication authenticated `msg.sender`, but there was no domain-separated digest that could be independently signed and relayed while binding the full provenance subject.
4. **Replay protection did not cover the full provenance subject.** The prior replay key omitted evidence type/schema/source/time/resource/profile/key dimensions.
5. **Accepted provenance was not fully self-describing.** Historical records did not directly expose evidence type, schema hash/revision, source commitment, issuance time, authorization mode, or signature commitment.
6. **Adversarial tests were incomplete** for forged detached provenance, wrong type/schema, source substitution, cross-subject signed reuse, explicit provenance replay, and future issuance.

## Implementation

### Versioned policy schemas

`ComputeWorkerAttestation420.Policy` now binds:

- evidence type;
- schema hash;
- explicit schema revision;
- maximum validity interval;
- policy revision.

`publishPolicyVersioned` supports an explicit monotonically increasing schema revision. The retained `publishPolicy` compatibility path automatically advances the schema revision while preserving the established evidence type for a policy.

Benchmark, TEE, and inspection remain distinct canonical provenance classes:

- `EVIDENCE_BENCHMARK_V1`;
- `EVIDENCE_TEE_V1`;
- `EVIDENCE_INSPECTION_V1`.

A policy cannot silently change evidence class.

### Canonical provenance envelope

A new `ProvenanceClaim` binds:

- evidence type;
- schema revision;
- source/content commitment;
- evidence commitment;
- issuance time;
- not-before time;
- expiry;
- issuer identity.

`provenanceDigest` domain-separates and commits the claim with:

- chain ID;
- attestation contract address;
- policy ID and exact policy revision;
- policy schema hash;
- exact worker ID/revision;
- canonical resource ID/revision;
- capability-profile commitment;
- execution-key commitment.

This creates a reconstructable, chain- and contract-specific provenance subject that cannot be transplanted across worker/resource/profile/key/policy contexts.

### Signed and relayed provenance

`attestProvenance` permits a relayer to submit a detached ECDSA provenance signature. Admission requires:

- exact current policy revision;
- currently accepted policy;
- currently trusted issuer;
- exact policy evidence type and schema revision;
- valid signature from the bound issuer over the complete provenance digest;
- nonzero source/evidence commitments;
- issuance not in the future;
- bounded validity;
- unreplayed provenance digest.

The stored record commits the authorization mode and signature hash for later reconstruction.

The retained direct `attest` path remains source-compatible with earlier repository consumers, but is hardened: the trusted issuer's signed Ethereum transaction authenticates the provenance envelope and the evidence hash is explicitly recorded as its source/content commitment. It produces the same complete canonical provenance subject and replay protection.

### Historical reconstructability

Every attestation now stores:

- worker/revision;
- resource/revision;
- capability profile;
- execution-key commitment;
- policy/revision;
- evidence type;
- schema hash/revision;
- source commitment;
- evidence hash;
- provenance digest;
- authorization mode;
- signature commitment where detached ECDSA is used;
- issuer;
- issued/not-before/expiry times;
- revocation status.

Later policy, issuer, worker, resource, profile, or key changes can invalidate **new admission** without rewriting historical provenance.

## Security and authority boundaries

CMP-1.3.11 does not create a hardware oracle that proves arbitrary truth. It records exactly which independently issued evidence a policy accepted.

Capability provenance remains **admission evidence only**. It is not job-result correctness evidence and cannot:

- mark a job verified or correct;
- authorize a verifier decision;
- create settlement entitlement;
- move or reserve Vault funds;
- mutate worker/provider/node/resource lifecycle;
- grant stake/slash authority;
- grant governance, bridge, validator, wallet, or arbitrary execution authority.

The accepted-job snapshot may freeze an attestation reference for historical admission context, but result correctness continues to use the separate verifier/evidence path.

## Required adversarial coverage

The retained and new tests cover:

- valid exact-subject provenance;
- explicit source/content commitment reconstruction;
- explicit schema hash/revision reconstruction;
- detached issuer signature reconstruction;
- benchmark, TEE, and inspection type separation;
- forged issuer signature rejection;
- wrong evidence type rejection;
- wrong schema revision rejection;
- future issuance rejection;
- stale policy rejection;
- revoked issuer rejection;
- revoked evidence rejection;
- evidence/source substitution rejection;
- cross-worker/cross-revision subject reuse rejection;
- exact provenance replay rejection;
- profile refresh and execution-key rotation invalidating old evidence for new admission;
- expiry/not-before handling;
- unauthorized publication rejection;
- historical records remaining immutable;
- attestation authority not gaining WorkerRegistry lifecycle authority.

## Invariant mapping

Directly strengthened:

- **CMP-INV-002/003** — provenance is bound to stable exact worker/resource identities and revisions.
- **CMP-INV-005** — provenance authority grants no custody/governance/verifier/settlement/validator/wallet authority.
- **CMP-INV-008** — accepted provenance subject cannot silently broaden after admission.
- **CMP-INV-014** — detached provenance is chain/contract/domain separated and replay-safe.
- **CMP-INV-016** — capability attestation remains explicitly separate from result correctness.
- **CMP-INV-019** — evidence cannot be consumed by another worker/revision subject.
- **CMP-INV-023** — trust/provenance remains evidence, not routing/custody/settlement authority.
- **CMP-INV-026** — historical accepted provenance is independently reconstructable.
- **CMP-INV-028/029** — resource/profile/key changes cannot silently preserve stale evidence semantics.
- **CMP-INV-030** — benchmark/TEE/inspection evidence remains general-purpose and provider-neutral.

## Deployment/publication boundary

Changing `ComputeWorkerAttestation420` changes its runtime code hash. The historical CMP-1.3.7 deployment/publication package remains historical evidence and is not rewritten here.

The canonical roadmap assigns final runtime-code-hash, deployment-descriptor, ProtocolRegistry publication, and live dependency reconciliation to **CMP-1.3.15**. CMP-1.3.11 therefore records the source/runtime change truthfully without inventing addresses, transactions, blocks, or live deployment evidence.

## Qualification gate

Before CMP-1.3.11 may be marked COMPLETE, the exact final evidence-recording head must pass:

- all required Solidity Contracts PR shards;
- 420 Integrated Qualification;
- 420Docs Qualification;
- retained WorkerRegistry/attestation/capability/WorkerSnapshot regressions;
- the new provenance adversarial tests;
- exact-current-main reconciliation.

Candidate run IDs and candidate SHA must be recorded below. If recording candidate evidence creates a new commit, the retained suite must run again on that exact evidence-recording head.

## Candidate evidence

Pending.

## Completion

**NOT YET COMPLETE** — implementation is present, but exact-head CI, evidence recording, current-main reconciliation, and final evidence-head requalification are still required.
