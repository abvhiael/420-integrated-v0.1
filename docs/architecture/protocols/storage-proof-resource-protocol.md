---
title: Storage Proof & Resource Protocol
component: 420 Resource Protocol / 420Store
audience:
  - developer
  - architect
  - operator
category: architecture
status: current
version: current
---

# Storage Proof & Resource Protocol

The **420 Resource Protocol** is the canonical coordination layer for provider-backed Relay, Store, Cache, and Gateway services. **420Store** extends it with canonical storage capacity, agreements, commitments, proof policy/receipts, object manifests, repair-safe placement replacement, and proof-window settlement.

Encrypted payloads, shards, cache contents, relay traffic, Gateway execution, Repair workers, provider filesystems, SDK state, and application presentation remain off-chain or derived.

The core authority rule is: **a provider may deliver and prove a qualified service without becoming consensus, execution, governance, wallet, identity, content, or arbitrary settlement authority.**

## Public protocol family

The frozen canonical Resource Protocol service classes are:

- **420Relay** — encrypted routing and metered relay bandwidth;
- **420Store** — durable encrypted storage;
- **420Cache** — cache/CDN/retrieval bandwidth;
- **420Gateway** — public/private access gateway.

The runtime capability named `repair` is **420Repair**, an operational recovery layer over 420Store. It is not a fifth canonical Resource Protocol service ID.

## Canonical authority map

| State or decision | Canonical owner |
| --- | --- |
| Resource service policy | `ResourcePolicyRegistry420` |
| Provider identity/lifecycle | `ResourceProviderRegistry420` |
| Node identity/service class/lifecycle | `ResourceNodeRegistry420` |
| Offer terms/pricing | `ResourceOfferRegistry420` |
| Provider/node/session/proof-scheme permissions | `ResourceAuthorization420` + `CapabilityRegistry420` |
| Consumer resource sessions | `ResourceSessionRegistry420` |
| Metering receipts | `ResourceReceiptRegistry420` |
| Route eligibility predicates | `ResourceRouter420` |
| Store capacity/reservations | `StorageCapacityRegistry420` |
| Store agreement lifecycle | `StorageAgreementRegistry420` |
| Immutable storage commitment | `StorageCommitmentRegistry420` |
| Proof-scheme policy/verifier | `StorageProofSchemeRegistry420` |
| Accepted proof receipts | `StorageProofRegistry420` |
| Object manifest/shard placements | `StorageObjectManifestRegistry420` |
| Store proof-window settlement | `StorageSettlementRegistry420` + 420Vault |
| Payload/shard bytes | off-chain provider infrastructure |

Wallet, UI, Indexer, Explorer, Search, Analytics, Status, Gateway, Cache, Repair, or SDK output may present or derive these values but cannot override the owning contract.

## Permissions and CapabilityRegistry scopes

`ResourceAuthorization420` delegates authorization decisions to `CapabilityRegistry420` and domain-separates grants by scope:

- provider scope: provider ID;
- node scope: provider ID + node ID;
- session scope: session ID;
- proof-scheme scope: storage proof-scheme ID.

Resource action identifiers include `REGISTER_PROVIDER`, `UPDATE_PROVIDER`, `SET_PROVIDER_STATE`, `REGISTER_NODE`, `UPDATE_NODE`, `SET_NODE_STATE`, `PUBLISH_OFFER`, `OPEN_SESSION`, `SUBMIT_RECEIPT`, and `SETTLE`.

Storage action identifiers include `CONFIGURE_CAPACITY`, `RESERVE_CAPACITY`, `REGISTER_PROOF_SCHEME`, `SET_PROOF_SCHEME_STATE`, `REGISTER_STORAGE_COMMITMENT`, and `ACCEPT_STORAGE_AGREEMENT`.

Not every identifier implies a direct public mutator on every contract; the public methods described below are authoritative for current behavior.

## Resource policy

`ResourcePolicyRegistry420` is governance-controlled. A service policy binds `termsHash`, `maxSessionSeconds`, `maxUnits`, revision, and active state. Only the four frozen Resource service IDs are valid.

Event: `PolicyConfigured(serviceId, termsHash, maxSessionSeconds, maxUnits, revision, active)`.

Errors: `InvalidPolicy()`, `PolicyNotFound()`.

## Provider lifecycle

`ResourceProviderRegistry420` uses `NONE`, `REGISTERED`, `ACTIVE`, `SUSPENDED`, `RETIRED`.

Implemented transitions are `REGISTERED → ACTIVE|RETIRED`, `ACTIVE → SUSPENDED|RETIRED`, and `SUSPENDED → ACTIVE|RETIRED`. Activation requires a nonzero `stakeRef`. Metadata/stake references may be updated only while the provider is neither ACTIVE nor RETIRED.

Events: `ProviderRegistered(providerId, operatorAccount, stakeRef)`, `ProviderStateChanged(providerId, state)`.

Errors: `InvalidProvider()`, `ProviderExists()`, `ProviderNotFound()`, `Unauthorized()`, `InvalidState()`, `StakeRequired()`.

## Node lifecycle

`ResourceNodeRegistry420` uses `NONE`, `REGISTERED`, `ACTIVE`, `SUSPENDED`, `RETIRED` with the same bounded transition pattern as providers. A node is permanently bound at registration to one provider, one canonical service class, one operator, an endpoint hash, and a capacity hash. Activation requires the owning provider to be ACTIVE.

Events: `NodeRegistered(nodeId, providerId, serviceId)`, `NodeStateChanged(nodeId, state)`.

Errors: `InvalidNode()`, `NodeExists()`, `NodeNotFound()`, `Unauthorized()`, `InvalidState()`.

## Offers and pricing

`ResourceOfferRegistry420` binds an offer to a qualified node and snapshots service ID, `unitPrice420`, `maxUnits`, `termsHash`, optional `validUntil`, and active/existence state. Publishing requires a valid active node/service, active policy, and provider-operator or node-scoped offer-publication authority.

An offer is effective only while its own state/expiry, node eligibility, and service policy remain effective. The current contract emits no offer event.

Errors: `InvalidOffer()`, `OfferExists()`, `Unauthorized()`.

## General Resource sessions

`ResourceSessionRegistry420` defines `NONE`, `OPEN`, `CLOSED`, `SETTLED`, `CANCELLED`.

Current implemented flow:

1. consumer opens a session against an effective offer;
2. protocol computes `maxSpend420 = maxUnits × unitPrice420`;
3. consumer may close an OPEN session;
4. an actor with session-scoped `SETTLE` authority may mark the CLOSED session settled if the amount does not exceed `maxSpend420`.

The current implementation does **not** expose a public cancellation method despite the enum containing `CANCELLED`; documentation must not imply otherwise. The current contract emits no session events.

Errors: `InvalidSession()`, `SessionExists()`, `Unauthorized()`, `InvalidState()`.

## Metering receipts

`ResourceReceiptRegistry420` accepts deterministic cumulative usage receipts from the node operator for an OPEN session. Cumulative units must be monotonic and cannot exceed the session cap. The provider cannot increase spend authority merely by claiming more work.

The current contract emits no receipt event.

Errors: `InvalidReceipt()`, `ReceiptExists()`, `Unauthorized()`.

## Resource router

`ResourceRouter420` is read-only. `canRoute(nodeId, serviceId)` checks active policy and node eligibility; `canOpen(offerId)` checks effective offer state. It does not move value, open sessions, select a canonical provider, or create routing authority.

## Storage proof classes

V1 recognizes exactly `REPLICA_COMMITMENT`, `AVAILABILITY_WINDOW`, and `AUDIT_RESPONSE`.

Proof computation may occur off-chain or in specialized verifier infrastructure. Canonical chain state stores verifier policy, immutable commitment identity, challenge replay state, proof digest/receipt metadata, and settlement consequences.

## Proof-scheme registry

`StorageProofSchemeRegistry420` stores verifier, proof class, specification hash, maximum proof delay, and active state for each immutable scheme ID. Registering/changing state requires exact proof-scheme-scoped authority. New verifier semantics require a new scheme ID.

Events: `StorageProofSchemeRegistered(...)`, `StorageProofSchemeStateChanged(proofSchemeId, active)`.

Errors: `ZeroAddress()`, `InvalidScheme()`, `SchemeExists()`, `SchemeNotFound()`, `Unauthorized()`, `NoChange()`.

## Store capacity and reservations

`StorageCapacityRegistry420` records per-Store-node canonical capacity and deterministic agreement-bound reservations. Configuration requires an active Store node and operator or scoped capacity authority. Total bytes cannot be reduced below reserved bytes.

Reservation requires an active Store node, nonzero agreement/size, future release time, authorization, and enough unreserved canonical capacity. Reservation ID is derived from node + agreement and is single-use. Release is allowed only after `releaseAfter`.

Events: `StorageCapacityConfigured(...)`, `StorageCapacityReserved(...)`, `StorageCapacityReleased(...)`.

Errors: `ZeroAddress()`, `InvalidCapacity()`, `CapacityNotFound()`, `ReservationNotFound()`, `ReservationExists()`, `InsufficientCapacity()`, `InvalidStoreNode()`, `Unauthorized()`, `ReservationLocked()`.

## Immutable storage commitments

`StorageCommitmentRegistry420` binds provider, Store node, proof scheme, content root, replica root, metadata hash, byte size, and service interval. Registration requires a unique commitment ID, active scheme, active Store node, valid interval, and provider/node operator or scoped authority.

A live commitment additionally requires current Store-node eligibility and active proof scheme. Historical commitment fields are never rewritten to follow later repair/provider replacement.

Event: `StorageCommitmentRegistered(...)`.

Errors: `ZeroAddress()`, `InvalidCommitment()`, `CommitmentExists()`, `CommitmentNotFound()`, `InvalidStoreNode()`, `InactiveProofScheme()`, `Unauthorized()`.

## Storage agreement lifecycle

`StorageAgreementRegistry420` implements `NONE`, `PROPOSED`, `ACTIVE`, `COMPLETED`, `CANCELLED`.

A consumer proposes an agreement against an effective STORE offer with object/content/manifest identity, storage class, repair-policy commitment, proof scheme, size, interval, proof interval, and erasure parameters. `totalShards` is capped at **1,024** and must satisfy `totalShards >= dataShards > 0`.

Before `startTime`, activation requires qualified provider/node authority plus matching active reservation and commitment. The reservation must match node, agreement, size, and lifetime; the commitment must match provider/node, proof scheme, content root, size, and exact service interval.

Only the consumer may cancel a PROPOSED agreement. An ACTIVE agreement can be completed after `endTime`.

Events: `StorageAgreementProposed(...)`, `StorageAgreementActivated(...)`, `StorageAgreementCompleted(agreementId)`, `StorageAgreementCancelled(agreementId)`.

Errors: `ZeroAddress()`, `InvalidAgreement()`, `AgreementExists()`, `AgreementNotFound()`, `InvalidState()`, `InvalidStoreOffer()`, `InactiveProofScheme()`, `CommitmentMismatch()`, `CapacityReservationMismatch()`, `Unauthorized()`.

## Storage proof submission

`StorageProofRegistry420` caps raw proof input at **65,536 bytes**. A submitted proof must bind nonzero identifiers/epoch, a unique commitment/challenge pair, an epoch inside the commitment interval, active Store node, active proof scheme, and the scheme deadline. Early/late submissions fail; verifier revert/false fails closed; reentrancy is rejected.

On acceptance the protocol stores commitment, challenge, proof digest, challenge epoch, and submitted-at metadata. Raw proof bytes are not retained canonically.

Event: `StorageProofAccepted(...)`.

Errors: `ZeroAddress()`, `InvalidProof()`, `ProofExists()`, `ChallengeReplayed()`, `ChallengeOutsideCommitment()`, `ProofTooEarly()`, `ProofTooLate()`, `InactiveStoreNode()`, `InactiveProofScheme()`, `VerificationFailed()`, `Reentrancy()`.

Accepted proof is evidence for one bound challenge. It does not itself move funds.

## Object manifests and shard placements

`StorageObjectManifestRegistry420` anchors controller, object/content identity, manifest/encryption/erasure commitments, object size, segment count, erasure threshold, total shards, placement count, and sealed state.

Each placement binds one manifest/index to an active agreement, commitment, node, shard root, and shard byte length. Backing agreement must belong to the manifest controller and match object/manifest/erasure parameters.

A manifest cannot be sealed until every declared shard index has a placement. After sealing, its content envelope is immutable.

`isRetrievable` returns true only when the manifest is sealed and at least `dataShards` placements remain backed by effective agreements/live commitments. Sealing and current retrievability are different concepts.

### Repair-safe replacement

`replacePlacement` is available only on sealed manifests to the manifest controller. The incumbent service window must have begun and incumbent placement must no longer be effective. Replacement preserves placement ID, manifest ID, shard index, shard root, and shard byte length while rotating backing agreement/commitment/node through valid state.

Events: `ObjectManifestRegistered(...)`, `ShardPlacementRegistered(...)`, `ShardPlacementReplaced(...)`, `ObjectManifestSealed(...)`.

Errors: `ZeroAddress()`, `InvalidManifest()`, `ManifestExists()`, `ManifestNotFound()`, `InvalidPlacement()`, `PlacementExists()`, `PlacementNotFound()`, `Unauthorized()`, `ManifestSealed()`, `ManifestNotSealed()`, `PlacementStillEffective()`, `IncompleteManifest()`.

## Proof-window economics and 420Vault settlement

`StorageSettlementRegistry420` does not custody funds. It drives bounded obligations in **420Vault**.

Settlement states: `NONE`, `OPEN`, `FUNDED`, `COMPLETE`, `ABORTING`, `CANCELLED`.

Window states: `NONE`, `RESERVED`, `PAID`, `REFUNDED`.

A consumer may open settlement only for its ACTIVE agreement before service starts. Beneficiary is resolved from the canonical offer/node/provider path.

Total amount is:

`agreement.sizeBytes × offer.unitPrice420`

Window count is `ceil(duration / proofInterval)`, capped at **4,096**. Integer-division remainder is assigned to the final window so all window amounts sum exactly to total consideration.

`reserveWindows` creates Vault obligations. Once all are reserved, settlement becomes FUNDED. `settleWindow` releases exactly one reserved obligation only when an accepted proof matches agreement commitment, exact challenge epoch, and canonical settlement challenge ID. `refundMissedWindow` cancels/refunds a reserved obligation only after deadline. An OPEN settlement that reaches service start unfunded enters an abort/refund flow.

Events: `StorageSettlementOpened(...)`, `StorageWindowReserved(...)`, `StorageSettlementFunded(...)`, `StorageWindowPaid(...)`, `StorageWindowRefunded(...)`, `StorageSettlementCompleted(...)`, `StorageSettlementAborting(...)`, `StorageSettlementCancelled(...)`.

Errors: `ZeroAddress()`, `InvalidSettlement()`, `SettlementExists()`, `SettlementNotFound()`, `InvalidState()`, `Unauthorized()`, `InvalidWindow()`, `InvalidProof()`, `ProofDeadlineOpen()`.

## General Resource settlement versus Store settlement

General Resource sessions provide bounded metering suitable for Relay/Cache/Gateway-style use. 420Store is stricter because durable storage has time-based proof obligations. Generic cumulative usage receipts are not substitutes for Store proof-window evidence.

## Security and trust boundaries

The protocol fails closed on inactive providers/nodes/policies/offers, insufficient capacity, mismatched reservation/commitment, inactive schemes, replayed/early/late proofs, verifier failure, incomplete manifests, still-effective placement replacement, wrong proof/window binding, and missed proof deadlines.

Runtime discovery, provider APIs, local databases, Wallet screens, Indexer tables, Explorer pages, Search results, Analytics metrics, Status health, and qualification evidence are presentation/operations layers only.

## Privacy boundary

Off-chain/private by design: plaintext payloads, encrypted payload bytes, erasure-coded shard bytes, decryption keys, private app metadata, cache contents, relay traffic, raw service credentials, and private developer-access session material.

Canonical state contains only identities, commitments, proof/economic metadata, and lifecycle state required for enforcement.

## End-to-end Store lifecycle

`provider/node → Store offer → capacity reservation → commitment → proposed agreement → active agreement → off-chain verified upload → placements → sealed manifest → challenge/proof receipt → Vault proof-window release/refund → repair replacement as needed`

Every arrow is a real authority boundary. No provider/UI shortcut may collapse the sequence into one “uploaded”, “available”, or “paid” flag.

## Contract map

Shared Resource implementation:

`ResourceIds420.sol`, `ResourceAuthorization420.sol`, `ResourcePolicyRegistry420.sol`, `ResourceProviderRegistry420.sol`, `ResourceNodeRegistry420.sol`, `ResourceOfferRegistry420.sol`, `ResourceSessionRegistry420.sol`, `ResourceReceiptRegistry420.sol`, `ResourceRouter420.sol`.

420Store/storage implementation:

`StorageIds420.sol`, `StorageProofIds420.sol`, `IStorageProofVerifier420.sol`, `StorageProofSchemeRegistry420.sol`, `StorageCapacityRegistry420.sol`, `StorageCommitmentRegistry420.sol`, `StorageProofRegistry420.sol`, `StorageAgreementRegistry420.sol`, `StorageObjectManifestRegistry420.sol`, `StorageSettlementRegistry420.sol`.

The Genesis public product mapping remains Relay, Store, Cache, Gateway. Storage contracts implement 420Store; they do not create separate Genesis user applications.

## Generated-reference boundary

`docs/reference/generated/` is environment/catalogue scoped. The checked-in local example catalogue does not currently publish every Resource/Storage ABI, so absence from generated reference is not evidence that a contract does not exist.

This page owns the canonical handwritten Resource/Storage contract semantics, lifecycle, event names, and custom-error names. Once a deployment catalogue contains distributable verified Resource/Storage artifacts, generated ABI/signature reference should be regenerated from source rather than hand-maintained.

## Implementation status

SR-0 through SR-10 are **complete, production-qualified, and merged**. Frozen V1 identifiers remain unchanged. Possible future protocol versions may add Randomness-driven challenge scheduling, additional retrieval/bandwidth-proof profiles, or proof aggregation/succinct verifier adapters; those are not current behavior.

## Related documentation

- [Storage & resource infrastructure](../infrastructure/storage-resource-infrastructure.md)
- [420Storage Developer Hub](../../developers/420storage-developer-hub.md)
- [Storage and Resource integration](../../developers/storage-and-resource-integration.md)
- [Resource Network operations](../../420RESOURCE-NETWORK-OPERATIONS.md)
- [420Gateway operations](../../420GATEWAY-OPERATIONS.md)
- [Shared protocol/provider troubleshooting](../../troubleshooting/shared-protocol-provider.md)
- `contracts/config/420resource-genesis.json`
- `contracts/config/420storage-proof-v1.json`
