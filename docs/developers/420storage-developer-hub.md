---
title: 420Storage Developer Hub
audience:
  - developer
category: developer
status: development
version: current
---

# 420Storage Developer Hub

420Storage exposes a versioned developer surface over 420Store, 420Gateway, 420Cache, 420Repair and the shared Resource Network. This layer is an adapter: canonical object identity, authorization, placements, commitments, proofs and settlement remain controlled by the underlying protocols and chain state.

## v1 object identity

Every retrieval and upload is bound to the full object reference:

- `object_id`
- `manifest_id`
- `shard_index`
- `shard_root`
- `size_bytes`
- `commitment_id`

Do not substitute an S3 ETag, cache key, route/provider identifier or local filename for those fields.

## Public retrieval

The developer HTTP endpoint is `GET /v1/resources/retrieve`.

```bash
curl --fail-with-body \
  "$420_STORAGE_URL/v1/resources/retrieve?object_id=$OBJECT_ID&manifest_id=$MANIFEST_ID&shard_index=$SHARD_INDEX&shard_root=$SHARD_ROOT&size_bytes=$SIZE_BYTES&commitment_id=$COMMITMENT_ID" \
  --output object.bin
```

Successful responses may include `X-420-Route-Tier`, `X-420-Provider-ID` and `X-420-Node-ID`. These are operational diagnostics only; they are not canonical proof of ownership, placement, availability or settlement.

## Private retrieval

Private reads are default-deny. Supply only the explicit 420 authorization metadata issued for the caller/session. Forwarding headers are not trusted as identity.

```bash
curl --fail-with-body \
  -H 'X-420-Access-Mode: private' \
  -H "X-420-Subject: $420_SUBJECT" \
  -H "X-420-Session-ID: $420_SESSION_ID" \
  -H 'X-420-Capability: read' \
  "$420_STORAGE_URL/v1/resources/retrieve?object_id=$OBJECT_ID&manifest_id=$MANIFEST_ID&shard_index=$SHARD_INDEX&shard_root=$SHARD_ROOT&size_bytes=$SIZE_BYTES&commitment_id=$COMMITMENT_ID" \
  --output object.bin
```

Keep subject/session credentials out of manifests, logs, screenshots and source-controlled configuration.

## Go SDK retrieval

The reference SDK lives at `sdk/storage420` and owns public DTOs rather than importing execution/runtime structs.

```go
transport, err := storage420.NewHTTPTransport(os.Getenv("420_STORAGE_URL"), nil)
if err != nil { log.Fatal(err) }
client := storage420.NewClient(transport)

result, err := client.Retrieve(ctx, storage420.RetrieveRequest{
    Object: storage420.ObjectRef{
        ObjectID: objectID, ManifestID: manifestID,
        ShardIndex: shardIndex, ShardRoot: shardRoot,
        SizeBytes: sizeBytes, CommitmentID: commitmentID,
    },
    Access: storage420.ReadAccess{Mode: storage420.AccessPublic},
})
if err != nil { log.Fatal(err) }
_ = result.Payload
```

SDK retries are bounded and cancellation-aware. Mutation preparation requires an idempotency key.

## Upload → manifest → retrieval workflow

A safe application flow is deliberately explicit:

1. obtain or resolve canonical agreement, capacity reservation and commitment prerequisites;
2. calculate the shard root and exact byte length locally;
3. call upload preparation with the complete object identity, preconditions and a unique idempotency key;
4. stream exactly the declared bytes through bounded ingest;
5. treat the returned receipt as off-chain transport evidence only;
6. construct/validate manifest and placement data with the developer manifest helpers;
7. allow canonical protocol transitions to register placements/seal state;
8. retrieve through the qualified Gateway path and verify payload identity.

Upload helpers never declare an agreement, placement, manifest, proof or settlement canonical merely because bytes reached a provider.

## Provider discovery and status

Capability-scoped discovery can request `store`, `repair`, `cache`, `gateway` or `relay`. Results are deterministic, bounded and explicitly non-authoritative.

Use discovery to choose an eligible route, not to decide whether a proof was accepted or settlement is final. Resource status describes operational lifecycle/health and must not be interpreted as chain finality.

## Cache, Gateway and Repair helpers

SR-9.7 exposes non-authoritative helper state:

- cache: `missing`, `fresh`, `expired`;
- gateway: selected tier/provider/node plus explicit fallback diagnostics;
- repair: sealed/retrievable/recoverable/degraded state and replacement shard indexes.

A caller can forbid cache or Store fallback. Discovery cannot bypass that policy. Repair/retrievability state remains separate from agreement, proof and settlement state.

## S3 compatibility subset

SR-9.8 is translation only. Supported adapter operations are:

| S3-shaped operation | v1 behavior |
| --- | --- |
| GET | resolves bucket/key to explicit 420 object identity, then uses 420 retrieval/auth |
| HEAD | same identity/auth path; returns size and S3-shaped ETag |
| PUT | uses the bounded/idempotent 420 upload preparation + ingest path |
| DELETE | only when an explicit canonical-aware deleter is configured |
| Multipart | unsupported in v1 |
| ACL mutation | unsupported; cannot override 420 authorization |
| S3 versioning | unsupported; not silently mapped to canonical identity |

For single-part compatibility operations, the S3 ETag is an MD5-derived HTTP/S3 compatibility value. It is not a 420 shard root, commitment, proof, placement or canonical object identifier.

## Local/testnet workflow

Use the checked-in template at `examples/storage420/local-testnet.env.example`, copy it outside source control when secrets are needed, and inject caller/session credentials at runtime.

Suggested local loop:

1. start the local/testnet Resource Network services;
2. set `420_STORAGE_URL` to the developer API endpoint;
3. populate non-secret object identity fields from the test fixture/canonical reader;
4. for private reads, export subject/session values only in the current shell or secret manager;
5. exercise public retrieval first, then private retrieval, discovery/status and the supported S3 subset;
6. verify route diagnostics without treating them as canonical state.

Non-loopback developer API endpoints require TLS. Local loopback HTTP is for development only.

## Troubleshooting by failure class

**Authorization** — `403/access_denied`, missing private subject/session/read capability, expired/revoked session, or no authorizer. Do not retry by weakening access mode.

**Routing/provider** — `502/resource_unavailable`, no eligible resource, degraded/stopped services, exhausted cache→Store fallback, or provider transport failure. Discovery/status can diagnose eligibility but cannot manufacture authority.

**Integrity/identity** — size/root mismatch, malformed object reference, commitment substitution, or payload verification failure. Do not accept the bytes under a new local identity; re-resolve canonical object metadata.

**Canonical-state** — missing/inactive agreement, capacity reservation, placement, commitment or unsealed manifest. Fix the protocol precondition instead of making the SDK/provider local state authoritative.

**Repair/cache** — cache freshness and repair state are acceleration/recovery signals. They do not replace proof/settlement state.

**S3 compatibility** — unsupported ACL/versioning/multipart semantics return explicit errors. Applications requiring those semantics must use a native 420 workflow or wait for a future compatibility version rather than assuming emulation.

## References

- [Storage and Resource integration](storage-and-resource-integration.md)
- [420Store & storage resource roadmap](../architecture/infrastructure/420store-roadmap.md)
- [Resource Network operations](../420RESOURCE-NETWORK-OPERATIONS.md)
- [420Gateway operations](../420GATEWAY-OPERATIONS.md)
- JSON schema: `docs/schemas/storage/v1/storage420.schema.json`
- Go reference SDK: `sdk/storage420`
