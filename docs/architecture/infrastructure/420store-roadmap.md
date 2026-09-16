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

Canonical storage truth is derived from chain state plus manifests, placements and accepted proofs. No provider, filesystem, API, cache, repair worker, gateway, SDK, compatibility adapter or shared runtime becomes authoritative merely because it is reachable.

## Current status

SR-0 through SR-9 are complete. SR-9 / Developer API, SDK and S3 compatibility merged to `main` through PR #299 at merge commit `494fb38ef85e7af6eb24e484da04e6a80fbd73aa` after final exact-head qualification of `604c26500478d6e75565ce394ba034a774245cf2`.

Final SR-9 qualification evidence:

- 420Docs Qualification #1307 / Actions run `35119184005` — PASS;
- node420 Release Gate #244 / Actions run `35119184004` — PASS;
- 420 Integrated Qualification #3567 / Actions run `35119183995` — PASS.

SR-10 / Production hardening and launch qualification is now the active phase.

## Phase roadmap

| Phase | Component | Status |
| --- | --- | --- |
| SR-0 | Architecture / service boundaries | COMPLETE |
| SR-1 | 420 Resource Protocol foundation | COMPLETE |
| SR-2 | Storage Proof Protocol V1 | COMPLETE / MERGED |
| SR-3 | 420Store core storage market | COMPLETE |
| SR-4 | Storage node runtime | COMPLETE / QUALIFIED |
| SR-5 | 420Repair | COMPLETE / QUALIFIED |
| SR-6 | 420Cache | COMPLETE / QUALIFIED |
| SR-7 | 420Gateway | COMPLETE / MERGED |
| SR-8 | Unified Resource Network runtime | COMPLETE / MERGED |
| SR-9 | Developer API / SDK / S3 compatibility | COMPLETE / MERGED |
| SR-10 | Production hardening / launch qualification | IN PROGRESS — SR-10.1 NEXT |

## Completed foundations

### SR-7 — 420Gateway

420Gateway provides public/private resource access with deterministic cache-first routing, provider discovery/failover, private-access default deny, HTTP GET/HEAD transport, TLS/Host boundaries, ETags/ranges, bounded retries, cancellation propagation, observability and graceful shutdown.

### SR-8 — Unified Resource Network runtime

SR-8 unified Store, Repair, Cache, Gateway and Relay around shared provider identity, capability, lifecycle, observability and trust-domain boundaries while preserving canonical protocol authority. It merged through PR #296 at `1232b1dc4d204c28bfd4a6949fa1fb9ece5012dc` after exact-head qualification of `5ad8b581f338b603f76afe157eae7c6fc65332ce`.

### SR-9 — Developer API, SDK and S3 compatibility

SR-9 added the stable `v1` developer surface over the Resource Network without creating a second source of truth. Completed scope includes:

- stable object identity and public/private retrieval contracts;
- versioned HTTP GET/HEAD retrieval with ranges, ETags and deterministic errors;
- bounded upload preparation/ingest with idempotency and verified payload identity;
- deterministic manifest/shard helpers and strict SHA-256 identity validation;
- advisory provider discovery/resource-status views;
- standalone Go SDK, JSON schema and frozen golden fixtures;
- cache/repair/gateway developer helpers;
- semantics-preserving S3 subset with explicit failure for unsupported multipart/ACL/versioning behavior;
- private-read and private-write default-deny regressions;
- SDK ↔ HTTP end-to-end coverage, fuzz/property tests and payload-substitution checks;
- Developer Hub, local/testnet examples and privacy/logging review.

SR-9 remained monolithic through SR-9.10, reconciled current `main` through PR #301, and merged only after the final exact head passed all three required gates.

## SR-10 — production hardening and launch qualification

SR-10 turns the qualified Resource Network and developer surfaces into a production-qualified storage subsystem. It should remain evidence-driven: each step produces reproducible deployment/test artifacts and exact-head qualification evidence rather than relying on manual assertions.

### SR-10 architecture invariants

- Production hardening cannot move canonical authority off-chain.
- Fault recovery must preserve object/manifest/shard/commitment identity.
- Repair, cache and gateway availability must never fabricate canonical placement/proof/settlement state.
- Security hardening remains default-deny for private access and service credentials.
- Operational automation must be bounded, observable and cancellation-aware.
- Load, failover and recovery tests must verify integrity as well as availability.
- Launch evidence must bind software commits, configuration, schemas and test results to the qualified deployment.

### SR-10.1 — production topology and multi-provider qualification — NEXT

Build the reproducible production deployment model before adversarial testing begins.

Scope:

- define minimum production topology for Store, Repair, Cache, Gateway and Relay across multiple providers/nodes;
- define provider/node/service identity and capability allocation per deployment;
- add deterministic topology/config validation;
- validate startup/shutdown ordering and degraded-service behavior across multiple providers;
- exercise cross-provider discovery, cache/store routing and repair eligibility;
- verify no shared configuration contains caller/service secrets;
- add test harnesses/fixtures for multi-provider local or CI qualification;
- capture topology manifests and exact configuration fingerprints as qualification evidence.

Exit criteria: a reproducible multi-provider Resource Network can start, discover services, retrieve verified objects, degrade/fail over safely and shut down without violating authority boundaries.

### SR-10.2 — adversarial and fault-injection qualification

Scope:

- provider disappearance/rejoin;
- stale or malicious discovery entries;
- corrupted payload/shard substitution;
- cache poisoning attempts;
- repair source/placement mismatch;
- delayed/failed storage writes;
- partial network partitions and timeout storms;
- authorization failures and forwarded-identity spoof attempts;
- proof/settlement projection lag;
- deterministic recovery assertions and bounded retry checks.

### SR-10.3 — sustained load, soak and capacity qualification

Scope:

- concurrent upload/retrieval workloads;
- cache hit/miss and store fallback distributions;
- repair backlog pressure;
- provider discovery churn;
- gateway concurrency and range-request load;
- memory/file-descriptor/goroutine/resource leak checks;
- long-duration soak tests;
- latency/error/throughput baselines and capacity envelopes.

### SR-10.4 — upgrade, migration and compatibility procedures

Scope:

- rolling node/runtime upgrades;
- backwards-compatible v1 API/SDK handling;
- schema/config migration validation;
- manifest/placement persistence across upgrades;
- mixed-version deployment behavior;
- rollback procedures and compatibility gates.

### SR-10.5 — credential rotation and recovery

Scope:

- service credential rotation;
- session/signing material rotation where applicable;
- revocation propagation;
- lost/compromised credential recovery;
- secret redaction validation;
- no credential material in public telemetry or canonical manifests.

### SR-10.6 — backup, restore and disaster recovery

Scope:

- backup of required local operational state;
- restore/reconcile against canonical chain/manifests/placements;
- provider-loss recovery;
- repair-driven reconstruction;
- documented RPO/RTO targets;
- repeatable recovery drills.

### SR-10.7 — security review and abuse resistance

Scope:

- API/Gateway/S3 abuse controls;
- malformed/fuzzed request expansion;
- SSRF/host/header/forwarded-identity boundaries;
- upload exhaustion and replay/idempotency abuse;
- private-access default-deny audit;
- dependency/static-analysis review;
- threat-model and residual-risk documentation.

### SR-10.8 — operator runbooks, alerts and SLOs

Scope:

- health/readiness and degraded-state semantics;
- alert thresholds for Store/Repair/Cache/Gateway/Relay;
- storage capacity and repair backlog alerts;
- integrity/auth/routing failure alerts;
- incident triage and recovery procedures;
- defined availability, integrity and recovery SLOs.

### SR-10.9 — testnet deployment evidence

Scope:

- deploy the qualified topology to testnet;
- record exact software/config/schema versions;
- run end-to-end upload → manifest → retrieval → cache/gateway → repair flows;
- execute selected fault/recovery drills;
- capture metrics, logs and qualification artifacts;
- document unresolved launch blockers explicitly.

### SR-10.10 — production launch closeout

Scope:

- reconcile current `main`;
- freeze launch configuration and compatibility contracts;
- verify all SR-10 evidence is present and reproducible;
- run final node420, Integrated and Docs qualification on the exact launch head;
- bind launch approval to exact commit/configuration fingerprints;
- merge SR-10 only after all launch gates are green.

## SR-10 merge policy

Treat SR-10 as one production-hardening phase unless a later implementation decision explicitly splits deployment infrastructure from launch evidence. Individual SR-10.x slices may be qualified as they evolve, but final production closeout must run against one reconciled exact head.

## Dependency order

```text
SR-8 Unified Resource Network — COMPLETE / MERGED
    ↓
SR-9 Developer API / SDK / S3 compatibility — COMPLETE / MERGED
    ↓
SR-10 Production hardening / launch qualification — ACTIVE
```

## Architecture invariant

> Files, network traffic, caching and execution happen off-chain; identity, authorization, commitments, economics, proofs and settlement are anchored on-chain.

420Store, 420Repair, 420Cache, 420Gateway and Relay remain one Resource Network family. Developer APIs, SDKs and compatibility adapters translate and compose those qualified capabilities; they do not become alternate protocol authority.

## Related documentation

- [Resource Network operations](../../420RESOURCE-NETWORK-OPERATIONS.md)
- [420Gateway operations and recovery](../../420GATEWAY-OPERATIONS.md)
- [Storage & resource infrastructure](storage-resource-infrastructure.md)
- [`node420`](node420.md)
- [RPC, gateways, and network ingress](rpc-gateways-network-ingress.md)
- [Storage Proof & Resource Protocol](../protocols/storage-proof-resource-protocol.md)
- [Storage & resource developer integration](../../developers/storage-and-resource-integration.md)
- [420Storage Developer Hub](../../developers/420storage-developer-hub.md)
- [SR-9 privacy and logging review](../../developers/420storage-sr9-privacy-review.md)
