---
title: Storage & resource infrastructure
component: 420 Resource Protocol / 420Store
audience:
  - developer
  - operator
  - architect
category: architecture
status: current
version: current
---

# Storage & resource infrastructure

420 Integrated separates canonical Resource/420Store state from the infrastructure that performs storage, repair, caching, relay, and gateway work. Providers supply service; they do not acquire consensus, execution, governance, wallet, settlement, or application authority merely by operating infrastructure.

The canonical protocol service classes are **420Relay, 420Store, 420Cache, and 420Gateway**. The shared execution runtime additionally exposes **repair** as an operational capability over 420Store. `repair` is not a fifth canonical service ID.

## Authority boundary

Canonical chain/protocol state includes provider/node eligibility, service policy, offers, bounded sessions, storage capacity reservations, agreements, commitments, proof-scheme policy, accepted proof receipts, object manifests, shard placements, Vault obligations, and settlement lifecycle.

Derived/off-chain state includes payload bytes, encrypted shards, provider filesystems, cache contents, relay traffic, Gateway responses, runtime discovery, local health, operator metrics, alerts, SLO calculations, SDK state, S3 translation, backups, testnet evidence, and launch evidence.

Wallet, UI, Indexer, Explorer, Search, Analytics, and Status can present or project this information. None of those presentation/derived layers overrides an owning canonical contract.

## Runtime capability model

`ResourceNetworkRuntime` registers service instances by provider ID, node ID, service ID, and one or more operational capabilities:

- `store`;
- `repair`;
- `cache`;
- `gateway`;
- `relay`.

A runtime descriptor may expose multiple operational capabilities where the implementation supports them, but this does not change the canonical node's Resource Protocol service identity.

### Operational lifecycle

Runtime services use these states:

- `registered`;
- `starting`;
- `running`;
- `degraded`;
- `stopped`;
- `failed`.

Allowed transitions are intentionally bounded:

- `registered → starting | stopped`;
- `starting → running | failed | stopped`;
- `running → degraded | failed | stopped`;
- `degraded → running | failed | stopped`;
- `stopped → starting`;
- `failed → starting | stopped`.

This state machine is operational. Canonical provider/node registries have their own lifecycle and remain authoritative for protocol eligibility.

## Production topology

The production topology builder requires at least two configured nodes across at least **two distinct providers**. Provider/node identity pairs must be unique, every declared service must have a service ID and valid capabilities, and each provider/node receives an independent Resource Network runtime.

Production start/stop sequencing is deterministic. Discovery across providers is also deterministic, cancellation-aware, and fault-isolating: one failed discovery source does not automatically poison healthy sources, while an all-source failure fails closed.

Running services are eligible for ordinary discovery. Degraded services are returned only when the caller explicitly opts into degraded results. Malformed/stale endpoints are filtered rather than promoted into routes.

Production topology is deployment configuration, not canonical chain state.

## Configuration scopes

Resource runtime configuration supports two scopes:

- **shared** — non-secret values visible across the runtime;
- **service** — values bound to one registered service.

Shared entries cannot be marked secret. Service-scoped secrets are allowed, but operator snapshots redact their values. Unknown service references fail closed.

Configuration must never be used to manufacture provider eligibility, agreement state, proof acceptance, or settlement finality.

## Credentials

Production service credentials are operational/noncanonical. Credential management stores digests rather than raw secret values and supports:

- normal rotation with bounded overlap;
- immediate zero-overlap rotation for compromise;
- proof of the currently valid credential before ordinary rotation;
- full-service revocation;
- recovery into a new credential generation;
- deterministic validation at supplied timestamps;
- redacted evidence snapshots.

Raw credentials, bearer values, private session material, and secret configuration values must not appear in public telemetry or qualification bundles.

## Discovery and routing

The Resource Network discovery layer helps select currently eligible operational endpoints. It is deliberately narrower than protocol authority.

Discovery may answer “which running Store/Gateway/etc. endpoint can I try?” It cannot answer “was this proof accepted?”, “is this agreement effective?”, “who owns this object?”, or “was this payment finalized?” Those answers remain with the owning protocol contracts.

Gateway routing is cache/store oriented and verifies payload identity before serving bytes. Fallback may improve availability but never converts a fallback source into canonical authority.

## Storage execution path

420Store production execution composes canonical storage state with off-chain bytes:

1. canonical Store offer/provider/node eligibility is established;
2. capacity is configured/reserved canonically;
3. immutable storage commitment and agreement are created/activated;
4. encrypted payload/shard bytes are written off-chain;
5. shard placements are registered and the manifest is sealed;
6. Gateway/Cache retrieve and revalidate bytes against requested identity;
7. accepted storage proofs record verifier-approved challenge evidence;
8. 420Vault obligations release/refund through storage settlement;
9. Repair may replace unavailable placement backing while preserving shard identity.

No provider-local database or upload receipt substitutes for those canonical transitions.

## Upload boundary

The native upload coordinator prepares bounded writes against complete object identity and canonical prerequisites. The default maximum prepared object size is **64 MiB**, and idempotency keys are capped at **256 bytes**.

Ingest is verify-before-write: bytes are staged, exact size is enforced, SHA-256 shard root is verified, and the backend storage sink is called only after verification. Idempotency is single-flight so concurrent replay cannot cause duplicate backend writes for one key/upload identity.

Upload plans/receipts remain transport evidence only.

## Developer retrieval boundary

The current v1 developer HTTP service exposes retrieval only at `GET|HEAD /v1/resources/retrieve`. It supports ETags, conditional requests, and single byte ranges, enforces URI/header/body/request-time bounds, and requires TLS plus allowed Hosts for non-loopback exposure.

The SDK's abstract transport also models upload preparation, discovery, and status, but the checked-in HTTP transport deliberately returns `unsupported` for those operations. Infrastructure deployments must not advertise routes the implementation does not provide.

## Security controls

Production hardening includes:

- private access default-deny;
- actual-Host validation rather than trusting forwarding headers;
- non-loopback TLS requirements;
- bounded request URI/header/body handling;
- bounded concurrency/rate limiting on Gateway ingress;
- context cancellation across routing/fallback;
- payload size/root verification after provider/cache retrieval;
- upload single-flight/idempotency bounds;
- malformed/stale discovery filtering;
- secret redaction and credential rotation/revocation;
- fail-closed topology/API/schema compatibility checks.

The Gateway does not accept arbitrary caller-supplied upstream URLs. Operator-configured provider BaseURLs remain trusted deployment configuration and therefore belong in configuration security review.

## Multi-provider failure behavior

A production deployment is qualified for provider disappearance/rejoin, stale or malicious discovery entries, corrupt cache fallback, cancellation/timeout storms, private-access spoof attempts, concurrent load, discovery churn, HTTP Range load, and repair/recovery paths.

Failover is availability behavior. It never authorizes rewriting canonical identity to match whatever source remained reachable.

## Upgrade compatibility

Rolling upgrade qualification keeps these contracts frozen during the V1 production line:

- developer API: `v1`;
- topology/config schema: `storage-topology-v1`.

Software versions may change. API/schema drift, provider/node substitution, or immutable manifest-identity drift fails qualification. Rollback is required to preserve the same canonical object/shard/agreement/commitment identity.

## Backup and disaster recovery

`storage-dr-v1` captures operational restore evidence, not protocol authority. Backups intentionally exclude raw credentials and cannot replace agreements, proofs, settlement, or payload identity.

Restore reconciliation binds exact canonical manifest identity and production topology, enforces configured RPO/RTO limits, and cannot overwrite canonical history. Provider loss recovers through the normal Repair/placement lifecycle.

## Observability, alerts, and SLOs

Runtime status derives health from lifecycle state. Operational alerts are noncanonical and use qualified defaults:

- Store capacity: warning at 80%, critical at 90%;
- Repair backlog: warning at 25, critical at 100;
- first verified integrity failure: critical;
- authorization failures: warning at 25 per aggregation window;
- Gateway routing failures: warning at 10 per aggregation window;
- degraded service: warning;
- failed/stopped service: critical.

SLO evidence evaluates availability, verified integrity, and incident-recovery duration independently. All three must pass for an overall pass. The thresholds used in a deployment are launch configuration, not protocol/consensus rules.

## Testnet and launch evidence

`storage-testnet-evidence-v1` binds an exact software commit, configuration fingerprint, topology fingerprint, API/schema versions, required end-to-end checks, recovery drills, SLO result, and launch blockers.

Required end-to-end evidence covers upload, manifest, verified retrieval, Cache routing, Gateway routing, and repair reconstruction. Required drills cover provider loss, discovery degradation, and credential revocation recovery. Unresolved critical blockers invalidate the evidence bundle.

Evidence documents what was tested. It cannot create canonical chain state.

## Naming and integration points

Use public names for product-facing documentation and implementation names for source/reference:

| Public name | Primary implementation boundary |
| --- | --- |
| 420 Resource Protocol | `contracts/src/resource/Resource*420.sol` |
| 420Store | `Storage*420.sol` contracts + Store runtime |
| 420Repair | runtime repair orchestration + `StorageObjectManifestRegistry420.replacePlacement` |
| 420Cache | Resource runtime/cache source |
| 420Gateway | Gateway runtime/HTTP service |
| 420Storage developer surface | `execution/storage/developer_*` + `sdk/storage420` |

Do not publish 420Repair as a separate Genesis service class or contract suite.

## Failure and recovery principles

- provider/node offline: preserve canonical history and route only to qualified alternatives;
- local disk corruption: reject mismatched bytes and recover from verified sources;
- capacity pressure: reject/avoid unsafe new reservations rather than oversubscribe;
- proof verifier failure: fail the proof closed;
- insufficient live shards: object is non-retrievable until enough protocol-valid placements recover;
- private authorization failure: deny access rather than degrading privacy;
- credential compromise: revoke/rotate service credentials without broadening protocol authority;
- restore mismatch: reconcile against canonical state rather than rewriting it;
- settlement failure: leave accounting unresolved until 420Vault/protocol state confirms the outcome.

## Implementation status

The SR-0 through SR-10 Storage/Resource roadmap is **complete and merged**. The implementation includes the shared Resource Protocol, storage proof profile, capacity/agreement/commitment/proof/manifest/settlement contracts, Store/Repair/Cache/Gateway/Relay runtime integration, v1 developer retrieval API and SDK, S3 compatibility subset, multi-provider production topology, credential/DR/security hardening, operational alerts/SLOs, and testnet/launch evidence contracts.

Future work is protocol evolution or operations/maintenance, not unfinished SR roadmap scope. Possible later protocol versions may add Randomness-driven challenge scheduling, new retrieval/bandwidth proof profiles, or proof aggregation; those are not current V1 behavior.

## Related documentation

- [Storage Proof & Resource Protocol](../protocols/storage-proof-resource-protocol.md)
- [420Storage Developer Hub](../../developers/420storage-developer-hub.md)
- [Storage and Resource integration](../../developers/storage-and-resource-integration.md)
- [Resource Network operations](../../420RESOURCE-NETWORK-OPERATIONS.md)
- [420Gateway operations](../../420GATEWAY-OPERATIONS.md)
- [Shared protocol/provider troubleshooting](../../troubleshooting/shared-protocol-provider.md)
- [420Store & storage resource roadmap](420store-roadmap.md)
