---
title: Storage and Resource integration
audience:
  - developer
category: developer
status: current
version: current
---

# Storage and Resource integration

The **420 Resource Protocol** is the canonical coordination layer for provider identity, service policy, offers, metered sessions, and bounded settlement. **420Store** extends that protocol with capacity reservations, storage agreements, immutable commitments, proof schemes and receipts, object manifests, shard placements, repair-safe replacement, and proof-window settlement through 420Vault.

Payload bytes, encrypted shards, relay traffic, cache contents, Gateway execution, repair workers, discovery, SDKs, S3 translation, and operator telemetry remain off-chain or derived. They never become canonical simply because they are reachable or healthy.

For concrete v1 retrieval/API/SDK/S3 behavior, use the [420Storage Developer Hub](420storage-developer-hub.md). For canonical contract semantics, use [Storage Proof and Resource Protocol](../architecture/protocols/storage-proof-resource-protocol.md).

## Public names and implementation names

The four canonical Resource Protocol service classes are:

| Public product | Canonical service role |
| --- | --- |
| 420Relay | encrypted routing / metered bandwidth |
| 420Store | durable encrypted storage |
| 420Cache | cache/CDN/retrieval bandwidth |
| 420Gateway | public/private access gateway |

The execution runtime additionally exposes a `repair` capability. **420Repair is an operational capability over 420Store; it is not a fifth canonical service ID.**

## Shared Resource flow

For Relay, Cache, Gateway, and other metered Resource Protocol use:

1. resolve an active provider/node and canonical service class;
2. resolve an effective offer;
3. obtain the bounded authorization needed by the action;
4. open a replay-safe session with explicit unit and native-`$420` spend ceilings;
5. consume the provider-backed service off-chain;
6. submit monotonic cumulative metering receipts within the session cap;
7. close and settle only through canonical protocol state.

Provider invoices, runtime counters, Indexer records, Explorer pages, Search results, Analytics dashboards, Wallet presentation, or application UIs cannot increase a session's authority or settlement ceiling.

## 420Store flow

A native durable-storage workflow is:

1. resolve an effective STORE offer and active Store node;
2. define object/content identity, manifest hash, encryption/erasure commitments, proof scheme, storage class, and repair policy;
3. configure and reserve sufficient canonical Store capacity;
4. register an immutable storage commitment;
5. propose the storage agreement;
6. activate the agreement only after offer, node/provider, proof scheme, reservation, and commitment invariants all match;
7. upload the encrypted payload/shard off-chain through a bounded, integrity-verifying path;
8. register each shard placement against an active agreement and commitment;
9. seal the manifest only after every declared shard placement exists;
10. monitor retrievability from live/effective placements rather than assuming sealed means permanently available;
11. submit challenge-bound storage proofs within the configured proof-scheme window;
12. release or refund each 420Vault proof-window obligation according to matching accepted proof state.

## Permissions and authorization

Resource authority is default-deny and CapabilityRegistry-backed. `ResourceAuthorization420` scopes grants independently to provider, node, session, and proof-scheme identities.

Canonical Resource actions include provider registration/update/state changes, node registration/state changes, offer publication, session settlement, proof-scheme registration/state changes, Store capacity configuration/reservation, storage commitment registration, and storage-agreement acceptance.

Direct operator authority is intentionally narrow. Provider/node operators may perform only the contract actions explicitly permitted by the owning registry. Runtime service membership, a reachable HTTP endpoint, an Indexer record, or possession of off-chain bytes is not an authorization grant.

Private developer retrieval has a separate application-access boundary: private requests require explicit subject, session ID, `read` capability, and an authorizer. That access decision does not alter the canonical storage agreement or proof state.

## Fees and economics

Resource offers express `unitPrice420`, `maxUnits`, terms, and optional expiry. Shared Resource sessions compute a maximum native-`$420` spend from the accepted unit cap and offer price; settlement cannot exceed that bound.

420Store settlement is proof-window based. `StorageSettlementRegistry420` computes total storage consideration as the agreement byte size multiplied by the Store offer's unit price, divides that amount across bounded proof windows, and instructs **420Vault** to create obligations. A matching accepted proof releases a window; a missed deadline permits that window's obligation to be cancelled/refunded.

The settlement controller does not hold user funds. 420Vault remains custody authority. A provider serving bytes, a Gateway returning `200`, a proof verifier returning true, or an Indexer/Explorer showing a result does not itself transfer value.

## Proof semantics

The current proof classes are:

- `REPLICA_COMMITMENT`;
- `AVAILABILITY_WINDOW`;
- `AUDIT_RESPONSE`.

Proof submission is challenge-specific, replay-safe, and deadline-bounded. Raw proof payloads are capped at **65,536 bytes**. Accepted raw proof bytes are not retained on-chain; the protocol retains a digest and receipt metadata.

An accepted proof establishes one verified challenge for one immutable commitment. It does not prove perpetual availability, satisfy another proof window, or independently authorize payment.

## Capacity, manifests, retrievability, and repair

Store capacity is canonical accounting distinct from physical free disk. A reservation cannot exceed registered capacity and is bound to one Store node/agreement identity and release time.

A manifest binds object identity, object content root, manifest hash, encryption commitment, erasure root, object size, segment count, and the `dataShards`/`totalShards` erasure envelope. Every placement binds a shard index/root/size to a specific active storage agreement and commitment.

A sealed manifest is retrievable only while enough placements remain backed by effective agreements and live commitments to meet the `dataShards` threshold.

Repair is intentionally narrow. Once the incumbent service window has begun and a sealed placement is no longer effective, the manifest controller may replace the placement's backing agreement. Repair preserves the canonical placement ID, shard index, shard root, and shard byte length; agreement, commitment, node, and provider may rotate through protocol-valid state.

Historical agreement/commitment/proof/settlement provenance is never rewritten to make a replacement provider appear original.

## Developer API and SDK integration

The public developer version is `v1`. Native object references contain `object_id`, `manifest_id`, `shard_index`, `shard_root`, `size_bytes`, and `commitment_id`.

The checked-in developer HTTP service currently exposes only:

- `GET /v1/resources/retrieve`;
- `HEAD /v1/resources/retrieve`.

The Go SDK's abstract transport also defines upload preparation, discovery, and status methods, but the checked-in `HTTPTransport` returns `unsupported` for those three operations. Do not invent HTTP routes that are not implemented.

Retrieval supports ETags, conditional requests, and single byte ranges. The SDK independently verifies returned size and SHA-256 root. See the [420Storage Developer Hub](420storage-developer-hub.md) for exact headers, errors, bounds, examples, retries, and S3 translation behavior.

## Runtime lifecycle and discovery

The shared runtime understands operational capabilities `store`, `repair`, `cache`, `gateway`, and `relay` and lifecycle states `registered`, `starting`, `running`, `degraded`, `stopped`, and `failed`.

Normal discovery returns running services only. Degraded discovery requires explicit inclusion; stopped/failed/pending services are not normal routes. Production topology qualification requires multiple distinct providers and deterministic merged discovery/failover.

These states are operational evidence. They do not change canonical provider/node lifecycle, Store agreement state, proof acceptance, or settlement.

## Configuration and secrets

Resource configuration has `shared` and `service` scopes. Shared entries cannot be secret. Service-scoped secret values are redacted from configuration snapshots.

Production credential state is operational and noncanonical. Credentials are validated by digest, support planned rotation, compromise rotation, revocation, and recovery, and must not appear raw in telemetry/evidence.

A configuration file, secret manager, runtime health endpoint, or deployment manifest cannot create protocol authority.

## Security and trust boundaries

Fail closed on:

- provider/node/service identity mismatch;
- unsupported or inactive proof scheme;
- reservation/commitment/agreement mismatch;
- replayed/late/early proof;
- private read without complete authorization;
- request-host/TLS boundary mismatch;
- payload size/root mismatch;
- upload idempotency conflict;
- topology/schema/API drift;
- disaster-recovery evidence that would overwrite canonical history.

Gateway, Cache, Repair, SDK, S3 compatibility, backups, alerts, SLOs, testnet evidence, and launch approval are all derived or operational layers. Wallet, UI, Indexer, Explorer, Search, and Analytics may present those results but do not own the underlying state.

## Events and errors

Resource/Store contracts emit lifecycle events where the owning contract implements them, including provider/node state changes, policy configuration, storage proof-scheme state, capacity reservation/release, storage commitments, storage agreement lifecycle, manifest/placement lifecycle, accepted storage proofs, and proof-window settlement/refunds.

The canonical contract/event/error inventory is maintained in [Storage Proof and Resource Protocol](../architecture/protocols/storage-proof-resource-protocol.md). Generated reference pages remain environment/catalogue scoped and must not be treated as a substitute for uncatalogued contract source.

## Troubleshooting rules

When an application disagrees with provider/runtime/UI state:

1. identify the canonical object/session/agreement/commitment/manifest/proof/settlement ID;
2. read the owning chain contract through a qualified RPC path;
3. decide whether the problem is canonical state, authorization, provider availability, integrity, repair, or presentation freshness;
4. preserve the original identity while recovering;
5. use provider fallback or repair only where protocol rules permit it;
6. never patch a UI/indexer/provider record to manufacture canonical success.

Use [Shared protocol and provider troubleshooting](../troubleshooting/shared-protocol-provider.md) for incident IDs and [Resource Network operations](../420RESOURCE-NETWORK-OPERATIONS.md) for operator recovery.

## FAQ

### Is a Gateway or Cache response canonical storage proof?

No. Successful retrieval proves that the returned payload matched the requested identity at that access boundary. Canonical agreement, placement, proof, and settlement state still comes from the owning contracts.

### Does sealing a manifest guarantee availability?

No. Sealing proves the declared placement set was complete at sealing. Current retrievability depends on live/effective placements meeting the erasure threshold.

### Can repair replace arbitrary object data?

No. Repair may rotate unavailable placement backing while preserving shard identity. It cannot rewrite the sealed object's content identity.

### Is 420Repair part of Genesis as another service class?

No. The frozen Resource Protocol products are Relay, Store, Cache, and Gateway. 420Repair is the runtime/operator recovery capability for Store.

### Can I rely on Explorer, Search, Analytics, or Indexer for finality?

Use them for presentation/discovery where appropriate, but re-read the owning canonical contracts for authority-sensitive decisions.

## Canonical ownership and evidence records

Long-lived documentation ownership is:

- **protocol semantics/contracts/economics** — [Storage Proof and Resource Protocol](../architecture/protocols/storage-proof-resource-protocol.md);
- **runtime/deployment architecture** — [Storage & Resource infrastructure](../architecture/infrastructure/storage-resource-infrastructure.md);
- **developer API/SDK/S3/examples** — [420Storage Developer Hub](420storage-developer-hub.md);
- **operations** — [Resource Network operations](../420RESOURCE-NETWORK-OPERATIONS.md) and [420Gateway operations](../420GATEWAY-OPERATIONS.md);
- **incidents** — [Shared protocol and provider troubleshooting](../troubleshooting/shared-protocol-provider.md).

The SR-10 production-topology, fault-injection, load, upgrade, credential, DR, security, SLO, testnet-evidence, and launch-closeout pages are retained as qualification evidence. They support reproducibility but do not override these canonical pages.

## Related documentation

- [420Storage Developer Hub](420storage-developer-hub.md)
- [Storage Proof and Resource Protocol](../architecture/protocols/storage-proof-resource-protocol.md)
- [Storage and Resource infrastructure](../architecture/infrastructure/storage-resource-infrastructure.md)
- [Resource Network operations](../420RESOURCE-NETWORK-OPERATIONS.md)
- [420Gateway operations](../420GATEWAY-OPERATIONS.md)
- [Shared protocol and provider troubleshooting](../troubleshooting/shared-protocol-provider.md)
- [Provider-backed integration model](provider-backed-integrations.md)
- [420Storage production launch closeout](420storage-production-launch-closeout.md)
