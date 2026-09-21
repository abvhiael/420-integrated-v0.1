# CMP-0 — Compute Market protocol specification

Status: DRAFT — implementation foundation; not production-qualified. Baseline: `main` at `277395931f5419af0728f3ea801800401a8bb336` (2026-09-21).

## Authority and compatibility

This document refines, but does not supersede, [`docs/420-COMPUTE-MARKET-V1-ARCHITECTURE.md`](../420-COMPUTE-MARKET-V1-ARCHITECTURE.md), including CMP-INV-001–030. Frozen V1 governs canonical on-chain state if labels or orchestration differ. CMP-0 creates no fixed Genesis predeploy, active registry entry, deployable contract, custody privilege or assertion of production readiness. ComputeMarket contracts become registry-resolved applications only after deployment, code-hash verification and authorized publication against the current frozen system-address map. Do not reference retired AI-RECOVERY branches as authority.

## Scope, authority and actors

420 ComputeMarket is a provider-neutral general-purpose marketplace for CPU, GPU, accelerator, proving, rendering, simulation, transcoding and batch execution. 420AI is a client; non-AI jobs have no AI dependency. Customer workloads and private datasets execute off-chain; on-chain commitments and economic entitlements are minimal and auditable. `JobOwner` is requester/payer; `ComputeWorker` is provider-bound operator; `Scheduler` is replaceable and non-authoritative; `Verifier` executes a bound policy; `Challenger` has scoped dispute authority; `DatasetProvider` and `ResultConsumer` control their own off-chain access; `Protocol` consists of canonical registries, authorization, verification and Vault-backed accounting. Combining actor roles does not combine their capabilities or grant wallet/custody rights.

## Phase roadmap and authoritative specifications

- **CMP-0.1 — Source inventory and integration verification:** [repository inventory](CMP-0.1-REPOSITORY-INVENTORY.md) and [source/integration audit](CMP-0.1-SOURCE-AND-INTEGRATION-AUDIT.md). Completed as an inventory assessment on the pinned baseline; not proof of runtime integration.
- **CMP-0.2 — Canonical ComputeJob schema:** [field ownership, write-once bindings, constraints and state validation](CMP-0.2-CANONICAL-COMPUTE-JOB-SCHEMA.md). A job can exist in `CREATED` before match/provider/resource/beneficiary are bound; these become immutable at their authorized binding moment.
- **CMP-0.3 — Deterministic work-unit identity:** [exact typed V1 unit/attempt identity and qualification gate](CMP-0.3-DETERMINISTIC-WORK-UNIT-IDENTITY.md). Domain-separated Keccak of standard ABI-encoded immutable job/manifest/partition/replica metadata; retries are attempts of the same payable unit.
- **CMP-0.4 — Signed execution manifests:** [canonical payload and request-bound EIP-712 authorization](CMP-0.4-SIGNED-EXECUTION-MANIFEST.md). Fail-closed signer/nonce/capability checks, immutable executable and resource-policy commitments, worker checks and off-chain secret boundaries.
- **CMP-0.5 — Provider, node and resource identity:** [distinct canonical identities, permanent parentage, eligibility and acceptance snapshots](CMP-0.5-PROVIDER-NODE-RESOURCE-IDENTITY.md). Operator grants, endpoint/capability revisions and suspension do not redirect already accepted economic entitlements.
- **CMP-0.6 — Offers, requests and matching:** [dual authorization, versioned constraints, atomic capacity/funding checks and immutable accepted match](CMP-0.6-OFFERS-REQUESTS-AND-MATCHING.md). Matching service proposals are non-authoritative; paid execution requires an eligible concrete resource and a bounded, funded commitment.
- **CMP-0.7–0.12:** authorized job lifecycle; Vault funding/settlement; receipts/verification; dispute/privacy/security; client/node/AI integrations; exact-head qualification and closeout. Each phase must be source grounded, separately classified as specification versus executable implementation, and preserve frozen V1 invariants.

## Canonical state and authorization

A canonical `ComputeJob` references distinct `jobId`, `requestId`, and, after authorized matching, `matchId`, `providerId` and `resourceId`; it binds the accepted manifest, workload class, input/output commitments, resource profile, deadline, replication and verification profile, accepted pricing/SLA and a bounded funding reference. Use authoritative request/match/funding records rather than redundant independently writable copies. The requester maximum may be raised only by separately authorized funding. Replication and all units must fit the *accepted aggregate* quote. Never place raw inputs, secrets, datasets, model weights or outputs on chain.

Frozen lifecycle: `CREATED -> FUNDED -> MATCHED -> ACCEPTED -> RUNNING -> RESULT_COMMITTED -> VERIFIED -> SETTLED`, with exceptional `CANCELLED`, `EXPIRED`, `FAILED`, `DISPUTED`, `REFUNDED`. Scheduler `QUEUED/ASSIGNED`, worker `SUBMITTED` and verifier `VERIFYING` are off-chain observations, not added canonical states. `REJECTED` and `SLASHED` are verification/security outcomes, not new job states. A dispute is not automatically terminal; resolution/appeal rules must be specified and tested. Every transition needs named actor, capability, prerequisite and event; no generic arbitrary state setter and no terminal-state reopening or renewed spending.

## Boundary constraints

1. Accepted matching must verify active eligible provider/node/resource, compatible offer/request and expiry, region/privacy, price/SLA, resource and verification policy versions. A scheduler cannot bypass checks or alter accepted terms.
2. Fund via an authorized, registered 420Vault custody/accounting path, native $420 as Genesis default. Reserve before paid work; bind provider beneficiary to the accepted match and preserve payer refund rights. `cancelObligation` merely frees balance inside its Vault and is not a payment to the payer. No parallel unrestricted escrow.
3. Bind verification profile before execution. Signature on a receipt proves attribution, not result correctness. Failed verification creates no provider payment unless a preaccepted objective partial-entitlement policy explicitly permits it.
4. Receipt must bind chain/domain, job, unit/attempt, provider/resource, manifest, bounded metering, output commitment and evidence reference. Reject replay, rollback, duplicate unit/replica payments and unquoted spend across attempts.
5. Dispute and any slash require scoped authorization, objective policy-bound evidence, deadlines and auditable resolution/appeal. Suspension blocks new work without confiscating earned entitlements.
6. Off-chain workers/schedulers are replaceable. Neither EVM consensus nor finality may depend on execution of customer workloads.
7. `fourtwentyd`, optional `node420 compute`, `@420/compute-sdk`, 420Compute UI and 420AI must use the same protocol only after their concrete source/module boundaries and capability scopes are verified. They are clients/operators, not alternative custody or settlement authorities.

## CMP-0 qualification gate

Inventory the current source and authority; freeze exact versioned typed schemas/encodings for request, match, job, work-unit, attempt, manifest, receipt and verification profile. Publish pinned binary test vectors in independent languages and executable Foundry/SDK parity tests. Specify lifecycle actor/capability/precondition/event matrix and negative tests (replay, double settlement, budget overflow, wrong signer/manifest/resource, partition collision, failed verification, timeout, partial payout and payer refund). Demonstrate real end-to-end funded/verified/settled/refunded paths using narrowly scoped Vault authorization and reconcile all 30 frozen CMP invariants and addresses. Run relevant contract/application checks and full repository qualification on exact latest PR head; reconcile latest main before any merge. Documentation-only CI green does not imply any of these runtime gates have been met.
