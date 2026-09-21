# CMP-0 — Compute Market protocol specification

Status: DRAFT — implementation foundation; not production-qualified.  Baseline: `main` at `277395931f5419af0728f3ea801800401a8bb336` (2026-09-21).

## Authority and compatibility

This document refines, but does not supersede, [`docs/420-COMPUTE-MARKET-V1-ARCHITECTURE.md`](../420-COMPUTE-MARKET-V1-ARCHITECTURE.md), including all CMP-INV-001–030. If the earlier roadmap's suggested naming or lifecycle conflicts with the frozen V1 architecture, the frozen V1 rules govern canonical on-chain state; orchestration steps remain off-chain sub-states only. This phase introduces no fixed Genesis predeploy, active registry entry, deployable contract, live custody path, or assertion of production readiness. ComputeMarket contracts are registry-resolved after deployment, code-hash verification, and authorized publication under the current frozen system-address map. Do not reference retired AI-RECOVERY branches or use their work as authority for this phase.

## Scope and actors

420 ComputeMarket is the general-purpose provider-neutral market for CPU, GPU, accelerator, proving, rendering, simulation, transcoding, and batch execution. 420AI is one consumer; non-AI jobs never require 420AI. Execution and private datasets remain off-chain. Canonical commitments and economic entitlements may be recorded on-chain.

Actors: `JobOwner` (requester/payer), `ComputeWorker` (provider-bound node/resource operator), `Scheduler` (replaceable, non-authoritative matcher/dispatcher), `Verifier` (bound verification profile executor), `Challenger` (authorized dispute participant), `DatasetProvider` (off-chain data access), `ResultConsumer` (authorized off-chain output access), and `Protocol` (canonical registries, authorization, verification and Vault-backed accounting). An actor may hold multiple roles, but each action must be independently authorized; worker or scheduler identity never grants custody or arbitrary wallet authority.

## CMP-0.1 — Canonical job object and state

`ComputeJob` MUST reference distinct stable `jobId`, `requestId`, `matchId`, `providerId`, `resourceId` and a bounded funding reference. JobOwner identity is derived from the canonical request; beneficiary from the accepted match. A job's immutable commitment contains: `workloadType`, `manifestHash`, `inputCommitment`, `outputSchemaHash`, `rewardPool` (or bound maximum), `deadline`, `replicationFactor`, `verificationMode` (versioned verification profile), resource requirements/profile, and accepted pricing/SLA/verification terms through its request and match. These are logical schema fields; implementation must avoid redundant writable copies that could diverge. `rewardPool` must never increase effective requester authorization without a separately authorized funding action. `replicationFactor` binds independent work-unit requirements and corresponding maximum total spend, not an implicit multiplier outside the quoted amount. Store hashes and minimal canonical metadata, never raw inputs, dataset contents, secrets, model weights, outputs or service credentials on-chain.

Canonical on-chain lifecycle, per frozen V1: `CREATED -> FUNDED -> MATCHED -> ACCEPTED -> RUNNING -> RESULT_COMMITTED -> VERIFIED -> SETTLED`; exceptional `CANCELLED`, `EXPIRED`, `FAILED`, `DISPUTED`, `REFUNDED`. No arbitrary status setter; each transition needs named actor, bounded authorization, prerequisite and event. A scheduler's `QUEUED`/`ASSIGNED`, a worker's `SUBMITTED`, and a verifier's `VERIFYING` are *off-chain orchestration observations*, not extra canonical job states. `REJECTED` and `SLASHED` describe verification/dispute or provider-security outcomes, not additions to the canonical job-state enum. `DISPUTED` is not automatically a terminal state: the eventual permitted resolution and any terminality rules must be specified and tested before implementation. No terminal job can reopen or regain spending authority.

## CMP-0.2 — Deterministic work-unit identity

Partitioning MUST bind each work unit to `chainId`, protocol/schema version, `jobId`, immutable `manifestHash`, deterministic partition index, partition count, and (where replicated) replica index. Use one specified typed, domain-separated encoding and collision-resistant hash algorithm in the implementing schema; JSON stringification, local timestamps, scheduler nonce or mutable worker identity MUST NOT determine a canonical work-unit ID. Same immutable inputs produce the same ID, distinct job/partition/replica domains distinct IDs. A retry of the same unit is a separately nonced *attempt* linked to the original unit and cannot create an additional settlement entitlement. Settle at most the authorized units/replicas under the accepted price and requester maximum. Version partition algorithms; prohibit silent changes to accepted partition semantics. Exact encoding, hash vectors, bounds, and cross-language fixtures are pending CMP-0 qualification and MUST precede production contracts.

## CMP-0.3 — Signed execution manifest

An execution manifest MUST be versioned, content-addressed and signed by the accountable authorizer with chain ID, job/request domain, expiry and anti-replay nonce. It binds workload class; runtime/ABI version; immutable image or executable digest; command/entrypoint; input commitment and authorized input locator policy; output schema hash; resource limits/profile; timeout/deadline; deterministic partition and replication specification; verification profile/version; and allowed data/output access policy. Raw secrets, access tokens, private inputs and datasets belong in authorized off-chain transport, not the manifest's public canonical state. `manifestHash` commits to the exact signed payload under a specified canonical binary encoding, not an unnormalized JSON presentation. Any post-acceptance change to economic, resource, verification or execution semantics requires a new authorized request/match/job rather than modifying the accepted manifest. A provider signature on an execution receipt proves attribution only; it does not by itself prove correct results.

## Boundary contracts to freeze before implementation

1. Match acceptance MUST check active provider/node/resource eligibility and compatibility with both offer and request, including policy versions, expiry, region/privacy constraints, quoted maximum, accepted resource and verification profile. Scheduler has no bypass authority.
2. Fund via an approved 420Vault accounting adapter using native $420 as Genesis default. Reserve required funds before paid execution, derive provider beneficiary from match, retain requester refund rights and prohibit ordinary administrator redirection. No second general-purpose escrow contract.
3. Bind a verification profile before execution. Correctness versus evidence of execution must be distinct; failed verification cannot generate provider payment unless an explicit preaccepted objective policy permits a defined partial entitlement.
4. Receipts bind chain/domain, job, unit/attempt, provider/resource, execution manifest, monotonic metering and predecessor commitment when cumulative, output commitment and verification-evidence reference. Enforce anti-replay and prevent duplicate settlement across retries/replicas.
5. Disputes/slashing need objective, policy-bound evidence, authorization, deadlines and a defined appeals/resolution state machine. Provider suspension prevents new work but does not confiscate earned entitlements.
6. Off-chain endpoints, matchers and worker execution are replaceable; consensus/finality never depends on executing customer workloads.
7. Integrate `fourtwentyd` compute routing, `node420 compute` operator functionality and `@420/compute-sdk` against this shared protocol only after their existing repository/module boundaries are inventoried. The user-facing `420Compute` application and 420AI are clients, not alternative settlement authorities.

## CMP-0 qualification gate

- Inventory current code, historical interfaces, ownership, registries, Vault primitives, deployment references, CI and test locations on the exact base branch; distinguish existing implementations from plans. Reconcile overlapping AI/ComputeMarket definitions without referencing retired recovery work as an authority.
- Publish exact versioned typed schemas for job, request, match, work-unit, attempt, execution manifest, receipt and verification profile; define canonical serialization/hashing and fixed test vectors in two independent implementations where practical.
- Publish a transition matrix of actor, capability, precondition, emitted event and permissible next state, including expiry/cancellation/refund/dispute resolution and terminality.
- Specify replay/duplicate-settlement, budget overflow, invalid signature/manifest, mismatched resource, partition collision, failed verification, timeout and emergency/funding/refund negative cases as executable tests.
- Verify against all 30 frozen CMP invariants and current Genesis address authority; run relevant contract/application checks and full repository qualification on the exact PR head, then reconcile with latest `main` before merge.

This CMP-0 document is a first protocol-specification increment. No code-level qualification, production deployment or end-to-end settlement is claimed by its creation.
