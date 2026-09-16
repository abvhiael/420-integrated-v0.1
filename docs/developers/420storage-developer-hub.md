---
title: 420Storage Developer Hub
audience:
  - developer
category: developer
status: current
version: current
---

# 420Storage Developer Hub

420Storage is the developer-facing integration surface for **420Store**, **420Gateway**, **420Cache**, **420Repair**, and the shared Resource Network runtime. It is an adapter layer, not a new authority domain: canonical provider eligibility, offers, sessions, storage agreements, capacity reservations, commitments, manifests, placements, accepted proofs, Vault obligations, and settlement remain owned by the underlying chain contracts.

`420Repair` is an operational/runtime capability over canonical 420Store state. It is **not** a fifth canonical Resource Protocol service class. The four canonical service classes remain **420Relay, 420Store, 420Cache, and 420Gateway**.

## Getting started

For a first integration:

1. obtain canonical object identity and any agreement/commitment prerequisites from the owning protocol state;
2. create an SDK `HTTPTransport` for a qualified developer API endpoint;
3. retrieve a known public object through `GET /v1/resources/retrieve`;
4. verify that the SDK returns the expected payload only after exact size and SHA-256 root validation;
5. add private access only after a real authorization integration is available;
6. use upload preparation, discovery, and status only through a transport/runtime integration that actually implements those SDK interfaces.

The checked-in `HTTPTransport` currently implements **retrieval only**. It deliberately returns `unsupported` for `PrepareUpload`, `Discover`, and `Status`; there are no public v1 HTTP endpoints for those operations in the current code.

## Frozen v1 compatibility contract

The public developer version is `v1`. The language-neutral schema is `docs/schemas/storage/v1/storage420.schema.json` with stable identifier `urn:420integrated:storage:v1`. Golden fixtures under `sdk/storage420/testdata` are compatibility gates.

Existing v1 field names and meanings must not drift silently. Incompatible evolution requires a new API version. Additive changes still need synchronized schema, fixture, SDK, and documentation updates.

Frozen production compatibility identifiers used by the completed SR suite are:

- developer API: `v1`;
- topology/config schema: `storage-topology-v1`;
- disaster-recovery evidence schema: `storage-dr-v1`;
- testnet evidence schema: `storage-testnet-evidence-v1`.

These identifiers describe compatibility/evidence formats. They do not make SDK output, HTTP responses, topology files, backups, or qualification bundles canonical protocol state.

## Object identity

Every native retrieval/upload plan is bound to the full object reference:

- `object_id`;
- `manifest_id`;
- `shard_index`;
- `shard_root`;
- `size_bytes`;
- `commitment_id`.

Do not substitute an S3 ETag, cache key, provider ID, route tier, local filename, or UI/indexer identifier for canonical object identity.

## HTTP retrieval API

The current developer HTTP surface exposes one resource route:

`GET /v1/resources/retrieve`

`HEAD /v1/resources/retrieve`

Required query parameters are `object_id`, `manifest_id`, `shard_index`, `shard_root`, `size_bytes`, and `commitment_id`.

```bash
curl --fail-with-body \
  "$420_STORAGE_URL/v1/resources/retrieve?object_id=$OBJECT_ID&manifest_id=$MANIFEST_ID&shard_index=$SHARD_INDEX&shard_root=$SHARD_ROOT&size_bytes=$SIZE_BYTES&commitment_id=$COMMITMENT_ID" \
  --output object.bin
```

Successful responses use `application/octet-stream`, advertise `Accept-Ranges: bytes`, and may include:

- `ETag`;
- `X-420-Route-Tier`;
- `X-420-Provider-ID`;
- `X-420-Node-ID`;
- `Content-Range` on partial responses.

Route/provider/node headers are operational diagnostics only. They do not prove canonical placement, ownership, authorization, proof acceptance, or settlement.

### Conditional, HEAD, and Range behavior

The endpoint supports strong ETags and `If-None-Match`; a match returns `304 Not Modified`. `HEAD` follows the same authorization/routing/status/metadata path as `GET` but sends no payload body.

A supported single byte range returns `206 Partial Content`. Malformed, unsupported, multi-range, or unsatisfiable ranges return `416 Range Not Satisfiable`. Full upstream payload identity is verified before range serving can bypass integrity checks.

### Request bounds

The default handler policy is:

- request timeout: **15 seconds**;
- maximum request URI: **8192 bytes**;
- maximum aggregate request-header bytes: **16384 bytes**;
- request bodies: **not allowed** on the retrieval endpoint.

A non-loopback developer HTTP listener requires both TLS certificate/key configuration and an explicit allowed-Host list. TLS minimum version is 1.2. The service validates the actual HTTP `Host`; forwarding headers are not promoted to host authority.

## Private retrieval and authorization

Public access is the default only when the request is actually for public content. Private access is fail-closed and requires all of:

- `X-420-Access-Mode: private`;
- `X-420-Subject`;
- `X-420-Session-ID`;
- `X-420-Capability: read`;
- a configured authorizer that accepts the request.

```bash
curl --fail-with-body \
  -H 'X-420-Access-Mode: private' \
  -H "X-420-Subject: $420_SUBJECT" \
  -H "X-420-Session-ID: $420_SESSION_ID" \
  -H 'X-420-Capability: read' \
  "$420_STORAGE_URL/v1/resources/retrieve?object_id=$OBJECT_ID&manifest_id=$MANIFEST_ID&shard_index=$SHARD_INDEX&shard_root=$SHARD_ROOT&size_bytes=$SIZE_BYTES&commitment_id=$COMMITMENT_ID" \
  --output object.bin
```

Forwarded identity headers are not an authorization substitute. Never place subject/session credentials, bearer material, or service secrets in manifests, public telemetry, screenshots, or source-controlled configuration.

## Go SDK

The reference SDK lives at `sdk/storage420`. Its DTOs are public developer types rather than aliases of execution/runtime structs.

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

The SDK default retry policy is three attempts with a 100 ms base delay. Only typed `unavailable` and `transport` failures are retried, and waits are cancellation-aware. The HTTP client default timeout is 20 seconds.

The HTTP transport verifies the exact response length and SHA-256 payload root before returning bytes. A successful HTTP status with the wrong payload is an integrity failure, not a success.

## SDK error kinds

The stable SDK error classes are:

| Kind | Meaning | Retry guidance |
| --- | --- | --- |
| `invalid_request` | malformed/unsupported request inputs | fix request; do not blind-retry |
| `unauthorized` | missing/rejected private authorization | re-establish authority; do not weaken access |
| `unavailable` | qualified resource temporarily unavailable | bounded retry may be safe |
| `integrity` | returned bytes do not match declared identity | fail closed; investigate source |
| `transport` | network/client transport failure | bounded retry may be safe |
| `unsupported` | requested SDK operation is not implemented by the selected transport | choose an implementing transport/path |

For the current HTTP endpoint, structured errors include:

- `405` / `method_not_allowed`;
- `414` / `request_uri_too_large`;
- `431` / `headers_too_large`;
- `400` / `request_body_not_allowed`;
- `503` / `api_unavailable`;
- `400` / `invalid_request`;
- `403` / `access_denied`;
- `504` / `request_timeout`;
- `502` / `resource_unavailable`.

## Upload preparation and ingest

Upload support exists as an execution/runtime coordinator, not as a public v1 HTTP upload endpoint.

The coordinator defaults to a **64 MiB** maximum prepared object size unless an operator configures a different bound. Preparation requires:

- the complete object identity;
- a non-empty idempotency key of at most **256 bytes**;
- `agreement_id`;
- `capacity_reservation_id`;
- `commitment_id` matching the object reference;
- an eligible running Store service discovered by the runtime.

The upload ID is deterministic over the prepared identity, prerequisites, idempotency key, and selected provider/node/service.

Ingest stages the payload before the backend write, reads no more than the declared size plus one byte, requires the exact declared byte count, verifies the SHA-256 shard root, and calls the storage sink only after verification. Concurrent reuse of the same idempotency key is single-flight: a conflicting upload ID fails, the same in-progress upload is rejected as already in progress, and a completed identical replay returns the prior receipt without a second backend write. A failed attempt releases the in-flight reservation so a valid retry can proceed.

Upload plans and receipts are operational transport evidence. They do not create canonical agreements, reservations, commitments, placements, manifests, proofs, or settlement.

## Manifest, placement, and repair integration

Applications should treat the native flow as:

1. establish canonical Store offer/provider eligibility;
2. reserve canonical capacity;
3. create the immutable commitment and proposed agreement;
4. activate the agreement only after reservation/commitment checks pass;
5. upload verified off-chain shard bytes;
6. register shard placements against active agreements;
7. seal the manifest only when all declared shard placements exist;
8. treat the object as retrievable only while enough placements remain live to meet `dataShards`;
9. if a sealed shard placement becomes unavailable, use the protocol-valid repair path to replace its backing agreement while preserving shard index, root, and byte length.

A repaired placement may change agreement, commitment, node, and provider. It may not rewrite the object/shard content identity or historical proof/settlement provenance.

## Discovery, status, and runtime capabilities

The Resource Network runtime exposes operational capabilities named:

- `store`;
- `repair`;
- `cache`;
- `gateway`;
- `relay`.

Running services are eligible for normal discovery. Degraded services are advisory and require explicit degraded inclusion. Registered, starting, stopped, and failed services are unavailable for ordinary routing.

The service lifecycle is:

`registered → starting → running ↔ degraded`, with bounded transitions to `failed` or `stopped`; `failed` and `stopped` may re-enter through `starting` where allowed.

Discovery/status output is derived operational state. It must never be used as proof that an agreement is effective, a manifest is canonical, a storage proof was accepted, or a payment settled.

The SDK `Transport` interface contains `Discover` and `Status`, but the checked-in HTTP transport currently returns `unsupported` for them. Integrations must not invent `/discover` or `/status` HTTP routes.

## Cache, Gateway, and Repair helpers

Native helper state includes:

- cache: `missing`, `fresh`, `expired`;
- gateway: selected tier/provider/node plus explicit fallback diagnostics;
- repair: sealed/retrievable/recoverable/degraded state and replacement shard indexes.

A caller may forbid cache or Store fallback. Discovery cannot override caller routing policy. Cache freshness, Gateway reachability, and Repair eligibility are acceleration/recovery signals, not chain authority.

## S3 compatibility subset

The S3 adapter is a translation layer only.

| S3-shaped operation | Current behavior |
| --- | --- |
| GET | resolves bucket/key to explicit 420 object identity, then uses native retrieval/auth |
| HEAD | same identity/auth path; returns size and S3-shaped ETag |
| PUT | uses native bounded/idempotent upload preparation + ingest when an implementing backend is wired |
| DELETE | supported only when an explicit canonical-aware deleter is configured |
| Multipart | unsupported |
| ACL mutation | unsupported; cannot override 420 authorization |
| S3 versioning | unsupported; not silently mapped to canonical identity |

For single-part compatibility operations, the S3 ETag is an MD5-derived compatibility value. It is not a 420 shard root, manifest hash, commitment, proof, or canonical object identifier.

## Configuration and security boundaries

Shared Resource Network configuration may contain only non-secret values. Service-scoped configuration may be secret, but snapshots redact secret values. Service credentials are operational/noncanonical and use digest-based validation; raw credentials are not qualification evidence.

Production credential operations include bounded-overlap rotation, immediate zero-overlap compromise rotation, full-service revocation, and recovery into a new credential generation. A successful credential check authorizes only the configured service boundary; it does not confer chain or storage-protocol authority.

Production topology requires at least two distinct providers. The topology, service health, alert stream, SLO calculations, backups, and launch evidence remain derived operational state.

## Operational alert and SLO defaults

The qualified default alert policy is:

- Store capacity: warning at 80%, critical at 90%;
- Repair backlog: warning at 25, critical at 100;
- integrity failure: critical on the first verified failure;
- authorization failures: warning at 25 in the configured aggregation window;
- Gateway routing failures: warning at 10 in the configured aggregation window;
- degraded service: warning;
- failed or stopped service: critical.

Availability, integrity, and recovery SLOs are evaluated independently and all must pass for an overall SLO pass. Thresholds are deployment configuration, not consensus rules. The qualification guide uses a representative 99.5% availability / 100% verified integrity / 15-minute recovery target, but production operators must bind the actual launch values to deployment evidence.

## Backup, recovery, upgrades, and launch evidence

`storage-dr-v1` backups contain operational reconciliation evidence only. They exclude payload authority, credentials, agreements, proofs, and settlement authority. Restore must reconcile exact canonical manifest identity and topology, enforce configured RPO/RTO, and must not overwrite canonical history.

Rolling upgrades permit software-version changes while preserving developer API `v1`, topology schema `storage-topology-v1`, provider/node identity, and immutable manifest identity. Silent API/schema drift or provider/node substitution is rejected.

`storage-testnet-evidence-v1` binds an exact software commit, configuration fingerprint, topology fingerprint, required end-to-end checks, recovery drills, SLO evidence, and launch blockers. An evidence bundle with an unresolved critical launch blocker is invalid. Qualification evidence proves what was tested; it does not create protocol truth.

## Local/testnet workflow

Use `examples/storage420/local-testnet.env.example` as the checked-in template. Copy it outside source control when secrets are needed and inject caller/session credentials at runtime.

Suggested loop:

1. start the local/testnet Resource Network services;
2. point `420_STORAGE_URL` at the developer retrieval API;
3. populate object identity from a canonical reader/test fixture;
4. perform public retrieval;
5. for private content, inject subject/session authorization at runtime and repeat;
6. test Range/ETag/HEAD behavior if your client depends on it;
7. exercise upload/discovery/status only through an implementation that actually provides those interfaces;
8. compare operational route/status information with canonical state rather than replacing it.

Local loopback HTTP is development-only. Non-loopback SDK/developer API endpoints require HTTPS/TLS boundaries.

## Troubleshooting

**Authorization** — `403/access_denied`, missing subject/session/read capability, revoked credentials, or no configured authorizer. Re-establish valid authority; never change a private request to public merely to make it work.

**Routing/provider** — `502/resource_unavailable`, no running eligible source, exhausted allowed fallback, or provider transport failure. Discovery may diagnose eligibility but cannot invent a provider or canonical placement.

**Integrity** — size/root mismatch, substituted commitment/object identity, corrupt cache/provider bytes. Fail closed and re-resolve canonical identity; never relabel corrupt local bytes.

**Request bounds** — `414` means the URI exceeds policy; `431` means aggregate headers exceed policy; request bodies on retrieval return `400/request_body_not_allowed`.

**Upload/idempotency** — size mismatch, shard-root mismatch, idempotency conflict, upload already in progress, no running Store provider, or unavailable sink. Preserve the original key/identity and fix the actual prerequisite.

**Canonical storage state** — inactive agreement, missing reservation, mismatched commitment, incomplete/unsealed manifest, ineffective placement, or invalid proof. Correct the owning protocol state; do not patch SDK/provider state to simulate success.

**Repair** — a sealed placement can be replaced only after the incumbent service window has begun and the incumbent placement is no longer effective. Repair preserves shard index/root/size.

**S3** — unsupported ACL, multipart, or versioning semantics are explicit. Do not assume AWS-compatible behavior that is not implemented.

See [Shared protocol and provider troubleshooting](../troubleshooting/shared-protocol-provider.md) for canonical incident IDs and recovery guidance.

## FAQ

### Is 420Storage a separate canonical protocol?

No. The developer/runtime layer composes the 420 Resource Protocol and 420Store contracts. Canonical authority remains with the owning chain contracts and 420Vault settlement state.

### Is 420Repair a fifth Resource Protocol service?

No. `repair` is a runtime capability used to recover 420Store availability. Canonical Resource Protocol service IDs remain Relay, Store, Cache, and Gateway.

### Can I upload through `HTTPTransport`?

No. The current checked-in HTTP transport implements retrieval only. Upload preparation/ingest exists behind native runtime interfaces and S3/backend adapters where wired.

### Does a successful Gateway or Cache response prove the object is canonical?

No. Payload integrity is checked, but canonical agreement/manifest/placement/proof/settlement truth still comes from the protocol contracts.

### Does an accepted storage proof automatically pay the provider?

No. Proof acceptance creates verified proof receipt state. Storage settlement separately releases the matching proof-window Vault obligation.

### Can a repaired shard change its content root?

No. Placement repair preserves shard index, shard root, and byte length. It may rotate the backing agreement/commitment/node through protocol-valid state.

### Are SLOs consensus rules?

No. Alerts and SLOs are operator policy and launch evidence. They do not alter canonical protocol state.

## Canonical documentation ownership

Use these pages by topic:

- protocol contracts, lifecycle, permissions, events/errors, economics: [Storage Proof and Resource Protocol](../architecture/protocols/storage-proof-resource-protocol.md);
- runtime/topology/trust architecture: [Storage & Resource infrastructure](../architecture/infrastructure/storage-resource-infrastructure.md);
- developer API/SDK/S3/examples: this page and [Storage and Resource integration](storage-and-resource-integration.md);
- operations/recovery: [Resource Network operations](../420RESOURCE-NETWORK-OPERATIONS.md) and [420Gateway operations](../420GATEWAY-OPERATIONS.md);
- incidents: [Shared protocol and provider troubleshooting](../troubleshooting/shared-protocol-provider.md).

The SR-10 qualification pages remain reproducibility/evidence records and are not alternate canonical API or protocol specifications.

## References

- [Storage and Resource integration](storage-and-resource-integration.md)
- [Storage Proof and Resource Protocol](../architecture/protocols/storage-proof-resource-protocol.md)
- [Storage & Resource infrastructure](../architecture/infrastructure/storage-resource-infrastructure.md)
- [Resource Network operations](../420RESOURCE-NETWORK-OPERATIONS.md)
- [420Gateway operations](../420GATEWAY-OPERATIONS.md)
- [Shared protocol and provider troubleshooting](../troubleshooting/shared-protocol-provider.md)
- [420Store & storage resource roadmap](../architecture/infrastructure/420store-roadmap.md)
- JSON schema: `docs/schemas/storage/v1/storage420.schema.json`
- Go SDK: `sdk/storage420`
