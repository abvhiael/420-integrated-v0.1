# CMP-1.3.8–CMP-1.3.16 WorkerRegistry gap audit

Status: **AUDIT COMPLETE; NEW ROADMAP AUTHORIZED; NO CMP-1.3.8 IMPLEMENTATION PERFORMED**

Audit baseline: current `main` at `eb417aea38f454c2c01b672e0d566e0da17a87bd` on 2026-09-28.

## Authority and provenance

The historical literal CMP-1.3.8–CMP-1.3.16 wording remains unrecovered. This audit therefore does not claim to reconstruct it. It derives a new authoritative continuation from current repository evidence.

Audited authorities:
- `docs/420-COMPUTE-MARKET-V1-ARCHITECTURE.md`;
- `docs/compute-market/CMP-1-IMPLEMENTATION-ROADMAP.md`;
- `docs/compute-market/CMP-1.3.0-WORKER-REGISTRY-BASELINE-AND-INTEGRATION-DESIGN.md`;
- current CMP-1.3.1–CMP-1.3.7 WorkerRegistry contracts, tests, qualification records, deployment evidence, and recovery records;
- frozen `CMP-INV-001`–`CMP-INV-030`;
- current authorization, provider/node/resource, accepted-job, Trust, stake-binding, and wiring surfaces.

## Retained implementation confirmed

The repository already contains stable worker identity/revisions, immutable provider/node/resource ancestry, execution-key possession proof, fail-closed parent/resource eligibility, canonical capability profiles, provider-neutral capability attestation, policy-scoped Trust references, typed future CMP-1.5 stake binding, immutable accepted-job worker snapshots, and a deployment/code-hash/publication-readiness package. These remain valid historical work and are not renumbered.

## Remaining gaps

### GAP-A — mutation-time capability authorization

The baseline requires narrowly scoped mutation authorization. `ComputeWorkerRegistry420` currently gates its core mutations primarily by direct operator/governance identity, without the complete shared capability/delegation/revocation model required by the architecture.

Disposition: CMP-1.3.8.

### GAP-B — execution-key authority

The execution key proves possession at registration/rotation and is frozen into accepted-job evidence, but accepted assignment/result paths still fundamentally authorize the operator account. Independent policy-bound execution-key signatures with replay-safe job/attempt domains are still missing.

Disposition: CMP-1.3.9.

### GAP-C — capacity/concurrency

`ComputeResourceRegistry420` advertises capacity but deliberately is not a reservation engine. Current WorkerRegistry admission/snapshot logic does not reserve worker capacity or prevent concurrent over-admission.

Disposition: CMP-1.3.10.

### GAP-D — attestation provenance

Current attestation binds policy/evidence hash/attester and exact worker/resource/profile/key state, but the evidence hash is opaque. Eligibility-affecting off-chain benchmark/TEE/inspection evidence needs stronger schema/source/issuer provenance while remaining separate from result correctness.

Disposition: CMP-1.3.11.

### GAP-E — complete attempt lifecycle

The current accepted-job snapshot is immutable and replay-protected but intentionally single-attempt. Retry/failure/cancellation/expiry composition with execution-key signatures and capacity reservations is not complete.

Disposition: CMP-1.3.12.

### GAP-F — off-chain consumption

Solidity read surfaces exist, but there is no clearly qualified WorkerRegistry client/SDK/read-model package spanning identity, capabilities, evidence references, key domains, capacity, and snapshots for replaceable matchers/agents/indexers/apps.

Disposition: CMP-1.3.13.

### GAP-G — consolidated invariant campaign

Dedicated component tests are substantial, but the final hardened graph lacks one explicit cross-component adversarial qualification campaign mapping every applicable frozen CMP invariant and failure-atomicity/authority-separation case.

Disposition: CMP-1.3.14.

### GAP-H — release-candidate evidence refresh

CMP-1.3.7 qualified the graph that existed then. Substantive 1.3.8–1.3.14 changes will make those code hashes/wiring descriptors stale and require refreshed exact-head qualification and publication readiness evidence.

Disposition: CMP-1.3.15.

### GAP-I — final closeout

The preserved deferred-closeout material remains useful but belongs after substantive hardening and release-candidate reconciliation.

Disposition: CMP-1.3.16.

## New authoritative sequence

1. CMP-1.3.8 — mutation-time capability authorization and delegated worker authority.
2. CMP-1.3.9 — independent execution-key authorization and replay-safe worker signing.
3. CMP-1.3.10 — worker capacity reservation and concurrency semantics.
4. CMP-1.3.11 — hardware/benchmark/TEE/inspection provenance hardening.
5. CMP-1.3.12 — accepted-job worker invariant hardening and attempt lifecycle.
6. CMP-1.3.13 — canonical read model, SDK/client consumption, and off-chain compatibility.
7. CMP-1.3.14 — cross-component adversarial and invariant qualification.
8. CMP-1.3.15 — release-candidate wiring, publication readiness, and dependency reconciliation.
9. CMP-1.3.16 — WorkerRegistry phase closeout, reconciliation, and retained evidence.

## Frozen boundaries

The new roadmap does not alter these rules:
- ComputeMarket remains provider-neutral, general-purpose, and independent of mandatory 420AI participation;
- WorkerRegistry owns no Vault custody, settlement, verifier correctness, slash execution, governance, bridge, validator, or arbitrary wallet authority;
- 420Trust remains evidence, not a universal score;
- CMP-1.5 remains compute collateral/stake/slash/reward authority;
- validator stake, wallet balance, and payer escrow are not compute collateral;
- no new fixed Genesis predeploy address is allocated;
- ProtocolRegistry remains the discovery/publication path absent a later explicit Genesis decision;
- no live deployment or operational evidence may be fabricated.

## Audit exit

This audit is complete because the live `main` state was inspected, gaps were evidence-derived, the new roadmap is explicit, the lost historical wording is not falsely represented as recovered, deferred closeout is assigned to CMP-1.3.16 without executing it, and no CMP-1.3.8 implementation was started.
