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

Canonical storage truth is derived from chain state plus manifests, placements and accepted proofs. No provider, filesystem, API, cache, repair worker or gateway becomes authoritative merely because it is reachable.

## Current status

SR-0 through SR-6 are complete. SR-7 / 420Gateway is in final monolithic closeout on PR #289 after implementation and exact-head qualification of SR-7.1 through SR-7.10.

The latest qualified SR-7.10 head before final documentation closeout is:

`2f8694450148c661afe0474b164de42d39628789`

Qualification evidence:

- node420 Release Gate #174 — PASS;
- 420 Integrated Qualification #3377 — PASS.

Because the closeout documentation itself changes the PR head, PR #289 must receive one final exact-head qualification before SR-7 is merged.

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
| SR-7 | 420Gateway | FINAL CLOSEOUT / QUALIFICATION |
| SR-8 | Unified Resource Network runtime | NOT STARTED |
| SR-9 | Developer API / SDK / S3 compatibility | NOT STARTED |
| SR-10 | Production hardening / launch qualification | NOT STARTED |

## SR-7 — 420Gateway

420Gateway provides public/private application access to decentralized resources without becoming canonical protocol authority.

### Completed implementation

SR-7.1 through SR-7.10 implement:

- deterministic cache-first routing with 420Store fallback;
- provider-neutral gateway sources and provider discovery;
- deterministic provider ordering, deduplication and failover;
- canonical payload revalidation before data is served;
- capability-aware public/private access with default-deny private authorization;
- `/v1/gateway` GET/HEAD transport integrated into `node420`;
- bounded concurrency and per-client rate limiting;
- non-loopback TLS and explicit allowed-host deployment boundary;
- deterministic ETags, `If-None-Match`, single byte ranges and HEAD semantics;
- privacy-safe structured logging and in-memory operational metrics;
- `/healthz` liveness and `/readyz` degraded-readiness behavior;
- bounded transient upstream retries with deterministic exponential backoff;
- immediate cancellation propagation through active requests and retry waits;
- bounded upstream body reads and exact-size/canonical integrity checks;
- graceful context-driven gateway service shutdown.

### Qualified slices

The monolithic PR retains each SR-7.x implementation while qualifying the evolving exact head. The most recent pre-closeout qualification covers all runtime code through SR-7.10:

- exact head `2f8694450148c661afe0474b164de42d39628789`;
- node420 Release Gate #174 — PASS;
- 420 Integrated Qualification #3377 — PASS.

The final closeout commit(s) update roadmap/operator documentation and therefore require a new final exact-head qualification before merge.

### SR-7 architecture invariants

- Gateway routing is derived behavior, never canonical storage truth.
- Successful retrieval does not supersede canonical manifest, placement, commitment or proof state.
- Private access is fail-closed when required authorization context is absent or rejected.
- Discovery failure may fall back to explicitly configured sources, but cannot invent providers.
- Every served payload is revalidated against canonical shard/cache identity.
- Health/readiness state is operational state only; it is not written back as protocol authority.
- Retry/backoff changes transport resilience only; it cannot convert an invalid payload into a valid one.
- Logs and health payloads must not disclose raw object identifiers, authorization material, bearer tokens, subjects or session identifiers.

### Production deployment profile

Loopback gateway deployments may use plain HTTP for local development. Non-loopback or wildcard binds require:

- a valid TLS certificate/key pair loaded before serving;
- explicit allowed Host values;
- at least one configured cache or store upstream;
- positive upstream timeout, abuse-control and retry/backoff values;
- deliberate private-access authorization integration when private gateway mode is required.

Operational procedures and recovery semantics are documented in [`../../420GATEWAY-OPERATIONS.md`](../../420GATEWAY-OPERATIONS.md).

## SR-8 — unified Resource Network runtime

SR-8 is the next phase after SR-7 merges.

Unify Store, Repair, Cache, Gateway and Relay provider operations around the shared provider/node/resource model.

Planned goals:

- common provider lifecycle and capability registration;
- shared discovery and capability boundaries;
- common accounting/settlement primitives;
- unified operator status and observability;
- coordinated service health without accidental cross-service ambient authority;
- deterministic service startup/shutdown ordering;
- common configuration and credential handling where trust domains genuinely overlap;
- explicit separation where trust domains must remain independent.

### SR-8 exit criteria

SR-8 is complete when Store, Repair, Cache, Gateway and Relay can run as one operational Resource Network family with shared provider identity/capability semantics and coherent observability while preserving the canonical authority boundaries of each protocol component.

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
SR-7 420Gateway final qualification / merge
    ↓
SR-8 unified Resource Network runtime
    ↓
SR-9 developer API / SDK / S3 compatibility
    ↓
SR-10 production hardening / launch qualification
```

## Architecture invariant

Throughout every remaining phase:

> Files, network traffic, caching and execution happen off-chain; identity, authorization, commitments, economics, proofs and settlement are anchored on-chain.

420Store, 420Repair, 420Cache and 420Gateway are one Resource Network family. They reuse common provider identity, capability, accounting and proof boundaries rather than evolving as unrelated systems.

## Related documentation

- [420Gateway operations and recovery](../../420GATEWAY-OPERATIONS.md)
- [Storage & resource infrastructure](storage-resource-infrastructure.md)
- [`node420`](node420.md)
- [RPC, gateways, and network ingress](rpc-gateways-network-ingress.md)
- [Storage Proof & Resource Protocol](../protocols/storage-proof-resource-protocol.md)
- [Storage & resource developer integration](../../developers/storage-and-resource-integration.md)
