# 420Media Phase 3.1 — Operator Discovery and Provider Selection

## Purpose

Phase 3.1 turns the Phase 1 operator registry and Phase 2 operator runtime into a discoverable service network without adding expensive on-chain operator enumeration.

`MediaOperatorRegistry420` remains authoritative for operator identity, lifecycle state, metadata commitment and capability enablement. Discovery is an off-chain indexed projection that is always revalidated against canonical chain state before an operator becomes selectable.

## Discovery pipeline

1. Index `OperatorCapabilityChanged` events for the requested capability.
2. Reconstruct the latest enabled/disabled capability state per operator from ordered logs.
3. Query the resulting event index for candidate operator IDs.
4. Re-read canonical operator state and capability eligibility from `MediaOperatorRegistry420` / `MediaCapabilityRegistry420` using `eth_call`.
5. Resolve the operator service profile referenced by the canonical `metadataHash` and revision.
6. Exclude malformed, unavailable or stale profiles.
7. Apply hard request bounds: price, latency, geography, available capacity and reliability.
8. Rank the remaining providers deterministically using explicit local weights.
9. Break exact score ties by price, latency and finally operator ID so all callers receive a stable ordering from the same input snapshot.
10. Expose the bounded provider set through the service-network control plane.

## Ethereum adapter

`media/discovery/ethereum.go` is the concrete Phase 3.1 chain adapter. It reuses the Phase 2 JSON-RPC interface and deliberately keeps Ethereum ABI selectors/event topics explicit configuration so the discovery control plane does not require a heavyweight Ethereum SDK.

The adapter performs:

- `eth_getLogs` over `OperatorCapabilityChanged` with the requested capability as indexed topic 2;
- ordered replay of capability enable/disable state by block number and log index;
- rejection of removed, malformed or structurally unexpected logs;
- direct `eth_call` of the canonical public `operators(bytes32)` getter;
- direct `eth_call` of `isOperationalFor(bytes32,bytes32)`;
- strict fixed-word ABI decoding;
- uint overflow checks and strict Solidity-bool decoding;
- canonical active-state enforcement (`OperatorState.ACTIVE` plus `exists` plus `isOperationalFor`).

The event index can contain stale IDs after a reorg or historical state transition without creating a safety issue because every candidate is still revalidated against current canonical registry state. Malformed chain data or RPC failures fail the discovery pass closed.

## Service-network control plane

`media/controlplane/discovery.go` is the Phase 3.1 service boundary consumed by later orchestration code. Callers submit capability, budget, latency, geography, capacity, reliability and result-limit constraints; the control plane delegates selection to the deterministic discovery selector and returns a bounded `ProviderView`.

The control-plane response exposes only canonical operator identity, revision and non-secret selection metrics. It intentionally omits metadata commitments, capability maps, raw endpoints, signer material, media references and credentials. Canonical discovery errors are propagated rather than converted into partial provider sets.

## Trust boundaries

The event index is a discovery accelerator only. It is never authoritative for whether an operator is currently active or operational for a capability.

Service profiles are operator-published off-chain metadata. They may advertise price, latency, geography and current capacity, but they cannot override canonical activation or capability state. Missing or malformed service metadata excludes that provider from the current selection pass.

Raw stream URLs, ingress credentials, signer credentials, playback secrets and media bytes must never enter the registry, discovery index or provider-selection response.

## Initial ranking inputs

- `PricePerUnit`
- `LatencyMS`
- `ReliabilityBPS`
- `AvailableSlots`
- geography allow-list

The default score emphasizes reliability first, then price, latency and capacity. Hard user/job limits are applied before scoring.

## Phase 3.1 invariants

- **MEDIA-DISCOVERY-INV-001:** Indexed state alone can never make an operator selectable.
- **MEDIA-DISCOVERY-INV-002:** Every candidate must be canonically active and operational for the requested capability.
- **MEDIA-DISCOVERY-INV-003:** Canonical read/RPC failure fails the discovery pass closed; partially revalidated candidate sets are not returned.
- **MEDIA-DISCOVERY-INV-004:** Invalid or unavailable off-chain profile metadata excludes only that provider.
- **MEDIA-DISCOVERY-INV-005:** Reliability values above 10,000 basis points are invalid.
- **MEDIA-DISCOVERY-INV-006:** Hard price, latency, geography, capacity and reliability requirements are enforced before ranking.
- **MEDIA-DISCOVERY-INV-007:** Provider ranking is deterministic for a fixed candidate snapshot, request and weight set.
- **MEDIA-DISCOVERY-INV-008:** Exact ranking ties resolve deterministically by price, latency and operator ID.
- **MEDIA-DISCOVERY-INV-009:** Duplicate operator IDs from an index cannot create duplicate candidates.
- **MEDIA-DISCOVERY-INV-010:** Discovery state contains references and service metadata only; no raw media or credentials.
- **MEDIA-DISCOVERY-INV-011:** Capability event replay must honor canonical block/log ordering and the latest enable/disable state per operator.
- **MEDIA-DISCOVERY-INV-012:** Removed or malformed Ethereum logs fail the index read closed.
- **MEDIA-DISCOVERY-INV-013:** ABI decoding rejects malformed lengths, invalid booleans and numeric overflow.
- **MEDIA-DISCOVERY-INV-014:** An operator is exposed as active only when the canonical operator record exists, is in ACTIVE state and `isOperationalFor` returns true for the requested capability.
- **MEDIA-DISCOVERY-INV-015:** The service-network control plane cannot broaden eligibility beyond the selector constraints supplied by the caller.
- **MEDIA-DISCOVERY-INV-016:** Control-plane provider responses exclude metadata payloads, endpoints, credentials and raw media references.
- **MEDIA-DISCOVERY-INV-017:** Canonical discovery failures propagate through the control plane; partial provider responses are never synthesized after a failed discovery pass.

## Phase 3.1 completion boundary

Phase 3.1 is complete when the Ethereum index/registry adapter, deterministic selector and service-network discovery boundary pass qualification together. Phase 3.2 then consumes this stable provider set to build stream orchestration: ingress selection, transcoder/relay assignment, job graph construction and lifecycle coordination.
