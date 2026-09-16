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

SR-10.1 through SR-10.9 are complete and exact-head qualified. SR-10.10 / Production launch closeout is active on PR #302. The branch was reconciled with current `main` at merge commit `8043e937a98b0edd46fe8f62d90067120147c789`; final merge is permitted only after the reconciled launch head passes node420, Integrated and Docs qualification.

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
| SR-10 | Production hardening / launch qualification | IN PROGRESS — SR-10.10 FINAL CLOSEOUT |

## Completed foundations

### SR-7 — 420Gateway

420Gateway provides public/private resource access with deterministic cache-first routing, provider discovery/failover, private-access default deny, HTTP GET/HEAD transport, TLS/Host boundaries, ETags/ranges, bounded retries, cancellation propagation, observability and graceful shutdown.

### SR-8 — Unified Resource Network runtime

SR-8 unified Store, Repair, Cache, Gateway and Relay around shared provider identity, capability, lifecycle, observability and trust-domain boundaries while preserving canonical protocol authority. It merged through PR #296 at `1232b1dc4d204c28bfd4a6949fa1fb9ece5012dc` after exact-head qualification of `5ad8b581f338b603f76afe157eae7c6fc65332ce`.

### SR-9 — Developer API, SDK and S3 compatibility

SR-9 added the stable `v1` developer surface over the Resource Network without creating a second source of truth. Completed scope includes stable retrieval/upload contracts, immutable manifest helpers, provider discovery/status, standalone SDK, cache/repair/gateway helpers, an explicit S3 compatibility subset, private-access default-deny regression coverage, end-to-end/fuzz/integrity qualification, developer guidance and privacy/logging review.

SR-9 remained monolithic through SR-9.10, reconciled current `main`, and merged only after the final exact head passed all three required gates.

## SR-10 — production hardening and launch qualification

SR-10 turns the qualified Resource Network and developer surfaces into a production-qualified storage subsystem. Each slice produces reproducible qualification evidence and preserves the rule that operational/runtime state cannot replace canonical chain-backed authority.

### SR-10 architecture invariants

- Production hardening cannot move canonical authority off-chain.
- Fault recovery preserves object/manifest/shard/commitment identity.
- Repair, cache and gateway availability never fabricates canonical placement/proof/settlement state.
- Security hardening remains default-deny for private access and service credentials.
- Operational automation is bounded, observable and cancellation-aware.
- Load, failover and recovery tests verify integrity as well as availability.
- Launch evidence binds software commits, configuration, schemas and test results to the qualified deployment.

### SR-10.1 — production topology and multi-provider qualification — COMPLETE / QUALIFIED

Reproducible multi-provider topology, deterministic discovery, lifecycle handling, degraded-state behavior and cross-provider failover were qualified at exact head `7e85ca94a3dbbf708e5369d22417cdca45fb51c4`.

### SR-10.2 — adversarial and fault-injection qualification — COMPLETE / QUALIFIED

Provider disappearance/rejoin, malformed/stale discovery, corrupt cache fallback, cancellation storms and private-read spoof resistance were qualified at `725b4132d2839df9540092b1ac72f24f3ad770ff`.

### SR-10.3 — sustained load, soak and capacity qualification — COMPLETE / QUALIFIED

Concurrent verified retrieval, deterministic cache failure/store fallback, discovery churn, HTTP range load, cancellation bounds and integrity verification were qualified at `63a8a12b686707463506f8d0f6b49ecb08885471`.

### SR-10.4 — upgrade, migration and compatibility procedures — COMPLETE / QUALIFIED

Rolling upgrades, frozen public API `v1`, `storage-topology-v1` compatibility, rollback and immutable manifest/placement identity were qualified at `0d4bb480be29b04c86a4b1c9e50a28350b53e6a6`.

### SR-10.5 — credential rotation and recovery — COMPLETE / QUALIFIED

Bounded credential rotation, immediate compromise rotation, revocation/recovery, secret-digest storage and redacted evidence were qualified at `d54e5a1fe87518c9ddb5dc873efc412576675985`.

### SR-10.6 — backup, restore and disaster recovery — COMPLETE / QUALIFIED

Operational backup evidence, canonical-identity reconciliation, topology binding, RPO/RTO enforcement and repair-driven recovery were qualified at `bc476b5d24e1fc55254ddd08494fa9d0263f6429`.

Qualification evidence: Docs #1351 / run `35130302828`, node420 #267 / `35130302904`, Integrated #3611 / `35130302958` — all PASS.

### SR-10.7 — security review and abuse resistance — COMPLETE / QUALIFIED

Concurrent idempotency replay protection, header/host boundaries, forwarded-host spoof resistance, private-read fail-closed handling and threat-model review were qualified at `34702a210f3545f7443a841aab56ab0792c22c0d`.

Qualification evidence: Docs #1362 / `35131559190`, node420 #272 / `35131559238`, Integrated #3622 / `35131559169` — all PASS.

### SR-10.8 — operator runbooks, alerts and SLOs — COMPLETE / QUALIFIED

Deterministic capability alerts, Store capacity pressure, Repair backlog, integrity/auth/routing signals and availability/integrity/recovery SLO evidence were qualified at `3ff5110966b65f8082d24cc0ff1403961ed226b2`.

Qualification evidence: Docs #1372 / `35132588771`, node420 #277 / `35132588875`, Integrated #3632 / `35132588655` — all PASS.

### SR-10.9 — testnet deployment evidence — COMPLETE / QUALIFIED

The testnet evidence contract binds commit/config/topology fingerprints, required end-to-end checks, provider/discovery/credential recovery drills, SLO evidence and launch blockers using `storage-testnet-evidence-v1`. It was qualified at `65228dd50d232ac23221e2229575877c9fb15af3`.

Qualification evidence: Docs #1380 / `35133981988`, node420 #282 / `35133982020`, Integrated #3640 / `35133981934` — all PASS.

### SR-10.10 — production launch closeout — ACTIVE

Closeout requirements:

- current `main` reconciled into the SR-10 branch;
- launch compatibility contracts frozen at developer API `v1`, topology schema `storage-topology-v1`, testnet evidence schema `storage-testnet-evidence-v1`, and DR evidence schema `storage-dr-v1`;
- all SR-10.1–SR-10.9 evidence retained and reproducible;
- testnet evidence must identify exact software/config/topology fingerprints and contain no unresolved critical launch blocker;
- final launch approval must name the exact reconciled SR-10 head and corresponding deployment/config fingerprints;
- node420 Release Gate, 420 Integrated Qualification and 420Docs Qualification must all pass on that exact final head;
- PR #302 may merge only after those exact-head gates are green.

The reconciliation commit `8043e937a98b0edd46fe8f62d90067120147c789` has parents SR-10.9 head `65228dd50d232ac23221e2229575877c9fb15af3` and current-main head `805150238ff1ec50859a1e3b95be03c388a1cac4`, using GitHub's clean PR merge tree. This preserves current mainline work while carrying every SR-10 change into closeout.

## SR-10 merge policy

SR-10 is one monolithic production-hardening phase. Individual slices are qualified as evolving exact heads; the only phase merge occurs after SR-10.10 final exact-head qualification.

## Dependency order

```text
SR-8 Unified Resource Network — COMPLETE / MERGED
    ↓
SR-9 Developer API / SDK / S3 compatibility — COMPLETE / MERGED
    ↓
SR-10.1–SR-10.9 — COMPLETE / QUALIFIED
    ↓
SR-10.10 Production launch closeout — ACTIVE / FINAL GATES PENDING
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
- [420Storage production topology qualification](../../developers/420storage-production-topology.md)
- [420Storage testnet deployment evidence](../../developers/420storage-testnet-evidence.md)
- [420Storage operator runbooks, alerts and SLO qualification](../../developers/420storage-operator-slos.md)
