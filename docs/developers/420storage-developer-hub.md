---
title: 420Storage Developer Hub
audience:
  - developer
  - operator
category: developer
status: complete
version: current
---

# 420Storage Developer Hub

420Storage is the **versioned developer and runtime integration surface** for the completed Storage & Resource suite. It composes the canonical **420Store** product with 420Gateway, 420Cache, 420Repair and the shared Resource Network runtime. It is not a separate chain protocol and does not create a second source of truth.

Canonical provider identity, offers, authorization, sessions, capacity reservations, storage agreements, commitments, manifests, placements, proof receipts and storage settlement are owned by the 420 Resource Protocol / 420Store contracts and canonical chain state. 420Vault remains the custodian for storage payment obligations. Provider filesystems, runtime status, Gateway routes, Cache entries, Repair decisions, SDK objects, S3 metadata and deployment evidence are operational or derived state only.

## Naming and ownership

| Public name | Implementation role | Authority |
| --- | --- | --- |
| **420 Resource Protocol** | provider/node/offers/sessions/receipts and shared resource contracts | canonical chain/protocol authority |
| **420Store** | durable storage agreements, capacity, commitments, proofs, manifests and settlement | canonical chain/protocol authority |
| **420Storage** | v1 HTTP/SDK/S3/developer integration layer | adapter; non-canonical |
| **420Repair** | repair/reconstruction orchestration | off-chain operational capability |
| **420Cache** | cache/retrieval acceleration | off-chain operational capability |
| **420Gateway** | public/private retrieval routing | off-chain operational capability |
| **420Relay** | resource-network relay delivery | protocol product plus off-chain delivery |

The canonical Resource Protocol has four on-chain service classes: **420Relay, 420Store, 420Cache and 420Gateway**. The unified Resource Network runtime also exposes a fifth operational capability, `repair`. `repair` is not a fifth canonical Resource Protocol service class.

## Getting started

For a native 420Storage integration:

1. resolve the correct chain/network and canonical Resource/Storage contract deployments;
2. read canonical object/agreement/commitment/manifest state from the owning contracts or a provenance-preserving projection;
3. start or connect to qualified Resource Network services;
4. use the frozen `v1` developer interface for retrieval and bounded upload transport;
5. use canonical protocol transactions for authority-changing state such as agreements, placements, proofs or settlement;
6. verify retrieved bytes against the declared size and SHA-256 shard root;
7. treat route/provider/cache/repair/health information as operational evidence only.

There is no standalone end-user 420Store UI in this suite. Application teams may build presentation layers over these interfaces, but those UIs must preserve the authority boundaries documented here.

## Frozen v1 compatibility contract

The developer contract is frozen at `v1`.

Language-neutral schema:

`docs/schemas/storage/v1/storage420.schema.json`

Stable schema identifier:

`urn:420integrated:storage:v1`

Golden fixtures under `sdk/storage420/testdata` are compatibility gates. Existing v1 field names, required meanings or serialized shapes must not drift silently. Incompatible evolution requires a new API version. Additive changes must preserve existing v1 consumers and update the schema, fixtures, SDK and documentation together.

Production closeout also freezes these evidence/configuration schemas:

- topology/config: `storage-topology-v1`;
- disaster-recovery evidence: `storage-dr-v1`;
- testnet deployment evidence: `storage-testnet-evidence-v1`.

These schemas describe deployment/runtime evidence. They do not authorize protocol state changes.

## Object identity

Every native retrieval/upload is bound to the full object reference:

- `object_id`;
- `manifest_id`;
- `shard_index`;
- `shard_root`;
- `size_bytes`;
- `commitment_id`.

Do not substitute an S3 ETag, cache key, route/provider identifier or local filename for canonical object identity.

## HTTP retrieval interface

The implemented route is:

`GET /v1/resources/retrieve`

`HEAD /v1/resources/retrieve` is also supported.

Required query fields are `object_id`, `manifest_id`, `shard_index`, `shard_root`, `size_bytes` and `commitment_id`.

Example public read:

```bash
curl --fail-with-body \
  "$420_STORAGE_URL/v1/resources/retrieve?object_id=$OBJECT_ID&manifest_id=$MANIFEST_ID&shard_index=$SHARD_INDEX&shard_root=$SHARD_ROOT&size_bytes=$SIZE_BYTES&commitment_id=$COMMITMENT_ID" \
  --output object.bin
```

Successful responses support ETag/`If-None-Match`, byte `Range` requests and `HEAD`. Operational response headers may include:

- `X-420-Route-Tier`;
- `X-420-Provider-ID`;
- `X-420-Node-ID`.

Those headers describe the route that served the request. They are not canonical proof of placement, ownership, availability or settlement.

### Private retrieval

Private reads are default-deny. The request must carry explicit 420 authorization metadata:

- `X-420-Access-Mode: private`;
- `X-420-Subject`;
- `X-420-Session-ID`;
- `X-420-Capability: read`.

```bash
curl --fail-with-body \
  -H 'X-420-Access-Mode: private' \
  -H "X-420-Subject: $420_SUBJECT" \
  -H "X-420-Session-ID: $420_SESSION_ID" \
  -H 'X-420-Capability: read' \
  "$420_STORAGE_URL/v1/resources/retrieve?object_id=$OBJECT_ID&manifest_id=$MANIFEST_ID&shard_index=$SHARD_INDEX&shard_root=$SHARD_ROOT&size_bytes=$SIZE_BYTES&commitment_id=$COMMITMENT_ID" \
  --output object.bin
```

Forwarded-host or forwarding identity headers are not accepted as authorization. Keep subject/session values out of manifests, logs, screenshots and source-controlled configuration.

### HTTP request limits and transport policy

Default developer HTTP policy:

| Control | Default |
| --- | ---: |
| request timeout | 15 seconds |
| maximum request URI | 8,192 bytes |
| maximum headers | 16,384 bytes |
| request body on retrieval | not allowed |
| read-header timeout | 5 seconds |
| idle timeout | 30 seconds |
| public TLS minimum | TLS 1.2 |

A non-loopback developer API bind requires **both TLS certificate/key configuration and an explicit allowed-host list**. The host guard validates the actual HTTP `Host`; forwarded host headers do not override it.

## HTTP errors

The retrieval HTTP error envelope is:

```json
{"version":"v1","error":"...","code":"..."}
```

Implemented error codes are:

| HTTP | code | Meaning |
| ---: | --- | --- |
| 400 | `invalid_request` | malformed or invalid object/access request |
| 400 | `request_body_not_allowed` | retrieval request included a body |
| 403 | `access_denied` | private access failed authorization |
| 405 | `method_not_allowed` | method other than GET/HEAD |
| 414 | `request_uri_too_large` | URI exceeds configured maximum |
| 431 | `headers_too_large` | headers exceed configured maximum |
| 502 | `resource_unavailable` | eligible route/source could not serve verified data |
| 503 | `api_unavailable` | developer API backend unavailable |
| 504 | `request_timeout` | request cancelled or timed out |

A bad byte range returns HTTP 416 with a `Content-Range: bytes */<size>` response. Do not convert integrity or authorization failures into local success states.

## Go SDK

The reference SDK is `sdk/storage420`. It owns public DTOs rather than exporting execution/runtime structs.

```go
transport, err := storage420.NewHTTPTransport(os.Getenv("420_STORAGE_URL"), nil)
if err != nil { log.Fatal(err) }
client := storage420.NewClient(transport)

result, err := client.Retrieve(ctx, storage420.RetrieveRequest{
    Object: storage420.ObjectRef{
        ObjectID: objectID,
        ManifestID: manifestID,
        ShardIndex: shardIndex,
        ShardRoot: shardRoot,
        SizeBytes: sizeBytes,
        CommitmentID: commitmentID,
    },
    Access: storage420.ReadAccess{Mode: storage420.AccessPublic},
})
if err != nil { log.Fatal(err) }
_ = result.Payload
```

SDK retries are bounded and cancellation-aware. Retrieval verifies exact byte length and SHA-256 shard root before returning payload bytes. SDK error typing is an application-facing classification layer; the owning protocol/runtime error remains the source of the underlying failure.

## Upload preparation and ingest

Uploads use a two-stage developer transport boundary: **prepare**, then **ingest**. They do not directly create canonical agreements, placements or proofs.

Preparation requires:

- complete object identity;
- an idempotency key;
- `agreement_id`;
- `capacity_reservation_id`;
- `commitment_id` matching the object commitment;
- an eligible running `store` capability.

Implemented defaults/limits:

- maximum object size: **64 MiB** (`64 << 20` bytes), unless a stricter configured maximum is supplied;
- maximum idempotency-key length: **256 bytes**;
- empty idempotency keys are rejected.

The upload ID is deterministic over the v1 object identity, idempotency/precondition data and selected provider/node/service identity.

Ingest is single-flight per idempotency key. A completed identical replay returns the prior receipt; a conflicting replay fails; a concurrent identical upload reports that the upload is already in progress. Bytes are staged through a bounded reader, exact size is checked, SHA-256 shard root is verified, and only then are bytes passed to the configured storage sink. Temporary staging is removed after completion/failure.

A `DeveloperUploadReceipt` is transport evidence only. It does not make a placement, manifest, agreement, proof or settlement canonical.

## Upload → manifest → retrieval workflow

A safe application flow is:

1. resolve an effective STORE offer and qualified provider/node;
2. obtain canonical agreement/capacity/commitment prerequisites;
3. calculate shard root and exact byte length locally;
4. prepare upload with the complete identity/preconditions and unique idempotency key;
5. ingest exactly the declared bytes;
6. build/validate manifest and placement data;
7. perform the required canonical protocol transactions to register placement/seal state;
8. retrieve through 420Gateway/420Storage;
9. verify exact payload identity;
10. use proof/settlement state from the owning contracts, not the upload receipt.

## Discovery, capabilities and lifecycle

The unified Resource Network runtime recognizes these operational capabilities:

- `store`;
- `repair`;
- `cache`;
- `gateway`;
- `relay`.

Operational service lifecycle states are:

`registered → starting → running ↔ degraded → stopped/failed`

with restart paths from `stopped` or `failed` back to `starting` as implemented by the lifecycle coordinator.

Running services are discoverable by default. Degraded services require explicit opt-in. Registered, starting, stopped and failed services are not normal active routes.

Remember: the off-chain `repair` capability does not alter the four canonical on-chain Resource Protocol service classes.

## Runtime configuration and operational permissions

Resource Network configuration has two scopes:

- `shared` — non-secret configuration only; cannot be bound to one service and cannot be marked secret;
- `service` — configuration bound to a known service; may contain secret values.

Configuration snapshots redact values marked secret.

The runtime also has explicit **operational trust grants**, separate from on-chain protocol authorization. Trust domains and allowed authorities are:

| Domain | Allowed operational authorities |
| --- | --- |
| `storage` | `data.read`, `data.write` |
| `delivery` | `data.read`, `discover`, `serve` |
| `economic` | `settlement.read` |
| `control` | `lifecycle`, `credential.read` |

Unknown or cross-domain grants fail closed. These grants do not create chain capabilities, Wallet permissions, settlement rights or contract authority.

## Cache, Gateway and Repair helpers

Developer helper state is deliberately non-authoritative:

- cache: `missing`, `fresh`, `expired`;
- gateway: selected route tier/provider/node plus fallback diagnostics;
- repair: retrievability/recoverability/degradation and replacement-shard guidance.

A caller may forbid cache or Store fallback. Discovery cannot override that request policy. Repair preserves canonical object/manifest/commitment identity and cannot rewrite historical placements to make a replacement provider appear original.

## S3 compatibility

S3 compatibility is translation only.

| S3-shaped operation | v1 behavior |
| --- | --- |
| GET | resolve bucket/key to explicit 420 object identity, then use native retrieval/auth |
| HEAD | same identity/auth path; returns size and compatibility ETag |
| PUT | bounded/idempotent upload prepare + ingest |
| DELETE | supported only when an explicit canonical-aware deleter is configured |
| Multipart | unsupported |
| ACL mutation | unsupported; cannot override 420 authorization |
| S3 versioning | unsupported; not mapped to canonical object identity |

Private-namespace PUT is default-deny unless an explicit `S3PutAuthorizer` approves it. S3 ETags are MD5-derived compatibility values for single-part behavior; they are never 420 shard roots, commitments, proofs, placements or canonical identifiers.

The adapter exposes `ErrS3Compatibility` for invalid/failed compatibility operations and `ErrS3Unsupported` for intentionally unsupported semantics.

## Production topology and evidence

Production qualification requires a reproducible multi-provider topology with at least two providers. Production tooling validates provider/node/service identity, frozen API/config compatibility and deterministic discovery/failover.

Operational credentials are explicitly non-canonical. Credential state stores secret digests rather than raw secrets, supports rotation/revocation/recovery and produces redacted evidence.

Disaster-recovery evidence is also operational: a backup cannot overwrite canonical chain/manifests/placements/history. Restore reconciles exact manifest identity and topology fingerprints and enforces configured RPO/RTO policy.

Default SR-10 operator alert thresholds are qualification defaults, not consensus rules:

- Store capacity warning at 80%, critical at 90%;
- Repair backlog warning at 25, critical at 100;
- first verified integrity failure is critical;
- authorization warning at 25 failures per aggregation window;
- Gateway routing warning at 10 failures per aggregation window.

Availability, integrity and recovery SLO targets are deployment configuration. SLO evaluation is evidence only.

Testnet launch evidence must include upload, manifest, verified retrieval, cache route, Gateway route and repair-reconstruction checks, plus provider-loss, discovery-degradation and credential-revocation recovery drills. Unresolved critical launch blockers invalidate the evidence bundle.

## Economics and fees

420Storage does not invent a separate developer-API fee schedule.

Canonical economics come from Resource Protocol offers/sessions and 420Store storage agreements. For storage settlement, the canonical amount is derived from agreement size and offer unit price, then split across proof windows. 420Vault holds the obligations; qualifying proof windows are released to the provider and missed windows can be refunded according to canonical settlement rules.

Gateway/Cache/Relay metering uses the Resource Protocol's bounded session/receipt semantics. Provider-local invoices, SDK counters or runtime accounting projections cannot expand user spend authority.

## Events and exact contract errors

Solidity events and custom errors are generated from the contract source/ABI pipeline and belong to the canonical generated reference:

- [Generated contracts](../reference/generated/contracts.md)
- [Generated events and custom errors](../reference/generated/events-errors.md)

Do not maintain a second handwritten ABI/event catalogue here. 420Indexer may project these events for efficient queries, but the Indexer is rebuildable and non-canonical. Explorer, Search and Analytics may display or derive information from the same sources without becoming protocol authority.

Runtime/developer sentinels include the Resource Network/config/trust/lifecycle/discovery/accounting/observation failure classes, `ErrDeveloperAPI`, `ErrDeveloperUpload`, S3 compatibility/unsupported errors, and component-specific Cache/Gateway/Repair errors. Applications should handle them by class and preserve the underlying cause rather than treating presentation-layer success as canonical recovery.

## Security and trust boundaries

- private reads and private S3 writes fail closed;
- forwarded host/identity data is not promoted to authority;
- non-loopback developer HTTP requires TLS + allowed hosts;
- upload bytes are verified before storage-sink handoff;
- route/cache/health/evidence state is non-canonical;
- shared runtime configuration cannot contain secrets;
- service secrets are redacted from snapshots;
- credentials/sessions/bearer values must not be logged;
- a healthy provider filesystem is not proof of canonical capacity, placement, proof acceptance or settlement;
- a canonical reservation/placement is not proof that local bytes are currently retrievable.

## Derived and presentation layers

When consuming ecosystem tools, keep these roles separate:

- **420 Wallet / Smart Account** — user signing/authorization boundary; does not define storage state;
- **420Indexer** — rebuildable query projection; does not outrank owning contracts;
- **420 Explorer** — presentation of chain/indexed data;
- **420 Search** — discovery/presentation layer;
- **420 Analytics** — derived metrics/analysis;
- **420Status / alerts** — operational evidence;
- **420Storage HTTP/SDK/S3** — developer adapters;
- **420Gateway/Cache/Repair/Relay runtime** — delivery and recovery services.

For authority-sensitive decisions, re-read the canonical owning contract state and required finality.

## Troubleshooting

**403 / `access_denied`** — verify private subject/session/read capability and the configured authorizer. Do not retry by changing a private request to public.

**502 / `resource_unavailable`** — inspect eligible discovery results, service lifecycle, provider transport, Cache→Store fallback policy and integrity verification. Do not interpret routing failure as canonical object absence.

**503 / `api_unavailable`** — developer API backend is not configured/available.

**504 / `request_timeout`** — check cancellation/deadline propagation and provider latency; retries must remain bounded.

**431 / `headers_too_large` or 414 / `request_uri_too_large`** — reduce request metadata rather than raising limits without an operator review.

**Upload size/root mismatch** — discard the staged bytes and re-resolve the canonical object metadata. Never accept the bytes under a locally invented identity.

**Idempotency conflict / already in progress** — do not rotate keys merely to force duplicate storage. Resolve whether the prior logical upload succeeded or is still active.

**No Store provider available** — inspect running Store capability discovery and topology; do not manufacture a provider endpoint.

**Degraded repair/cache/gateway** — use Store fallback or qualified repair only when permitted. Availability recovery cannot rewrite canonical history.

**S3 unsupported** — multipart, ACL mutation and versioning are intentionally unsupported in v1; use the native 420Storage/420Store workflow when those semantics cannot be preserved.

## FAQ

### Is 420Storage the same as 420Store?

No. 420Store is the canonical durable-storage product/protocol surface. 420Storage is the developer/runtime integration layer that makes Store/Gateway/Cache/Repair easier to consume without changing canonical authority.

### Is 420Repair a fifth Resource Protocol service class?

No. `repair` is a unified Resource Network runtime capability. The canonical Resource Protocol products remain Relay, Store, Cache and Gateway.

### Can I trust 420Indexer or Explorer for final storage state?

They are useful projections/presentation layers. Recheck the owning contracts and required finality for authority-sensitive decisions.

### Does a successful upload mean the object is canonically stored?

No. Upload success proves a verified transport write. Canonical storage depends on agreement/capacity/commitment/manifest/placement/proof state.

### Can S3 ACLs grant access?

No. S3 ACL mutation is unsupported and cannot override 420 authorization.

### Does an accepted storage proof automatically pay the provider?

No. Proof receipts are evidence. Storage settlement separately releases or refunds bounded Vault obligations per canonical proof window.

### Are production alert thresholds consensus rules?

No. They are default operational qualification policy and may be changed as versioned deployment configuration.

## Canonical documentation ownership

- protocol contracts, permissions, economics, proof/settlement semantics: [Storage Proof & Resource Protocol](../architecture/protocols/storage-proof-resource-protocol.md)
- provider/runtime topology and trust boundaries: [Storage & Resource infrastructure](../architecture/infrastructure/storage-resource-infrastructure.md)
- task-oriented developer/API/SDK/S3 guidance: **this page**
- operator lifecycle, incidents and service recovery: [420 Resource Network operations](../420RESOURCE-NETWORK-OPERATIONS.md) and [420Gateway operations](../420GATEWAY-OPERATIONS.md)
- production qualification/evidence details: linked 420Storage production qualification pages under `docs/developers/`
- exact Solidity ABI/events/custom errors: [generated reference](../reference/index.md)

## Related documentation

- [Storage and Resource integration](storage-and-resource-integration.md)
- [420Storage production topology](420storage-production-topology.md)
- [420Storage fault injection](420storage-fault-injection.md)
- [420Storage load/capacity qualification](420storage-load-capacity-qualification.md)
- [420Storage upgrade compatibility](420storage-upgrade-compatibility.md)
- [420Storage credential rotation](420storage-credential-rotation.md)
- [420Storage disaster recovery](420storage-disaster-recovery.md)
- [420Storage security and abuse review](420storage-security-abuse-review.md)
- [420Storage operator alerts/SLOs](420storage-operator-slos.md)
- [420Storage testnet deployment evidence](420storage-testnet-evidence.md)
- [420Storage production launch closeout](420storage-production-launch-closeout.md)
- [420Store & storage resource roadmap](../architecture/infrastructure/420store-roadmap.md)
- [Generated reference](../reference/index.md)
- Go SDK: `sdk/storage420`
