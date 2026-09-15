---
title: Storage Proof & Resource Protocol
component: 420 Resource Protocol / 420Store
audience:
  - developer
  - architect
  - operator
category: architecture
status: development
version: current
---

# Storage Proof & Resource Protocol

420 Integrated separates **resource-service coordination** from the infrastructure that actually performs storage, relay, cache, retrieval, and gateway work. The 420 Resource Protocol anchors provider identity, node/service eligibility, offers, sessions, metering, storage agreements, capacity, commitments, proof policy, proof receipts, object manifests, and settlement while encrypted payload bytes and most service execution remain off-chain.

The protocol rule is simple: **a provider may prove and bill for a qualified service without becoming consensus, execution, governance, wallet, application, or content authority.**

## Protocol family

The shared Resource Protocol coordinates four service classes:

- **420Relay** — encrypted routing and metered relay bandwidth;
- **420Store** — persistent encrypted storage with capacity, commitments, proofs, manifests, and proof-driven settlement;
- **420Cache** — cache/CDN and retrieval-bandwidth services;
- **420Gateway** — public/private access gateways to decentralized resources.

These services share common provider, node, offer, authorization, session, receipt, and router primitives but remain capability-separated. Eligibility to provide one service does not imply eligibility or authorization for another.

## Authority model

The protocol distinguishes several kinds of state:

| State | Canonical authority |
| --- | --- |
| Provider identity / lifecycle | Resource provider registry |
| Node identity / service class | Resource node registry |
| Offer terms and pricing | Resource offer registry |
| Scoped provider/node actions | Resource authorization |
| Consumer sessions / ceilings | Resource session registry |
| Metering receipts | Resource receipt registry |
| Storage capacity / reservations | Storage capacity registry |
| Storage agreement terms | Storage agreement registry |
| Immutable storage commitment | Storage commitment registry |
| Proof policy and verifier | Storage proof-scheme registry |
| Accepted proof receipts | Storage proof registry |
| Object/shard provenance | Storage object-manifest registry |
| Storage payment windows | Storage settlement registry + 420Vault |
| Payload bytes / shards | Off-chain provider infrastructure |

Provider filesystems, databases, health checks, gateway responses, local capacity reports, or monitoring dashboards are never canonical protocol state by themselves.

## Provider qualification

`ResourceProviderRegistry420` gives providers an explicit lifecycle:

`REGISTERED → ACTIVE ↔ SUSPENDED → RETIRED`

Activation requires a nonzero staking reference. A provider may update mutable metadata/stake references only while it is not active or retired. State changes increment the provider revision.

Provider registration and activation grant only the resource-service authorities explicitly recognized by the Resource Protocol. They do not grant custody, governance, validator, arbitrary contract-call, or application-admin authority.

Nodes are separately bound to providers and service classes. Consumers should therefore reason about both provider state and the specific node/service qualification rather than treating provider identity alone as proof that an endpoint may perform every resource role.

## Offers and economic terms

Resource offers define the terms under which a qualified node is willing to provide one service class. The offer fixes the service identity, pricing/unit semantics, term limits, maximum units, expiry, and provider/node relationship before a consumer opens a session or storage agreement.

An effective offer is a prerequisite for downstream activity. Applications should not substitute an off-chain price quote for the canonical offer when the protocol requires the offer-bound terms.

## Sessions, metering, and replay safety

General resource consumption uses bounded sessions. A session is derived from the consumer, offer, chain, contract, and nonce so the same request cannot silently collide with another session.

Sessions establish explicit ceilings for:

- allowed resource units;
- maximum native `$420` spend;
- service/offer identity;
- consumer identity;
- lifecycle state.

Metering receipts are cumulative rather than free-form invoices. Accepted usage must advance monotonically and remain inside session limits. The provider cannot create additional spend authority merely by reporting that more work was performed off-chain.

Resource settlement is therefore **metered and bounded**, not an ambient permission for providers to debit users.

## 420Store agreement lifecycle

420Store builds storage-specific guarantees on top of the shared Resource Protocol.

A storage agreement progresses through:

`PROPOSED → ACTIVE → COMPLETED`

or, while still proposed:

`PROPOSED → CANCELLED`

The agreement binds:

- consumer;
- effective STORE offer;
- object identity;
- content root;
- manifest hash;
- storage class;
- repair-policy commitment;
- proof scheme;
- storage commitment;
- capacity reservation;
- byte size;
- start/end times;
- proof interval;
- erasure-coding data/total shard counts.

Agreement IDs are domain-separated with chain ID, registry address, consumer, offer, object, and nonce.

The agreement permits up to **1,024 total shards** and requires `totalShards >= dataShards > 0`.

## Activation is a cross-registry qualification gate

A proposed storage agreement cannot become active merely because a provider says it accepted the object.

Activation verifies all of the following:

1. the referenced offer is still an effective STORE offer;
2. the caller is the node operator, provider operator, or holds the exact scoped storage-agreement acceptance authority;
3. the capacity reservation is active;
4. the reservation belongs to the same node and agreement;
5. the reservation byte size matches the agreement;
6. reservation lifetime covers the agreement end;
7. the commitment belongs to the same node/provider;
8. proof-scheme identity matches;
9. content root and byte size match;
10. commitment start/end times exactly match the agreement.

The protocol therefore treats storage as a joined invariant across **offer + node/provider + reserved capacity + immutable commitment + proof policy**, not as a provider-local assertion.

## Capacity and oversubscription

Storage capacity is protocol state distinct from physical disk size.

Operators and applications must distinguish:

- local disk capacity;
- registered node capacity;
- reserved capacity;
- actual local bytes present;
- live commitments;
- effective agreements;
- currently retrievable shard capacity.

A healthy disk does not prove that capacity is unreserved. Conversely, a canonical reservation does not prove that the payload is locally intact. Those guarantees are connected through the commitment/proof layer rather than collapsed into one flag.

Canonical reservations exist to prevent the same registered capacity from being promised incompatibly to multiple agreements.

## Immutable storage commitments

A storage commitment binds the provider/node to immutable storage parameters, including:

- content root;
- replica root;
- byte size;
- proof scheme;
- start/end interval;
- provider identity;
- node identity.

Commitments are historical evidence. Their identity and bound fields must not be rewritten merely because a provider later changes configuration, operators, metadata, or local layout.

If service must migrate to another provider/node, the protocol should create the required new agreement/commitment/placement relationships while preserving old evidence.

## Proof schemes

Proof policy is versioned and verifier-bound through `StorageProofSchemeRegistry420`. The current storage-proof profile recognizes:

- `REPLICA_COMMITMENT`;
- `AVAILABILITY_WINDOW`;
- `AUDIT_RESPONSE`.

A scheme defines the verifier and maximum delay allowed after a challenge epoch.

Applications do not decide ad hoc whether a blob of proof bytes is valid. The canonical proof registry resolves the commitment's bound scheme and invokes the scheme's verifier.

## Proof submission and acceptance

`StorageProofRegistry420` constrains proof submissions with several safety rules:

- commitment, challenge, epoch, and proof must be present;
- proof payload is bounded to **65,536 bytes**;
- a commitment/challenge pair is single-use;
- challenge epoch must fall inside the commitment interval;
- proof cannot be submitted before its challenge epoch;
- the STORE node must still be active;
- the proof scheme must still be active;
- proof must arrive before `challengeEpoch + maxProofDelay`;
- verifier reversion or a `false` result fails closed;
- accepted proof identity is domain-separated over commitment, challenge, and proof digest.

Only the proof digest/receipt is retained canonically. The protocol does not need to keep all raw proof bytes forever in canonical state.

## Proof receipts are evidence, not payment

An accepted proof establishes that the bound verifier accepted one challenge for one commitment under one proof scheme.

It does **not** automatically mean:

- every byte of an object is globally available forever;
- every other challenge has been satisfied;
- the provider may withdraw the full agreement value;
- the object has enough live shards for reconstruction;
- the consumer waived future proof requirements.

Payment is deliberately separated into proof windows in the settlement controller.

## Object manifests and shard provenance

`StorageObjectManifestRegistry420` anchors the object envelope while payload and shard bytes remain off-chain.

A manifest commits to:

- object ID;
- object content root;
- manifest hash;
- encryption commitment;
- erasure root;
- object size;
- segment count;
- data-shard threshold;
- total shard count.

Every shard placement binds:

- manifest ID;
- shard index;
- shard root;
- shard byte size;
- storage agreement;
- storage commitment;
- node.

A placement is accepted only when the agreement belongs to the manifest controller, matches the object/manifest and erasure parameters, is ACTIVE, and resolves to a compatible commitment.

The same shard index cannot be registered twice for one manifest.

## Sealing and retrievability

A manifest can be sealed only after all declared shard indexes have placements.

Sealing proves the placement envelope is complete. It does not freeze every provider into permanent service.

`isRetrievable()` evaluates the current effective agreements and live commitments behind those placements. An erasure-coded object is considered retrievable when at least `dataShards` placements remain live.

This gives the protocol an explicit distinction between:

- **manifest completeness** — all intended shard placements were registered;
- **current retrievability** — enough of those placements are still effective now.

A sealed manifest may therefore become degraded later without rewriting its historical manifest or placement records.

## Repair and provider replacement

Provider failure should not cause historical commitments to be edited to point somewhere else.

A safe repair flow preserves:

1. object identity and content root;
2. existing manifest and placement evidence;
3. prior agreement/commitment/proof history;
4. any settled/refunded payment windows;
5. new provider/node qualification;
6. new capacity reservation and commitment;
7. new placement/repair state through whatever repair mechanism is authorized.

Repair logic may automate new storage work, but it must not manufacture continuity by relabeling unrelated bytes as the original commitment.

## Proof-driven settlement

`StorageSettlementRegistry420` separates service evidence from custody. **420Vault remains the custodian.** The settlement registry creates, releases, or cancels Vault obligations according to storage agreement/proof state.

Settlement IDs bind the agreement and Vault. The provider beneficiary is resolved from the agreement's qualified offer/node/provider state when the settlement opens.

The total storage amount is derived from:

`agreement.sizeBytes × offer.unitPrice420`

The agreement duration is split into bounded proof windows, with a maximum of **4,096 settlement windows**.

Before service starts, the consumer funds each window as a Vault obligation. Once every window is reserved, the settlement enters `FUNDED` state.

## Canonical challenge windows

Each settlement window derives a deterministic challenge epoch from:

- agreement start time;
- proof interval;
- window index;
- agreement end time.

The challenge ID is domain-separated over the agreement, window index, and challenge epoch.

To release a window, the proof receipt must match:

- the agreement commitment;
- the exact derived challenge epoch;
- the exact canonical challenge ID.

A valid proof for some other challenge cannot be reused to release a different payment window.

## Paid versus refunded windows

A funded window has exactly one terminal economic outcome:

- **PAID** — a qualifying proof exists and the corresponding Vault obligation is released to the provider beneficiary;
- **REFUNDED** — the proof deadline expires and the obligation is cancelled/refunded.

Proof absence therefore does not authorize late provider collection. Once the deadline passes, the protocol can refund the missed window instead.

If a settlement never finishes funding before service starts, it enters an abort flow and already-reserved obligations can be cancelled rather than stranded.

## Rounding and accounting

The total agreement amount is divided across settlement windows deterministically.

All normal windows receive integer division of the total by the window count. Any remainder is added to the final window so:

`sum(window amounts) == totalAmount420`

The settlement tracks paid and refunded totals separately and completes only after all windows have reached a terminal state.

## General Resource Protocol and storage-specific settlement

The shared Resource Protocol's sessions/receipts are suitable for metered Relay/Cache/Gateway-style usage and other bounded resource services.

420Store's storage-proof settlement is stricter because durable storage is time-based and must remain challengeable across an agreement interval. Storage payment therefore binds proof windows to immutable agreements and commitments instead of trusting generic cumulative usage alone.

Consumers should choose the protocol surface that matches the guarantee they need rather than treating all resource receipts as equivalent proof of durable storage.

## Data and privacy boundary

The following remain off-chain:

- plaintext payloads;
- encrypted payload bytes;
- erasure-coded shard bytes;
- decryption keys;
- private application metadata;
- cache contents;
- relay traffic payloads.

The chain anchors only the state needed for identity, authority, offers, capacity, commitments, manifests, proof policy/results, metering, and settlement.

A content root or proof receipt proves the protocol's bound commitment/evidence semantics; it does not authorize public disclosure of the underlying content.

## Failure behavior

### Provider or node suspension

New service qualification fails where active provider/node status is required. Existing historical commitments and receipts remain evidence; they are not deleted to hide the incident.

### Capacity exhaustion

New reservations should fail rather than oversubscribe canonical capacity.

### Commitment mismatch

Agreement activation fails. Operators must correct the proposed storage state through valid new objects rather than editing historical commitment fields.

### Verifier failure

The proof fails closed. No receipt and no proof-driven payment release are created.

### Proof deadline missed

The corresponding settlement window becomes refundable after its deadline. The provider cannot later substitute an unrelated proof for that window.

### Provider loses local data

The provider must not claim continued availability. The affected placements may cease to satisfy retrievability, and repair/replacement must preserve provenance.

### Insufficient live shards

The object becomes non-retrievable according to the manifest threshold until enough qualified placements are restored.

### Vault/settlement failure

Payment state remains unresolved. Proof acceptance alone must never be interpreted as successful value transfer.

## Recovery order

A representative protocol recovery sequence is:

1. verify canonical chain/finality and contract discovery;
2. verify Resource authorization and provider/node state;
3. verify effective offers and sessions;
4. reconcile registered capacity and active reservations;
5. reconcile storage agreements and immutable commitments;
6. verify proof-scheme configuration and verifier identity;
7. restore proof intake and reconcile accepted proof receipts;
8. validate manifests, placements, and current retrievability;
9. reconcile settlement/Vault obligations, paid windows, and refunds;
10. initiate protocol-valid repair/replacement where redundancy is insufficient;
11. resume dependent gateways, applications, and settlement flows only after canonical state agrees with provider operations.

Local provider metadata must never be used to overwrite canonical agreement, proof, manifest, or settlement state during recovery.

## Storage/Resource invariants

- **RESOURCE-001** — provider registration or service delivery never grants consensus, execution, governance, wallet, or arbitrary application authority.
- **RESOURCE-002** — service-class authority is scoped; Relay, Store, Cache, and Gateway permissions do not bleed into one another.
- **RESOURCE-003** — active providers require canonical lifecycle qualification and a nonzero stake reference.
- **RESOURCE-004** — offers/sessions bind service and economic ceilings before metered consumption; providers cannot create additional spend authority from off-chain usage claims.
- **RESOURCE-005** — metering receipts advance usage monotonically and cannot exceed their bound session ceilings.
- **STORE-001** — a storage agreement becomes ACTIVE only after compatible STORE offer, provider/node, capacity reservation, proof scheme, and immutable commitment state all qualify.
- **STORE-002** — payload and shard bytes remain off-chain; canonical state anchors commitments and evidence rather than plaintext custody.
- **STORE-003** — canonical capacity reservations prevent protocol-level oversubscription of registered storage capacity.
- **STORE-004** — storage commitment identity and historical bound parameters are immutable evidence and are never rewritten to follow provider replacement.
- **STORE-005** — proof challenges are single-use, interval-bound, deadline-bound, verifier-checked, and fail closed on inactive nodes/schemes or verifier failure.
- **STORE-006** — an accepted proof receipt is evidence for one bound challenge and never by itself releases arbitrary payment.
- **STORE-007** — manifest shard placements must resolve to compatible ACTIVE agreements and commitments, and every declared shard must be placed before sealing.
- **STORE-008** — current retrievability requires at least the manifest's `dataShards` threshold of live/effective placements; stale provider assertions are insufficient.
- **STORE-009** — storage settlement custody remains in canonical 420Vault; the settlement controller only creates/releases/cancels bounded obligations.
- **STORE-010** — each proof-payment window binds one deterministic challenge; proof evidence from another window cannot release it.
- **STORE-011** — missed proof windows refund rather than silently extending provider collection authority.
- **STORE-012** — provider loss, repair, or replacement preserves agreement/commitment/proof/manifest/settlement history instead of rewriting canonical provenance.

## Implementation status

The repository currently implements the shared provider/node/offer/session/receipt Resource Protocol plus the 420Store agreement, capacity, commitment, proof-scheme, proof-receipt, object-manifest, and proof-driven settlement stack. Provider-side payload handling and proof computation remain off-chain behind these canonical boundaries.

Future provider discovery, repair automation, retrieval proofs, aggregated proofs, geographic diversity policy, or production storage orchestration can evolve without weakening these invariants.

## Related documentation

- [Protocol integration model](protocol-integration-model.md)
- [Storage & resource infrastructure](../infrastructure/storage-resource-infrastructure.md)
- [Stake, Governance, Treasury and Grants](stake-governance-treasury-grants.md)
- [Randomness and Oracle Interface](randomness-oracle-interface.md)
- `contracts/config/420resource-genesis.json`
- `contracts/config/420storage-proof-v1.json`
