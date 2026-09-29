# CMP-1.3.13 — Canonical read model, SDK/client consumption, and off-chain compatibility

Status: **COMPLETE — exact implementation SHA qualified; evidence-only closeout recorded without recursive rerun.**

## Canonical definition

The controlling roadmap defines CMP-1.3.13 as:

> Provide stable versioned consumption surfaces for replaceable off-chain clients.

Required:

- canonical reads/descriptors for worker identity, capability profile, eligibility, attestation/Trust/stake references, execution-key metadata, capacity, and accepted-job snapshots;
- repository client/SDK helpers or equivalent machine-consumable interfaces for matchers, worker agents, indexers, and applications;
- deterministic encoding/domain constants and negative/stale-revision fixtures;
- no privileged matcher/client assumptions;
- explicit non-AI workload coverage.

Exit:

> an external client can reconstruct and validate WorkerRegistry admission/execution state from public canonical interfaces.

## Authoritative baseline

CMP-1.3.13 began only after CMP-1.3.12 was durably closed and merged.

Base/main SHA:

`003423ec34e5e0582709ffec3e417eb146538bef`

Repository evidence inspected before modification included:

- `docs/compute-market/CMP-1-IMPLEMENTATION-ROADMAP.md`;
- `docs/420-COMPUTE-MARKET-V1-ARCHITECTURE.md`;
- `docs/compute-market/CMP-1.3.8-1.3.16-WORKER-REGISTRY-GAP-AUDIT.md`;
- CMP-1.3.2–CMP-1.3.12 qualification records and retained source/tests;
- `ComputeWorkerRegistry420`;
- `ComputeWorkerCapabilityProfile420`;
- `ComputeWorkerCapabilityEligibility420`;
- `ComputeWorkerAttestation420`;
- `ComputeWorkerTrust420`;
- `ComputeWorkerStake420`;
- `ComputeWorkerCapacityReservation420`;
- `ComputeJobWorkerSnapshotEvidence420`;
- `packages/420-sdk`;
- `420-indexer` descriptor conventions;
- Solidity, Docs, Integrated, and Developer Hub workflow definitions.

## Pre-change gap analysis

Valid prior work already exposed authoritative component-specific reads, but CMP-1.3.13 remained incomplete.

### Satisfied foundations

- WorkerRegistry exposed exact current and historical worker revisions.
- CapabilityProfile exposed profile metadata and bounded canonical capability sets.
- Attestation exposed immutable attestation/provenance records.
- 420Trust and ComputeStake adapters exposed immutable historical references.
- Capacity exposed current/historical reservations and exact live counters.
- WorkerSnapshot exposed immutable assignment and attempt-lifecycle records.
- Domain-separated execution/attestation/stake/Trust/capability constants already existed on canonical contracts.
- `@420/sdk` already provided a repository-standard TypeScript package and Developer Hub qualification path.
- `420-indexer` already used repository descriptors as machine-consumable interface metadata.

### Blocking gaps

1. **No single versioned canonical read surface existed.**
   Clients had to know the complete internal contract graph and independently decide which getter was authoritative.

2. **No canonical component descriptor existed.**
   A client could not validate that worker/profile/eligibility/attestation/Trust/stake/capacity/snapshot contracts belonged to one coherent graph.

3. **No canonical domain descriptor existed.**
   Off-chain agents had to hard-code or separately discover execution, identity, provenance, Trust, stake, capacity, and accepted-constraint domains.

4. **No Compute worker SDK helper existed.**
   `@420/sdk` had network/catalogue/wallet support but no WorkerRegistry admission/execution reconstruction helper.

5. **No client-side stale-revision/attempt validation existed.**
   A replaceable client could accidentally consume a stale worker revision, stale latest attempt, or mismatched attempt root.

6. **No machine-readable WorkerRegistry read-model descriptor existed for indexers/applications.**

7. **No explicit negative/stale fixture existed for off-chain client qualification.**

8. **No explicit non-AI client fixture existed.**

9. **The shared Solidity and Developer Hub PR workflows did not explicitly checkout/verify the PR head.**
   This prevented those workflows from being used as strict exact-implementation-SHA evidence.

## Implementation

### 1. `ComputeWorkerReadModel420`

Added:

`contracts/src/compute/ComputeWorkerReadModel420.sol`

This is a read-only aggregator over canonical source contracts. It owns no mutable state and grants no authority.

Versioning:

- `READ_MODEL_SCHEMA_V1`;
- `protocolVersion() == 1`;
- `schemaVersion() == 1`.

Constructor cross-wiring verifies that all configured components resolve to the same canonical WorkerRegistry graph:

- WorkerRegistry;
- CapabilityProfile;
- CapabilityEligibility;
- Attestation;
- 420Trust worker adapter;
- ComputeStake worker adapter;
- CapacityReservation;
- WorkerSnapshot.

It rejects mismatched/cross-wired graphs.

#### Canonical component descriptor

`components()` returns the exact canonical component addresses consumed by the read model.

No caller privilege is required.

#### Canonical domain descriptor

`domains()` returns the authoritative domain constants directly from their source contracts:

- Worker identity;
- capability profile;
- attestation;
- provenance;
- Trust reference;
- stake reference;
- capacity reservation;
- accepted execution;
- result execution;
- attempt transition;
- accepted constraint.

The read model does not duplicate those hashes as independent authority.

#### Worker/capability reads

Public versioned reads include:

- current worker;
- exact worker revision;
- capability profile metadata;
- architectures;
- CPU classes;
- GPU classes;
- software capabilities.

Historical worker reads use the canonical WorkerRegistry history.

#### Eligibility read

`eligibility(EligibilityQuery)` composes public canonical new-admission predicates for:

- current worker eligibility;
- capability requirements;
- optional trusted attestation;
- optional Trust policy/reference;
- optional ComputeStake policy/reference.

The structured query avoids a large unstable flat ABI and preserves explicit exact worker revision.

The read model does not perform matching or select workers.

#### Historical evidence/reference reads

Public reads expose:

- attestation core;
- attestation provenance;
- Trust reference;
- stake reference.

These are pass-through reads from authoritative source contracts.

#### Capacity reads

Public reads expose:

- aggregate live worker/resource units;
- exact worker/resource revision units;
- latest reservation for a job and its canonical reservation record.

#### Accepted-attempt reads

Public reads expose:

- immutable root assignment;
- latest assignment;
- monotonic attempt count;
- exact assignment snapshot;
- exact attempt lifecycle.

This supports reconstruction of success/failure/retry/cancellation/expiry without client-side state invention.

### 2. `@420/sdk` Compute client

Added:

`packages/420-sdk/src/compute.ts`

and exported it from:

`packages/420-sdk/src/index.ts`.

The SDK is transport-agnostic. A matcher, worker agent, indexer, application, RPC adapter, or other replaceable off-chain consumer supplies a `ComputeWorkerReader420` implementation.

The SDK provides:

- canonical method-signature inventory;
- schema/version constants;
- typed component/domain descriptors;
- typed worker/capability/eligibility/capacity/attempt models;
- exact worker-revision validation;
- capability-profile-to-worker-commitment validation;
- accepted-attempt root/latest/count validation;
- stale-attempt rejection;
- malformed bytes32/address rejection;
- helper reconstruction for worker+capability state;
- helper reconstruction for accepted attempts;
- direct helpers for attestation, Trust, stake, capacity, and eligibility.

No SDK API assumes a privileged matcher or trusted indexer.

### 3. Machine-consumable descriptor

Added:

`420-indexer/descriptors/compute-worker-read-model-v1.json`

It records:

- schema/version identity;
- contract/protocol identity;
- exact canonical method signatures;
- canonical domain-source contracts;
- supported consumer classes:
  - matcher;
  - worker agent;
  - indexer;
  - application;
- `callerPrivilegesRequired: false`;
- explicit non-AI workload coverage;
- truthful publication status.

No deployment address is fabricated. Live publication remains deferred to CMP-1.3.15.

### 4. Negative/stale client fixtures

Added:

`packages/420-sdk/test/fixtures/compute-worker-read-model-v1.json`

Fixtures include:

- valid exact worker revision;
- stale expected-vs-actual worker revision;
- malformed public attestation reference;
- explicit non-AI `VIDEO_TRANSCODE` workload.

### 5. Exact-head CI hardening

Updated:

- `.github/workflows/contracts-foundry.yml`;
- `.github/workflows/developer-hub.yml`.

For pull requests these workflows now:

1. checkout `github.event.pull_request.head.sha`;
2. verify `git rev-parse HEAD` equals that SHA;
3. only then execute Solidity or SDK/client qualification.

This makes both full Solidity and client compatibility results valid evidence for the exact implementation SHA rather than the synthetic PR merge ref.

## Qualification coverage

### Solidity

Added:

`contracts/test/ComputeWorkerReadModel420.t.sol`

The test builds a real canonical graph including:

- Provider/Node/Resource registries;
- ComputeAuthorization;
- WorkerRegistry;
- CapabilityProfile;
- Attestation + AttestedEligibility;
- CapabilityEligibility;
- 420Trust worker adapter with canonical metric source mock;
- ComputeStake worker adapter with source-interface mock;
- CapacityReservation;
- WorkerSnapshot;
- JobRegistry;
- accepted match/job state.

Coverage includes:

- descriptor/schema version;
- component graph addresses;
- domain-source parity;
- exact worker historical read;
- capability profile metadata and sets;
- attestation/provenance reads;
- Trust reference read;
- stake reference read;
- aggregate/exact capacity reads;
- job reservation reconstruction;
- root/latest/attempt-count reconstruction;
- assignment/lifecycle reconstruction;
- valid composed eligibility;
- stale worker revision fail-closed behavior;
- public caller equivalence;
- constructor cross-wiring rejection;
- explicit non-AI accepted job reconstruction.

### SDK/client

Added:

`packages/420-sdk/test/compute-sdk.test.mjs`

Coverage includes:

- deterministic method inventory;
- schema/component/domain validation;
- worker+capability reconstruction;
- stale worker revision rejection;
- latest attempt reconstruction;
- stale attempt/root-drift rejection;
- malformed reference rejection;
- repository descriptor parity;
- machine-readable negative/stale fixture consumption;
- explicit `VIDEO_TRANSCODE` admission with no AI-specific assumption.

## Security and authority boundaries

CMP-1.3.13 is read-only.

It does not:

- register, activate, suspend, retire, refresh, or rotate workers;
- reserve/release/fail/expire capacity;
- create matches;
- select workers;
- create/transition jobs;
- prove result correctness;
- move Vault funds;
- settle/refund work;
- grant governance/verifier/stake/slash/bridge/validator/wallet authority;
- trust an indexer or matcher as canonical state;
- convert historical references into live admission authority.

Off-chain indexes remain accelerators. Canonical validation comes from public on-chain interfaces.

## Determinism and compatibility

The canonical compatibility contract is defined by:

- read-model schema version;
- canonical method signatures;
- canonical component addresses;
- source-contract domain constants;
- exact worker/resource revisions;
- exact immutable reference IDs;
- exact root/latest attempt relationships.

A replaceable client may use any RPC/indexer implementation provided it reconstructs and validates those canonical values.

## Non-AI workload coverage

The Solidity and SDK suites explicitly use:

`VIDEO_TRANSCODE`

This verifies the WorkerRegistry consumption model remains general-purpose and does not require 420AI, AI model IDs, inference semantics, GPU-only semantics, or AI-specific client authority.

## Deployment/publication boundary

This step adds new runtime bytecode for `ComputeWorkerReadModel420` and changes no frozen live deployment claim.

CMP-1.3.15 remains responsible for:

- release-candidate wiring;
- runtime code-hash manifests;
- deployment descriptors;
- ProtocolRegistry publication requirements;
- truthful live dependency/public-testnet reconciliation.

The descriptor therefore records no fabricated deployment address.

## Qualification gate

Before COMPLETE, the exact qualification-relevant implementation SHA must pass:

- Solidity Contracts — all 16 required exact-head PR shards;
- 420 Integrated Qualification;
- 420Docs Qualification;
- 420 Developer Hub exact-head SDK/client tests;
- focused `ComputeWorkerReadModel420` tests;
- retained WorkerRegistry/capability/attestation/Trust/stake/capacity/WorkerSnapshot regressions;
- current-main reconciliation review.

A later documentation-only evidence commit may inherit the qualified implementation SHA under the repository evidence-only rule. Any implementation/test/config/workflow/dependency/substantive-requirement change requires fresh exact-head qualification.

## Qualified implementation evidence

Qualified implementation SHA:

`17ef0fba5c939aa164de63b909fd3c477f74d373`

Base/main SHA:

`003423ec34e5e0582709ffec3e417eb146538bef`

Current-main reconciliation immediately before closeout:

- current `main` remained exactly `003423ec34e5e0582709ffec3e417eb146538bef`;
- branch was ahead only and 0 commits behind;
- no qualification-affecting reconciliation commit was required.

Exact-SHA qualification:

- Solidity Contracts #3342 — run `36628977382` — **SUCCESS**, all 16 required PR shards passed; aggregate `foundry` wrapper skipped by workflow design;
- 420 Integrated Qualification #5979 — run `36628977470` — **SUCCESS**;
- 420Docs Qualification #3355 — run `36628977375` — **SUCCESS**;
- 420 Developer Hub #271 — run `36628977605` — **SUCCESS**;
- 420Indexer #962 — run `36628977429` — **SUCCESS**;
- 420Indexer #557 — run `36628977307` — **SUCCESS**.

The earlier Solidity #3341 run targeted pre-final SHA `9b50386571adf7219d4e0040dec0317af1cd5b43` and contained a shard failure. It is intentionally superseded and is not used as qualification evidence for CMP-1.3.13.

The documentation-only evidence commit containing this section does not change contracts, tests, SDK/client behavior, descriptors, workflows, dependencies, or substantive CMP-1.3.13 requirements and therefore inherits the qualified implementation SHA under the repository evidence-only rule.

## Completion

**COMPLETE** — every canonical CMP-1.3.13 requirement and exit criterion is satisfied at implementation SHA `17ef0fba5c939aa164de63b909fd3c477f74d373`. External replaceable clients can reconstruct and validate WorkerRegistry admission/execution state from public canonical interfaces without privileged matcher/client assumptions. Live release-candidate deployment/code-hash publication remains correctly deferred to CMP-1.3.15.
