---
title: 420Store & storage resource roadmap
component: 420 Resource Protocol / 420Store
audience:
  - developer
  - operator
  - architect
category: roadmap
status: development
version: current
---

# 420Store & storage resource roadmap

420 Integrated keeps storage payloads, retrieval traffic, caching and provider execution off-chain while anchoring identity, authorization, commitments, economics, proofs and settlement on-chain.

Canonical storage truth is derived from chain state plus manifests, placements and accepted proofs. No individual provider, filesystem, API, cache or gateway is authoritative merely because it is reachable.

## Current status

SR-0 through SR-3 are complete. SR-4 is active, with SR-4.1 and SR-4.2 complete and the core SR-4.3 runtime now qualified and merged through PR #152.

PR #152 was reconciled against current `main` and qualified on exact head `e957e349fd1927fd2f2fa8fe8fc8fd7895078be9`:

- node420 Release Gate #106 — PASS;
- 420 Integrated Qualification #3155 — PASS.

PR #152 merged to `main` as `434166bed77eab0a0ba9cdcc8850d65f7dc195ff`.

## Phase roadmap

| Phase | Component | Status |
| --- | --- | --- |
| SR-0 | Architecture / service boundaries | COMPLETE |
| SR-1 | 420 Resource Protocol foundation | COMPLETE |
| SR-2 | Storage Proof Protocol V1 | COMPLETE / MERGED |
| SR-3 | 420Store core storage market | COMPLETE |
| SR-3.1 | Agreement lifecycle | COMPLETE |
| SR-3.2 | Capacity accounting | COMPLETE |
| SR-3.3 | Object manifests / shard placement | COMPLETE |
| SR-3.4 | Proof-driven escrow settlement | COMPLETE |
| SR-4 | Storage node runtime | ACTIVE |
| SR-4.1 | Local shard runtime | COMPLETE / QUALIFIED |
| SR-4.2 | Chain sync / canonical RPC reader | COMPLETE / QUALIFIED |
| SR-4.3 | node420 service, streaming transport, proof scheduling and transport boundary | CORE QUALIFIED — CLOSEOUT REMAINS |
| SR-4.4 | Reconciliation, observability and resilience | NOT STARTED |
| SR-5 | 420Repair | NOT STARTED |
| SR-6 | 420Cache | NOT STARTED |
| SR-7 | 420Gateway | NOT STARTED |
| SR-8 | Unified Resource Network runtime | NOT STARTED |
| SR-9 | Developer API / SDK / S3 compatibility | NOT STARTED |
| SR-10 | Production hardening / launch qualification | NOT STARTED |

## SR-4.3 — node420 storage-service runtime

### Completed and qualified

The following SR-4.3 runtime work is now implemented and qualified:

- coordinated `node420` / Geth lifecycle and graceful shutdown;
- storage CLI/configuration, datadir, capacity and RPC configuration;
- background chain synchronization and fail-closed readiness;
- canonical agreement/commitment/capacity/proof-scheme hydration;
- canonical object manifest and per-shard placement authority;
- object-root versus shard-root separation;
- exact upload size and shard-root verification;
- fixed-length and chunked oversize rejection;
- atomic in-flight capacity accounting;
- context-aware cancellation and cleanup;
- idempotent canonical retries;
- same-commitment upload/delete serialization;
- streaming upload directly into temporary shard storage without whole-shard buffering;
- streaming retrieval directly from shard files;
- bounded range retrieval, `HEAD`, `Content-Length`, `ETag`, agreement and commitment metadata;
- ProofScheduler service lifecycle integration;
- proof windows advance only after an injected `ProofSubmitter` reports successful submission;
- public health endpoint plus bearer-token authorization boundary for provider APIs;
- non-loopback provider binds require an authorization token;
- constant-time bearer comparison;
- basic HTTP security headers, bounded header size and idle timeout;
- regression coverage for streaming integrity, concurrent capacity and same-ID uploads, cancellation, retry behavior, transport authorization and proof-window advancement.

### SR-4.3 closeout still required

SR-4.3 is not declared fully complete until the remaining provider-runtime integration work is closed:

1. **Concrete proof transaction submission and signing**
   - implement the production `ProofSubmitter` that sends accepted proof payloads to `StorageProofRegistry420.submitProof`;
   - bind submissions to provider/node signing configuration;
   - confirm nonce, replacement, receipt and failure semantics;
   - add live contract/RPC end-to-end qualification.

2. **Provider credential and capability hardening**
   - move beyond a static bearer token for production provider identity;
   - define provider key loading/rotation and capability-scoped authorization;
   - preserve default-deny behavior for privileged provider operations.

3. **Transport production boundary**
   - define TLS/mTLS or a mandatory secure reverse-proxy/ingress deployment profile for non-loopback service exposure;
   - add rate limits, connection/body abuse controls and operator-safe defaults.

4. **Retrieval HTTP closeout**
   - suffix byte ranges;
   - `If-None-Match` / `304 Not Modified`;
   - remaining range arithmetic and conditional-request edge cases;
   - service-level streaming cancellation/backpressure coverage.

5. **Service-level end-to-end qualification**
   - provider startup against live execution RPC;
   - canonical agreement activation and manifest placement;
   - streaming PUT/GET;
   - proof scheduling and actual proof transaction submission;
   - shutdown/restart with persisted projection and shard state.

Once these are qualified, SR-4.3 can be marked COMPLETE and development moves fully into SR-4.4.

## SR-4.4 — reconciliation, observability and resilience

SR-4.4 is the next substantial runtime phase. It should make local provider state continuously reconcile against canonical chain state rather than relying only on event progression.

Planned work:

- reconcile local shards against canonical agreements, commitments and placements;
- reconcile proof and settlement windows after restart;
- recover and advance paid/refunded settlement state;
- detect expired or missed proof windows;
- remove or quarantine orphaned/stale local shards;
- periodic shard integrity/root verification;
- correct local capacity drift;
- retry/backoff for RPC, proof submission and transient transport failures;
- deterministic reorg replay and post-reorg local reconciliation;
- structured metrics and logs for capacity, proofs, retrieval, settlement and sync health;
- richer readiness/degraded-state reporting;
- operator alerts for proof failure, corruption, capacity drift and canonical/local mismatch.

### SR-4.4 exit criteria

SR-4.4 is complete when a provider can restart, reorg, lose transient RPC connectivity, encounter stale/corrupt local data and recover to a canonical, observable state without inventing authority or silently reporting unavailable data as healthy.

## SR-5 — 420Repair

420Repair remains unbuilt.

The repair layer should detect manifest durability falling below policy targets and coordinate protocol-valid replacement placements while preserving object identity, erasure provenance and historical agreement/proof/settlement history.

Expected scope:

- degraded-manifest detection;
- repair policy evaluation;
- source shard selection and reconstruction;
- replacement provider selection;
- new agreement/commitment/placement creation;
- repair job accounting and audit trail;
- failure/retry/idempotency semantics.

## SR-6 — 420Cache

420Cache remains unbuilt.

It should provide provider-backed edge caching and retrieval bandwidth while reusing Resource Protocol provider identity, capability separation, metering and settlement rather than creating a separate economic system.

Expected scope:

- cache offer/capability model;
- cache admission and eviction;
- content-addressed cache identity;
- origin/420Store retrieval integration;
- bandwidth/metering receipts;
- TTL and invalidation behavior;
- cache integrity and privacy boundaries.

## SR-7 — 420Gateway

420Gateway remains unbuilt.

It should provide public/private application access to decentralized resources without becoming canonical protocol authority.

Expected scope:

- gateway request routing;
- capability-aware private access;
- provider discovery and failover;
- 420Store/420Cache retrieval integration;
- abuse controls and rate limiting;
- TLS/domain deployment profile;
- privacy-safe logging and metrics.

## SR-8 — unified Resource Network runtime

Unify Store, Repair, Cache, Gateway and Relay provider operations around the shared provider/node/resource model.

Goals:

- common provider lifecycle;
- shared discovery and capability boundaries;
- common accounting/settlement primitives;
- unified operator status and observability;
- no accidental cross-service ambient authority.

## SR-9 — developer interfaces

Expose stable developer-facing storage/resource interfaces after the provider runtime is resilient.

Planned scope:

- SDKs;
- upload/retrieval APIs;
- manifest helpers;
- provider discovery helpers;
- repair/cache/gateway integration;
- optional S3-compatible adapter where it can preserve canonical 420Store semantics;
- examples and Developer Hub integration.

## SR-10 — production hardening and launch qualification

Final production work should include:

- multi-provider deployment qualification;
- adversarial/fault testing;
- load/soak testing;
- upgrade/migration procedures;
- key rotation and credential recovery;
- backup/recovery drills;
- security review;
- operator runbooks and alert thresholds;
- testnet evidence;
- launch closeout bound to exact deployed commits/configuration.

## Dependency order

The intended implementation order remains:

```text
SR-4.3 closeout
    ↓
SR-4.4 reconciliation / resilience
    ↓
SR-5 420Repair
    ↓
SR-6 420Cache
    ↓
SR-7 420Gateway
    ↓
SR-8 unified Resource Network runtime
    ↓
SR-9 developer API / SDK / S3 compatibility
    ↓
SR-10 production hardening / launch qualification
```

Repair should precede cache/gateway productionization because durable canonical retrieval and replacement semantics are the foundation on which higher-level edge access should rely.

## Architecture invariant

Throughout every remaining phase:

> Files, network traffic, caching and execution happen off-chain; identity, authorization, commitments, economics, proofs and settlement are anchored on-chain.

420Store, 420Repair, 420Cache and 420Gateway are one Resource Network family. They should reuse common provider identity, capability, accounting and proof boundaries rather than evolve as unrelated systems.

## Related documentation

- [Storage & resource infrastructure](storage-resource-infrastructure.md)
- [`node420`](node420.md)
- [RPC, gateways, and network ingress](rpc-gateways-network-ingress.md)
- [Storage Proof & Resource Protocol](../protocols/storage-proof-resource-protocol.md)
- [Storage & resource developer integration](../../developers/storage-and-resource-integration.md)
