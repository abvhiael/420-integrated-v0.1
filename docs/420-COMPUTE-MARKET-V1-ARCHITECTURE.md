# 420 ComputeMarket V1 Architecture

Status: **FROZEN FOR IMPLEMENTATION**

420 ComputeMarket is the shared decentralized market for off-chain CPU, GPU, accelerator, proving, rendering, simulation, transcoding, and batch-compute resources in the 420 Integrated ecosystem. It is consumed by 420AI but is not owned by or limited to AI workloads.

## Core architecture rule

ComputeMarket canonicalizes provider/resource identity, capability declarations, offers, requests, matches, execution jobs, receipts, verification profiles, settlement entitlements, dispute evidence, and lifecycle state. Actual computation occurs off-chain.

A requester authorizes bounded economic terms. Providers publish capacity and pricing. Matching may occur off-chain or through approved mechanisms, but the accepted match and all economically material terms become canonical before execution can create settlement rights.

## Canonical objects

### ComputeProvider

Stable economic/operator identity.

Minimum fields:
- `providerId`
- operator account
- provider manifest hash
- stake reference
- settlement account/reference
- createdAt
- revision
- state

Lifecycle:
`REGISTERED -> ACTIVE <-> SUSPENDED -> RETIRED`

ACTIVE requires valid stake/security configuration under the bound provider policy. RETIRED is terminal.

### ComputeNode

Stable execution-node identity bound permanently to one provider.

Minimum fields:
- `nodeId`
- `providerId`
- operator account
- node manifest hash
- endpoint/service manifest hash
- endpoint expiry
- createdAt
- revision
- state

A node identity cannot silently move between providers.

### ComputeResource

Declared execution resource attached to a node.

Minimum fields:
- `resourceId`
- `providerId`
- `nodeId`
- compute class
- hardware/profile manifest hash
- memory/capacity declarations where canonicalized
- runtime profile ID
- capability bitmap/reference
- availability state
- createdAt
- revision

Initial canonical compute classes:
- `CPU_GENERAL`
- `GPU_INFERENCE`
- `GPU_TRAINING`
- `GPU_RENDER`
- `ACCELERATOR_GENERAL`
- `ZK_PROVER`
- `HIGH_MEMORY`

Specific commercial hardware names are metadata/profile facts, not consensus-critical enum values.

### ComputeOffer

Provider-published capacity/price commitment.

Minimum fields:
- `offerId`
- `providerId`
- `resourceId` or resource class
- capacity/service-unit definition
- pricing policy ID
- minimum/maximum job constraints
- availability window
- region/policy constraints
- SLA policy ID
- verification compatibility profile
- expiry
- state

Material offer semantics cannot silently broaden after acceptance.

### ComputeRequest

Requester-declared workload/economic requirement.

Minimum fields:
- `requestId`
- requester
- workload class
- resource requirement ID/profile
- input commitment
- maximum authorized spend
- deadline/expiry
- privacy policy ID
- verification profile ID
- provider/resource constraints
- funding reference
- createdAt
- state

### ComputeMatch

Immutable accepted binding between request and offer/provider/resource.

Minimum fields:
- `matchId`
- `requestId`
- `offerId`
- `providerId`
- `resourceId`
- accepted pricing policy/version
- accepted maximum/quoted amount
- SLA profile
- verification profile
- acceptedAt

A match freezes economically material terms for the resulting job.

### ComputeJob

Canonical execution state machine.

Normative lifecycle:
`CREATED -> FUNDED -> MATCHED -> ACCEPTED -> RUNNING -> RESULT_COMMITTED -> VERIFIED -> SETTLED`

Exceptional states:
- `CANCELLED`
- `EXPIRED`
- `FAILED`
- `DISPUTED`
- `REFUNDED`

No generic arbitrary-status setter is permitted.

### ComputeReceipt

Provider-signed execution/metering commitment.

Minimum fields:
- `receiptId`
- `jobId`
- `providerId`
- `resourceId`
- sequence/execution nonce
- prior receipt hash
- startedAt/completedAt or bounded execution interval
- cumulative or final metered units
- cumulative/final charge
- output/result commitment
- execution manifest hash
- verification-evidence reference
- signer domain

Receipts are replay-safe, monotonic where cumulative, and domain-separated.

### ComputeSettlement

Canonical economic result.

Minimum fields:
- `settlementId`
- `jobId`
- payer/funding reference
- provider beneficiary derived from accepted match
- gross authorized amount
- earned amount
- refundable/unused amount
- verification/dispute outcome reference
- settledAt
- terminal state

Settlement recipient is derived from canonical state and is never supplied arbitrarily by governance.

## Workload classes

Initial general namespace may include:
- `COMPUTE_AI_INFERENCE`
- `COMPUTE_AI_TRAINING`
- `COMPUTE_RENDER`
- `COMPUTE_ZK_PROVING`
- `COMPUTE_SIMULATION`
- `COMPUTE_TRANSCODE`
- `COMPUTE_BATCH_GENERAL`
- `COMPUTE_CUSTOM_VERSIONED`

Custom workloads require explicit versioned schemas/policies and may not bypass authorization, verification, or settlement invariants.

## Matching modes

### Direct match
Requester chooses an explicit active offer/provider/resource.

### Open-market match
Requester publishes constraints and compatible providers compete or are selected by a replaceable matching service.

Matching software is non-canonical. A canonical accepted match must satisfy all request and offer constraints. No hidden privileged matcher may broaden either side's constraints.

## Authorization

ComputeMarket uses the shared 420 Capability Registry / programmable smart-account model.

Capabilities must be narrowly scoped by action and object, such as:
- provider registration/update/status
- node/resource registration/update/status
- offer publication/cancellation
- request creation/funding/cancellation
- match acceptance
- receipt submission
- verification action
- dispute action
- settlement action

Session/request funding capabilities carry an explicit maximum amount. Provider/node/operator authority never implies custody, governance, validator, bridge, or arbitrary wallet execution authority.

## Funding and 420Vault

Native `$420` is the Genesis default settlement asset.

ComputeMarket should use 420Vault/approved Vault accounting primitives for new custody rather than inventing a second general escrow system.

Required accounting properties:
- funds reserved before paid execution begins where policy requires;
- provider entitlement becomes claimable only through a valid settlement/verification path;
- ordinary administrators cannot redirect escrow;
- unused funded value remains refundable/claimable by the requester;
- obligations are replay-safe and reconstructable;
- emergency state cannot confiscate or redirect valid balances.

## Pricing profiles

Versioned pricing classes may include:
- `FIXED_JOB`
- `PER_SECOND`
- `PER_CPU_SECOND`
- `PER_GPU_SECOND`
- `PER_COMPUTE_UNIT`
- `PER_INPUT_UNIT`
- `PER_OUTPUT_UNIT`
- `BATCH_AUCTION`
- `SEALED_BID`
- `CUSTOM_VERSIONED`

A bound formula must be deterministic enough to reconstruct settlement. No settlement may exceed the requester's authorized maximum.

## Verification profiles

Correctness and execution evidence are separate.

Initial classes:
- `REQUESTER_ACK`
- `DETERMINISTIC_REEXECUTION`
- `QUORUM_ATTESTATION`
- `TEE_ATTESTATION`
- `ZK_PROOF`
- `ORACLE_VERIFICATION`
- `APPLICATION_VERIFIER`

A receipt or provider signature is evidence of a signed claim, not universal proof of correct computation.

## Staking and slashing

Stake protects against narrowly defined objectively provable misconduct.

Potential slashable conditions:
- forged receipts
- duplicate/double settlement attempts
- conflicting signed execution commitments
- provider/resource identity fraud
- provable attestation fraud
- objectively defined accepted-job nonperformance

Subjective output quality is not slashable unless a bound objective verifier converts it into a defined protocol condition.

## Trust integration

420Trust stores authenticated compute performance evidence such as:
- jobs accepted/completed
- objective failures
- latency/execution-time bands
- SLA adherence
- dispute outcomes
- verification successes/failures
- slashing history
- settlement failures

No universal provider score is canonical.

## Privacy and data availability

Raw workloads, private inputs, datasets, source files, generated outputs, secrets, model weights, and endpoint credentials remain off-chain unless independently public by user choice.

Canonical state stores only the minimum commitments needed for authorization, matching, verification, settlement, dispute handling, and reconstructability.

Off-chain manifests must be signed/versioned/content-addressed where their semantics affect eligibility or settlement.

## Emergency behavior

Emergency authority may halt narrowly defined new actions, such as new provider activation, offers, matching, job acceptance, or unsafe verifier routes.

It may not:
- redirect escrow or provider earnings;
- fabricate receipts or verification outcomes;
- change accepted economic terms;
- reassign provider/resource identity;
- reveal private workload contents;
- reopen terminal jobs.

## Proposed V1 contract/module structure

```text
contracts/src/compute/
ComputeIds420.sol
ComputeAuthorization420.sol
ComputePolicyRegistry420.sol
ComputeProviderRegistry420.sol
ComputeNodeRegistry420.sol
ComputeResourceRegistry420.sol
ComputeOfferRegistry420.sol
ComputeRequestRegistry420.sol
ComputeMatch420.sol
ComputeJobRegistry420.sol
ComputeReceiptRegistry420.sol
ComputeVerificationRouter420.sol
ComputeSettlement420.sol
ComputeDispute420.sol
ComputeRouter420.sol
ICompute420.sol
```

No new frozen Genesis predeploy address is allocated by this architecture. ComputeMarket contracts should be discovered through ProtocolRegistry unless a later explicit Genesis decision allocates addresses.

## Frozen V1 invariants

- **CMP-INV-001:** actual compute execution occurs off-chain and is never required for consensus/finality.
- **CMP-INV-002:** provider, node, resource, offer, request, match, job, receipt, and settlement identities are distinct and stable.
- **CMP-INV-003:** canonical IDs are never reassigned to different entities.
- **CMP-INV-004:** node identity cannot silently move between providers.
- **CMP-INV-005:** provider/resource registration grants no custody, validator, governance, bridge, or arbitrary wallet authority.
- **CMP-INV-006:** request funding authorization is amount-bounded and object-scoped.
- **CMP-INV-007:** no match may broaden requester constraints or provider offer constraints.
- **CMP-INV-008:** accepted economically material terms cannot silently change after matching.
- **CMP-INV-009:** no provider can settle above the requester-authorized maximum.
- **CMP-INV-010:** settlement beneficiary derives from the accepted canonical provider/match, never an arbitrary administrator argument.
- **CMP-INV-011:** unused funded value remains recoverable by the requester under the bound policy.
- **CMP-INV-012:** no generic administrator can arbitrarily assign job lifecycle state.
- **CMP-INV-013:** terminal jobs cannot reopen or regain spend authority.
- **CMP-INV-014:** receipts are domain-separated and replay-safe.
- **CMP-INV-015:** cumulative receipts are monotonic and chain-linked where cumulative metering is used.
- **CMP-INV-016:** a receipt/provider signature alone is not represented as proof of correctness.
- **CMP-INV-017:** verification semantics are explicit, versioned, and bound before they can authorize settlement.
- **CMP-INV-018:** duplicate settlement of a job/receipt entitlement is impossible.
- **CMP-INV-019:** one provider/hop/resource entitlement cannot consume another party's committed entitlement.
- **CMP-INV-020:** provider suspension can stop new work but cannot confiscate already-earned valid settlement.
- **CMP-INV-021:** provider stake moves only through defined stake/withdraw/slash paths.
- **CMP-INV-022:** slashing requires objective evidence under a bound versioned policy.
- **CMP-INV-023:** 420Trust evidence is separable from routing, matching, custody, and settlement authority.
- **CMP-INV-024:** raw private workload data is never required canonical plaintext state.
- **CMP-INV-025:** emergency powers are non-confiscatory and cannot redirect balances or earnings.
- **CMP-INV-026:** accepted jobs remain reconstructable from canonical request/match/job/receipt/verification/settlement state plus committed specifications/manifests.
- **CMP-INV-027:** off-chain matching services are replaceable and have no hidden privilege to violate canonical constraints.
- **CMP-INV-028:** resource capability declarations cannot silently mutate in a way that broadens already-accepted job semantics.
- **CMP-INV-029:** endpoint/manifest replacement cannot change provider/resource/economic identity already bound to an accepted job.
- **CMP-INV-030:** ComputeMarket remains general-purpose and cannot require 420AI participation for non-AI workloads.

## Implementation order

1. `ComputeIds420.sol` and `ComputeAuthorization420.sol`.
2. `ComputePolicyRegistry420.sol`.
3. provider/node/resource registries and operational-status semantics.
4. offer/request registries.
5. immutable matching.
6. strict job lifecycle.
7. Vault-backed funding/obligation adapter.
8. receipt registry and replay protection.
9. verification router/profiles.
10. settlement and refunds.
11. dispute/emergency paths.
12. 420Trust evidence adapter.
13. 420AI adapter integration.
