# 420Media Phase 3.1 — Operator Discovery and Provider Selection

## Purpose

Phase 3.1 turns the Phase 1 operator registry and Phase 2 operator runtime into a discoverable service network without adding expensive on-chain operator enumeration.

`MediaOperatorRegistry420` remains authoritative for operator identity, lifecycle state, metadata commitment and capability enablement. Discovery is an off-chain indexed projection that is always revalidated against canonical chain state before an operator becomes selectable.

## Discovery pipeline

1. Index `OperatorRegistered`, `OperatorStateChanged`, `OperatorCapabilityChanged` and `OperatorMetadataUpdated` events.
2. Query the event index for operator IDs advertising a requested capability.
3. Re-read canonical operator state and capability eligibility from `MediaOperatorRegistry420` / `MediaCapabilityRegistry420`.
4. Resolve the operator service profile referenced by the canonical `metadataHash` and revision.
5. Exclude malformed, unavailable or stale profiles.
6. Apply hard request bounds: price, latency, geography, available capacity and reliability.
7. Rank the remaining providers deterministically using explicit local weights.
8. Break exact score ties by price, latency and finally operator ID so all callers receive a stable ordering from the same input snapshot.

## Trust boundaries

The event index is a discovery accelerator only. It is never authoritative for whether an operator is currently active or operational for a capability.

Service profiles are operator-published off-chain metadata. They may advertise price, latency, geography and current capacity, but they cannot override canonical activation or capability state. Missing or malformed service metadata excludes that provider from the current selection pass.

Raw stream URLs, ingress credentials, signer credentials, playback secrets and media bytes must never enter the registry or discovery index.

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

## Next increment

The next 3.1 increment should implement the concrete Ethereum event index / canonical registry reader against `MediaOperatorRegistry420`, then expose discovery through the operator/service-network control plane. Phase 3.2 can build stream orchestration on top of this deterministic provider set.
