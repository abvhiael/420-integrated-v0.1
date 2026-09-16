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

SR-0 through SR-8 are complete. SR-8 / Unified Resource Network runtime merged to `main` through PR #296 at merge commit `1232b1dc4d204c28bfd4a6949fa1fb9ece5012dc` after final exact-head qualification of `5ad8b581f338b603f76afe157eae7c6fc65332ce`.

SR-9 / Developer API, SDK and S3 compatibility is in final monolithic closeout on PR #299. SR-9.1 through SR-9.9 are implemented and qualified. SR-9.10 hardening is implemented, the branch has been reconciled with current `main` through temporary PR #301 at merge commit `ea9e518034312d673991b25eb62ad37d9bad1c0f`, and only the final reconciled exact-head qualification remains before PR #299 may merge.

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
| SR-8 | Unified Resource Network runtime | COMPLETE / MERGED |
| SR-9 | Developer API / SDK / S3 compatibility | IN PROGRESS — FINAL SR-9.10 GATES |
| SR-10 | Production hardening / launch qualification | NOT STARTED |

## SR-7 — 420Gateway

SR-7 is complete and merged. 420Gateway provides public/private application access to decentralized resources without becoming canonical protocol authority. Its completed scope includes deterministic cache-first routing, provider discovery/failover, private-access default deny, HTTP GET/HEAD transport, abuse controls, TLS/host boundaries, ETags/ranges, observability, health/readiness, bounded retries, cancellation propagation and graceful shutdown.

Operational procedures are documented in [`../../420GATEWAY-OPERATIONS.md`](../../420GATEWAY-OPERATIONS.md).

## SR-8 — Unified Resource Network runtime

SR-8 is complete and merged. It unifies Store, Repair, Cache, Gateway and Relay provider operations around one shared provider/node/resource model while preserving explicit authority boundaries.

Final SR-8 qualification evidence:

- exact head `5ad8b581f338b603f76afe157eae7c6fc65332ce`;
- node420 Release Gate #193 / Actions run `35040787332` — PASS;
- 420 Integrated Qualification #3447 / Actions run `35040787325` — PASS;
- 420Docs Qualification #1187 / Actions run `35040787322` — PASS.

SR-8 merged through PR #296 at `1232b1dc4d204c28bfd4a6949fa1fb9ece5012dc`.

## SR-9 — developer interfaces

SR-9 exposes stable developer-facing storage/resource interfaces over the completed Resource Network. The developer layer is an adapter and convenience surface: it must not create canonical identity, authorization, placement, proof, settlement or provider authority of its own.

### SR-9 architecture invariants

- Public developer contracts are versioned and do not expose internal runtime structs as the compatibility contract.
- Object identity remains bound to canonical object/manifest/shard/root/size/commitment fields.
- Private reads remain default-deny and reuse the existing bounded session/capability authorization path.
- Retrieval verifies payload bytes against shard identity before returning them.
- Upload helpers prepare and transport bytes but cannot declare an agreement, placement, manifest, proof or settlement canonical.
- SDK retries are bounded, cancellation-aware and retry-safe.
- Provider discovery is advisory routing information derived from qualified Resource Network state.
- Cache, repair and gateway helpers remain non-canonical convenience layers.
- S3 compatibility is translation only; incompatible S3 semantics fail explicitly.
- Secrets remain caller/service scoped and are excluded from manifests, telemetry and public route metadata.

### SR-9.1 — stable developer contract and retrieval adapter — COMPLETE / QUALIFIED

Implemented the versioned `v1` developer object/read contract and Gateway adapter with private-access default deny, canonical identity validation, copy-safe payloads and route metadata that carries no canonical authority.

Qualification evidence:

- exact head `10d0f2ea7c31aaac054aa9b1e4e986c87a055c58`;
- 420Docs #1195 / `35043314996` — PASS;
- 420 Integrated #3455 / `35043315005` — PASS;
- node420 #194 / `35043315060` — PASS.

### SR-9.2 — versioned developer HTTP retrieval API — COMPLETE / QUALIFIED

Implemented `/v1/resources/retrieve`, GET/HEAD, ranges/ETags, deterministic errors, request/header bounds, timeouts, TLS/Host/public-bind policy and explicit private authorization headers without trusting forwarded identity.

Qualification evidence:

- exact head `7a28298dff65afb33f5cf8fbcb5c25ef33ae8402`;
- Docs #1200 / `35044082816` — PASS;
- node420 #197 / `35044082810` — PASS;
- Integrated #3460 / `35044082853` — PASS.

### SR-9.3 — upload preparation and bounded ingest API — COMPLETE / QUALIFIED

Implemented bounded prepare/ingest, deterministic upload IDs, idempotency requirements, temporary verified writes, Store discovery and explicit non-canonical receipts.

Qualification evidence:

- exact head `c97c43fb80b554f4c69b3bf2e9382ce165db627d`;
- node420 #199 / `35044830745` — PASS;
- Integrated #3464 / `35044830735` — PASS;
- Docs #1204 / `35044830744` — PASS.

### SR-9.4 — manifest, shard and object helpers — COMPLETE / QUALIFIED

Implemented deterministic immutable manifest hashing, shard roots, seal readiness/retrievability separation, placement compatibility and object-ref derivation. SR-9.10 subsequently tightened SHA-256 digest validation and backed-shard requirements.

Qualification evidence:

- exact head `bb20215161f300a3aa3da168703b9a4ed421e4d7`;
- Docs #1208 / `35046863624` — PASS;
- node420 #203 / `35046863620` — PASS;
- Integrated #3468 / `35046863629` — PASS.

### SR-9.5 — provider discovery and resource-status API — COMPLETE / QUALIFIED

Implemented capability-scoped, bounded, deterministic developer discovery/status views. Results remain derived and non-authoritative and exclude credentials/trust grants.

Qualification evidence:

- exact head `7840f31afad160a3d6f57256f7e3aca33e330ce0`;
- Docs #1216 / `35048806502` — PASS;
- Integrated #3476 / `35048806512` — PASS;
- node420 #206 / `35048806626` — PASS.

### SR-9.6 — reference SDK and language-neutral schemas — COMPLETE / QUALIFIED

Implemented the standalone Go SDK, typed errors, bounded retries, cancellation, TLS endpoint rules, language-neutral JSON schema and golden fixtures. SR-9.10 added client-side SHA-256 shard verification, a real SDK↔HTTP E2E test and broader frozen DTO/schema coverage.

Qualification evidence:

- exact head `1c804d55693372459aa4f2fe5c2a35e54f4be7f7`;
- Docs #1227 / `35049684648` — PASS;
- node420 #214 / `35049684650` — PASS;
- Integrated #3487 / `35049684651` — PASS.

### SR-9.7 — repair, cache and gateway developer helpers — COMPLETE / QUALIFIED

Implemented non-authoritative cache status, repair status and policy-controlled Gateway helper behavior with route/fallback diagnostics and Gateway integrity reuse.

Qualification evidence:

- exact head `43e063c573649c33fa814314373d9cb1449937f1`;
- Docs #1242 / `35056515998` — PASS;
- node420 #218 / `35056516015` — PASS;
- Integrated #3502 / `35056516004` — PASS.

### SR-9.8 — semantics-preserving S3 compatibility adapter — COMPLETE / QUALIFIED

Implemented bucket/key resolution into explicit 420 identity, GET/HEAD/PUT plus explicitly authorized DELETE, single-part compatibility ETags and explicit failure for unsupported multipart/ACL/versioning semantics. SR-9.10 added private-write default deny, explicit write authorization and receipt identity-substitution checks.

Qualification evidence:

- exact head `b6785bcb64d409985b7aa73c0ad00b54e5848603`;
- Docs #1258 / `35057797090` — PASS;
- node420 #221 / `35057797116` — PASS;
- Integrated #3518 / `35057797153` — PASS.

### SR-9.9 — examples, local workflow and Developer Hub — COMPLETE / QUALIFIED

Implemented the Developer Hub, public/private retrieval examples, upload→manifest→retrieval guidance, discovery/status guidance, S3 support matrix, local/testnet template and troubleshooting by authorization/routing/integrity/canonical/provider failure class.

Qualification evidence:

- exact head `d0d02b5ed20af7659b0b2ac19b2b2b48d6a72ee1`;
- Docs #1262 / `35059184022` — PASS;
- node420 #225 / `35059183978` — PASS;
- Integrated #3522 / `35059183960` — PASS.

### SR-9.10 — compatibility, security and monolithic closeout — FINAL GATES PENDING

Completed closeout hardening includes:

- SDK SHA-256 shard-root verification in addition to exact-size verification;
- route/payload substitution regression coverage;
- real SDK ↔ `DeveloperHTTPHandler` end-to-end qualification;
- HTTP request parser fuzz coverage;
- frozen v1 compatibility contract with golden retrieval/upload/manifest/discovery fixtures;
- expanded language-neutral schema and stable schema identity `urn:420integrated:storage:v1`;
- manifest property/permutation tests and strict SHA-256 digest validation;
- auth/default-deny regression coverage for missing, malformed, substituted and denied private credentials;
- S3 private-write default deny with explicit write authorizer;
- S3 receipt identity/root/size substitution rejection;
- privacy/logging review documenting prohibited credential/private metadata logging;
- reconciliation with current `main`.

Qualified SR-9.10 slices:

- hardening head `d4aa0c30f8f8582541cee6d5b67014edaaa4a349` — Docs #1277 / `35059928380` PASS; node420 #229 / `35059928318` PASS; Integrated #3537 / `35059928285` PASS;
- compatibility-freeze head `37ce35a832551435b069e445990e4ce52b1d7cda` — Docs #1284 / `35060369438` PASS; Integrated #3544 / `35060369441` PASS; node420 #234 / `35060369479` PASS;
- manifest/auth head `3e4d5518ed0dab8386f29c12ad05d0dd2b0213ee` — Docs #1287 / `35061401104` PASS; node420 #237 / `35061401115` PASS; Integrated #3547 / `35061401246` PASS;
- S3 closeout head `fa12b0f4b7b3201c4383fbc53becb2e45fb84168` — Docs #1293 / `35062650858` PASS; node420 #239 / `35062650788` PASS; Integrated #3553 / `35062650764` PASS.

Reconciliation evidence:

- current `main` before reconciliation: `d98a424eeb40dea766493b5a617f4aa979eee92c`;
- temporary reconciliation PR: #301;
- reconciliation merge commit on SR-9 branch: `ea9e518034312d673991b25eb62ad37d9bad1c0f`.

Privacy/logging review: [`../../developers/420storage-sr9-privacy-review.md`](../../developers/420storage-sr9-privacy-review.md).

Final closeout requirement: the final reconciled exact head containing the privacy review and roadmap evidence must pass node420 Release Gate, 420 Integrated Qualification and 420Docs Qualification. Only then may PR #299 merge to `main`.

### SR-9 merge policy

SR-9 is monolithic. SR-9.1 through SR-9.10 remain on the SR-9 integration branch and may be individually qualified while evolving. PR #299 merges only once, after the final reconciled exact head passes all required gates.

### SR-9 exit criteria

SR-9 is complete when an application can discover qualified resource services, construct canonical-safe object/manifest requests, upload and retrieve through a stable versioned API/SDK, use repair/cache/gateway helpers and optionally use the documented S3-compatible subset without gaining any authority that the underlying Resource Protocol, 420Store, Gateway or trust-domain system does not already grant.

## SR-10 — production hardening and launch qualification

Final production work includes:

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
SR-8 Unified Resource Network — COMPLETE / MERGED
    ↓
SR-9 developer API / SDK / S3 compatibility — FINAL GATES
    ↓
SR-10 production hardening / launch qualification
```

## Architecture invariant

Throughout every remaining phase:

> Files, network traffic, caching and execution happen off-chain; identity, authorization, commitments, economics, proofs and settlement are anchored on-chain.

420Store, 420Repair, 420Cache, 420Gateway and Relay are one Resource Network family. They reuse common provider identity, capability, lifecycle, observability and trust boundaries rather than evolving as unrelated systems.

Developer APIs, SDKs and compatibility adapters sit above that family. They translate and compose qualified capabilities; they do not become an alternate source of protocol truth.

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
