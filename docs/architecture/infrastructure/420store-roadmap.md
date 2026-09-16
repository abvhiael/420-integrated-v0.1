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

Canonical storage truth is derived from chain state plus manifests, placements and accepted proofs. No provider, filesystem, API, cache, repair worker, gateway or shared runtime becomes authoritative merely because it is reachable.

## Current status

SR-0 through SR-7 are complete and merged. SR-8 / Unified Resource Network runtime is in final monolithic closeout on PR #296 after implementation and exact-head qualification of SR-8.1 through SR-8.7.

The latest qualified SR-8.7 head before final closeout documentation and reconciliation is:

`7fae98dfe4314e19b673a6edc24fc0cd6d187921`

Qualification evidence:

- node420 Release Gate #190 — PASS;
- 420 Integrated Qualification #3437 — PASS.

PR #296 was then reconciled with current `main` through reconciliation PR #298, producing merge commit `5cadd51a86f2ccf80fb8836d4a0f6c0050e4de8f`. Final closeout documentation changes the branch head again, so SR-8 requires one final exact-head qualification before merge.

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
| SR-4 | Storage node runtime | COMPLETE |
| SR-4.1 | Local shard runtime | COMPLETE / QUALIFIED |
| SR-4.2 | Chain sync / canonical RPC reader | COMPLETE / QUALIFIED |
| SR-4.3 | node420 service, transport and proof scheduling | COMPLETE / QUALIFIED |
| SR-4.4 | Reconciliation, observability and resilience | COMPLETE / QUALIFIED |
| SR-5 | 420Repair | COMPLETE / QUALIFIED |
| SR-6 | 420Cache | COMPLETE / QUALIFIED |
| SR-7 | 420Gateway | COMPLETE / MERGED |
| SR-8 | Unified Resource Network runtime | FINAL CLOSEOUT / QUALIFICATION |
| SR-9 | Developer API / SDK / S3 compatibility | NOT STARTED |
| SR-10 | Production hardening / launch qualification | NOT STARTED |

## SR-7 — 420Gateway

SR-7 is complete and merged. 420Gateway provides public/private application access to decentralized resources without becoming canonical protocol authority. Its completed scope includes deterministic cache-first routing, provider discovery/failover, private-access default deny, HTTP GET/HEAD transport, abuse controls, TLS/host boundaries, ETags/ranges, observability, health/readiness, bounded retries, cancellation propagation and graceful shutdown.

Operational procedures and recovery semantics are documented in [`../../420GATEWAY-OPERATIONS.md`](../../420GATEWAY-OPERATIONS.md).

## SR-8 — Unified Resource Network runtime

SR-8 unifies Store, Repair, Cache, Gateway and Relay provider operations around one shared provider/node/resource model while preserving explicit authority boundaries.

### Completed implementation

SR-8.1 through SR-8.7 implement:

- provider/node-bound `ResourceNetworkRuntime` with canonical Store, Repair, Cache, Gateway and Relay capability vocabulary;
- deterministic service registration, capability normalization and constrained registered/starting/running/degraded/stopped/failed lifecycle transitions;
- provider-neutral shared discovery with capability-scoped bindings, lifecycle filtering and deterministic ordering;
- Gateway adaptation that consumes only running cache/store sources;
- read-only accounting/settlement projection for economic capabilities without creating local settlement authority;
- unified operator status, capability counts and bounded operational metrics;
- deterministic dependency-aware service startup, reverse shutdown and rollback on partial startup failure;
- shared non-secret configuration plus explicitly service-scoped credential/secret handling;
- deterministic redacted configuration snapshots;
- explicit storage, delivery, economic and control trust domains;
- explicit per-service authority grants with default-deny authorization and rejection of cross-domain authority combinations;
- copy-safe deterministic snapshots across lifecycle, observability, configuration and trust surfaces.

### Qualified slices

The monolithic PR retained each SR-8.x implementation while qualifying the evolving exact head:

- SR-8.1 exact head `ee05ad2d3790e7d82e609403dcac68be6cefeb70` — node420 #178 PASS; Integrated #3391 PASS;
- SR-8.2 exact head `ab218539bead48cda5a7d2cc38561e1ebc1bbf25` — node420 #179 PASS; Integrated #3393 PASS;
- SR-8.3 exact head `3b10e80001373b4e14aa1db9f1b802faceefffb3` — node420 #181 PASS; Integrated #3400 PASS;
- SR-8.4 exact head `26b00e1a2c6920face012cdadff65ecdc4555dbf` — node420 #183 PASS; Integrated #3410 PASS;
- SR-8.5 exact head `58aed289d00b2824143607667b1ae6426db938c2` — node420 #185 PASS; Integrated #3418 PASS;
- SR-8.6 exact head `ee772fcb336fd2dbeca3ba98f3b7e1abf5a6ed1a` — node420 #188 PASS; Integrated #3429 PASS;
- SR-8.7 exact head `7fae98dfe4314e19b673a6edc24fc0cd6d187921` — node420 #190 PASS; Integrated #3437 PASS.

### SR-8 architecture invariants

- Shared runtime membership never grants protocol authority.
- Canonical chain/manifests/placements/proofs/settlement remain authoritative over local projections.
- Discovery is derived routing state and cannot invent providers or capabilities.
- Accounting is read-only projection; it cannot reserve funds, execute payouts or declare settlement finality.
- Service lifecycle state is operational state only.
- Shared configuration contains no secrets; service credentials remain service-scoped.
- Trust domains are explicit and default deny.
- Credential access is control-domain authority and must be granted explicitly per service.
- Cross-domain authority combinations are rejected rather than inherited from shared runtime membership.
- Operator snapshots are deterministic and copy-safe and cannot mutate runtime authority state.

### SR-8 exit criteria

SR-8 is complete when Store, Repair, Cache, Gateway and Relay can run as one operational Resource Network family with shared provider identity/capability semantics, deterministic lifecycle coordination and coherent observability while preserving canonical protocol and trust-domain boundaries.

Implementation now satisfies those criteria. The remaining closeout action is final exact-head qualification after reconciliation and documentation, then merge PR #296.

Operator procedures are documented in [`../../420RESOURCE-NETWORK-OPERATIONS.md`](../../420RESOURCE-NETWORK-OPERATIONS.md).

## SR-9 — developer interfaces

Expose stable developer-facing storage/resource interfaces after the unified runtime is established.

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
- sustained load/soak testing;
- upgrade/migration procedures;
- key rotation and credential recovery;
- backup/recovery drills;
- security review;
- operator runbooks and alert thresholds;
- testnet evidence;
- launch closeout bound to exact deployed commits/configuration.

## Dependency order

```text
SR-8 Unified Resource Network final qualification / merge
    ↓
SR-9 developer API / SDK / S3 compatibility
    ↓
SR-10 production hardening / launch qualification
```

## Architecture invariant

Throughout every remaining phase:

> Files, network traffic, caching and execution happen off-chain; identity, authorization, commitments, economics, proofs and settlement are anchored on-chain.

420Store, 420Repair, 420Cache, 420Gateway and Relay are one Resource Network family. They reuse common provider identity, capability, lifecycle, observability and trust boundaries rather than evolving as unrelated systems.

## Related documentation

- [Resource Network operations](../../420RESOURCE-NETWORK-OPERATIONS.md)
- [420Gateway operations and recovery](../../420GATEWAY-OPERATIONS.md)
- [Storage & resource infrastructure](storage-resource-infrastructure.md)
- [`node420`](node420.md)
- [RPC, gateways, and network ingress](rpc-gateways-network-ingress.md)
- [Storage Proof & Resource Protocol](../protocols/storage-proof-resource-protocol.md)
- [Storage & resource developer integration](../../developers/storage-and-resource-integration.md)
