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

SR-0 through SR-8 are complete and merged. SR-8 / Unified Resource Network runtime merged to `main` through PR #296 at merge commit `1232b1dc4d204c28bfd4a6949fa1fb9ece5012dc` after final exact-head qualification of `5ad8b581f338b603f76afe157eae7c6fc65332ce`.

Final SR-8 closeout qualification evidence:

- node420 Release Gate #193 / Actions run `35040787332` — PASS;
- 420 Integrated Qualification #3447 / Actions run `35040787325` — PASS;
- 420Docs Qualification #1187 / Actions run `35040787322` — PASS.

SR-9 / Developer API, SDK and S3 compatibility is now active. The monolithic SR-9 branch begins with SR-9.1, which establishes a stable versioned developer-facing retrieval contract over the already-qualified Gateway and Resource Network boundaries without exposing internal runtime types or weakening canonical authority.

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
| SR-9 | Developer API / SDK / S3 compatibility | IN PROGRESS — SR-9.1 |
| SR-10 | Production hardening / launch qualification | NOT STARTED |

## SR-7 — 420Gateway

SR-7 is complete and merged. 420Gateway provides public/private application access to decentralized resources without becoming canonical protocol authority. Its completed scope includes deterministic cache-first routing, provider discovery/failover, private-access default deny, HTTP GET/HEAD transport, abuse controls, TLS/host boundaries, ETags/ranges, observability, health/readiness, bounded retries, cancellation propagation and graceful shutdown.

Operational procedures and recovery semantics are documented in [`../../420GATEWAY-OPERATIONS.md`](../../420GATEWAY-OPERATIONS.md).

## SR-8 — Unified Resource Network runtime

SR-8 is complete and merged. It unifies Store, Repair, Cache, Gateway and Relay provider operations around one shared provider/node/resource model while preserving explicit authority boundaries.

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
- SR-8.7 exact head `7fae98dfe4314e19b673a6edc24fc0cd6d187921` — node420 #190 PASS; Integrated #3437 PASS;
- SR-8 final exact head `5ad8b581f338b603f76afe157eae7c6fc65332ce` — node420 #193 PASS; Integrated #3447 PASS; Docs #1187 PASS.

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

### SR-8 closeout

SR-8 satisfied its exit criteria and merged through PR #296. Store, Repair, Cache, Gateway and Relay can now operate as one Resource Network family with shared provider identity/capability semantics, deterministic lifecycle coordination and coherent observability while preserving canonical protocol and trust-domain boundaries.

Operator procedures are documented in [`../../420RESOURCE-NETWORK-OPERATIONS.md`](../../420RESOURCE-NETWORK-OPERATIONS.md).

## SR-9 — developer interfaces

SR-9 exposes stable developer-facing storage/resource interfaces over the completed Resource Network. The developer layer is an adapter and convenience surface: it must not create canonical identity, authorization, placement, proof, settlement or provider authority of its own.

### SR-9 architecture invariants

- Public developer contracts are versioned and must not expose internal runtime structs as the compatibility contract.
- Object identity remains bound to canonical object/manifest/shard/root/size/commitment fields.
- Private reads remain default-deny and reuse the existing bounded session/capability authorization path.
- Retrieval must continue to verify payload bytes against canonical shard identity before returning them.
- Upload helpers may prepare and transport data but cannot declare an agreement, placement, manifest, proof or settlement canonical.
- SDK retries must be bounded, cancellation-aware and safe against duplicate mutations.
- Provider discovery is advisory routing information derived from qualified Resource Network state.
- Cache, repair and gateway helpers remain non-canonical convenience layers.
- S3 compatibility is translation only; incompatible S3 semantics must fail explicitly rather than silently weakening 420Store semantics.
- Secrets remain caller/service scoped and must not be embedded in manifests, SDK telemetry or public route metadata.

### SR-9.1 — stable developer contract and retrieval adapter — IN PROGRESS

Establish the first public programmatic boundary without exposing internal Gateway or Resource Network implementation types.

Scope:

- versioned `v1` developer contract;
- stable object reference containing object id, manifest id, shard index, shard root, size and commitment id;
- explicit public/private read-access metadata;
- adapter from developer retrieval requests to the qualified `GatewayRouter` path;
- reuse of Gateway private-access authorization rather than parallel authorization logic;
- cache/store/discovery routing remains internal to Gateway;
- returned operational route metadata may identify selected tier/provider/node but conveys no canonical authority;
- copy-safe payload results;
- validation for unsupported API versions, malformed object references and malformed private-access requests;
- tests for public retrieval, private default-deny, authorized private retrieval, invalid references/version and discovered provider metadata.

Exit criteria: developers can perform an integrity-checked retrieval through one stable versioned contract while all existing Gateway authorization, discovery and integrity guarantees remain intact.

### SR-9.2 — versioned developer HTTP retrieval API

Expose SR-9.1 through a stable HTTP boundary suitable for applications and SDKs.

Planned scope:

- explicit `/v1` resource namespace;
- deterministic JSON request/error envelope for metadata and binary response path for payloads;
- GET/HEAD retrieval semantics;
- conditional and range behavior mapped to qualified Gateway semantics;
- request-size/header bounds and transport timeouts;
- explicit public/private authorization transport;
- no trust in forwarding headers for security decisions;
- TLS/Host/public-bind policy consistent with existing Gateway production boundaries;
- cancellation propagation and bounded response streaming;
- focused protocol/transport tests.

### SR-9.3 — upload preparation and bounded ingest API

Add the developer write path while keeping canonical state transitions explicit.

Planned scope:

- upload intent/preparation request separate from byte transport;
- deterministic object/shard identity preparation;
- explicit content-length and maximum-object bounds;
- streaming ingest with hashing and exact-size verification;
- idempotency key / retry-safe mutation boundary;
- provider selection through qualified Resource Network discovery;
- storage agreement/capacity/commitment preconditions exposed as explicit dependencies rather than hidden side effects;
- failed uploads cannot fabricate placements or sealed manifests;
- cancellation, cleanup and partial-upload recovery tests.

### SR-9.4 — manifest, shard and object helpers

Provide reusable canonical-data helpers to applications and later SDKs.

Planned scope:

- deterministic manifest construction helpers;
- shard identity/root helpers;
- erasure/encryption commitment metadata adapters without handling plaintext keys on-chain;
- manifest completeness and seal-readiness checks;
- placement compatibility validation;
- retrievability status model distinct from manifest completeness;
- serialization fixtures and compatibility tests.

### SR-9.5 — provider discovery and resource-status API

Expose safe read-only views of qualified Resource Network state.

Planned scope:

- capability-scoped Store/Repair/Cache/Gateway/Relay discovery;
- stable developer provider/node/service descriptors;
- lifecycle and degraded-state reporting;
- deterministic ordering/filtering;
- bounded operator/developer health information;
- no credentials, secret configuration or trust grants in public responses;
- discovery responses explicitly non-authoritative for settlement or canonical storage state.

### SR-9.6 — reference SDK and language-neutral schemas

Build the supported client contract over SR-9.1 through SR-9.5.

Planned scope:

- Go reference SDK first, using public SR-9 DTOs rather than execution-internal structs;
- language-neutral JSON schemas and golden wire fixtures for additional SDKs;
- typed retrieval/upload/manifest/discovery clients;
- context cancellation and bounded retries;
- idempotency support for mutation calls;
- typed error categories with preservation of server detail without leaking secrets;
- endpoint/TLS/auth configuration;
- compatibility tests against the HTTP implementation.

### SR-9.7 — repair, cache and gateway developer helpers

Make the Resource Network family easy to consume without conflating acceleration/recovery layers with canonical truth.

Planned scope:

- retrieval policy helpers for cache/gateway use;
- cache status/invalidation-safe client semantics;
- repair request/status helpers tied to canonical object identity;
- retrievability and repair state kept distinct from agreement/proof/settlement state;
- route/provider metadata for diagnostics;
- explicit failure/fallback reporting;
- end-to-end tests across Store → Cache/Gateway → Repair paths.

### SR-9.8 — semantics-preserving S3 compatibility adapter

Provide optional S3-shaped access only where S3 operations can be represented faithfully.

Planned scope:

- bucket/key namespace mapping to explicit 420 object identity rules;
- PUT/GET/HEAD/DELETE compatibility subset with documented support matrix;
- multipart upload mapped to bounded upload sessions without pretending incomplete parts are canonical objects;
- ETag semantics documented separately from 420 content/shard commitments;
- authentication adapter that cannot bypass 420 authorization;
- no silent mapping of unsupported ACL/versioning/consistency semantics;
- unsupported operations fail explicitly;
- AWS-compatible client interoperability tests against the supported subset.

### SR-9.9 — examples, local developer workflow and Developer Hub integration

Make the supported path reproducible for application developers.

Planned scope:

- minimal public retrieval example;
- private session-authorized retrieval example;
- upload → manifest → retrieval example;
- provider discovery/status example;
- S3-compatible example for supported operations;
- local/testnet configuration templates with no embedded secrets;
- Developer Hub/API reference integration;
- troubleshooting guidance that distinguishes authorization, routing, integrity, canonical-state and provider failures.

### SR-9.10 — compatibility, security and monolithic closeout

Qualify the completed developer surface before merging SR-9.

Planned scope:

- freeze/document SR-9 v1 compatibility contract;
- wire-format golden tests and backwards-compatibility gate;
- fuzz/property tests for request parsing and manifest helpers;
- auth/default-deny regression suite;
- payload-integrity and route-substitution tests;
- SDK ↔ HTTP end-to-end qualification;
- S3 supported-subset interoperability qualification;
- privacy/logging review for identifiers, credentials and private metadata;
- developer operations/API documentation closeout;
- reconcile current `main`, then run final exact-head node420 and Integrated qualification.

### SR-9 merge policy

Treat SR-9 as one monolithic phase. SR-9.1 through SR-9.10 remain on the SR-9 integration branch and may be individually qualified while evolving, but SR-9 merges to `main` only once after the final reconciled exact head passes all required gates.

### SR-9 exit criteria

SR-9 is complete when an application can discover qualified resource services, construct canonical-safe object/manifest requests, upload and retrieve through a stable versioned API/SDK, use repair/cache/gateway helpers and optionally use the documented S3-compatible subset without gaining any authority that the underlying Resource Protocol, 420Store, Gateway or trust-domain system does not already grant.

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
SR-8 Unified Resource Network — COMPLETE / MERGED
    ↓
SR-9 developer API / SDK / S3 compatibility — IN PROGRESS
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
