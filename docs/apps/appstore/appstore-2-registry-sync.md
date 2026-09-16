---
title: 420 AppStore APPSTORE-2 Registry synchronization
audience: [developer, architect, auditor]
category: architecture
status: development
version: current
---
# APPSTORE-2 — canonical Registry ingestion and synchronization

APPSTORE-2 adds the rebuildable canonical-data projection used by 420AppStore. It consumes 420Registry / `ProtocolRegistry` service history and preserves Registry-owned identity, version and implementation provenance without creating a second registry.

## Canonical inputs

The projection accepts Registry snapshots bound to an exact chain ID, Registry contract address and finalized block. Each service version preserves:

- canonical service ID;
- monotonically increasing Registry version;
- implementation address;
- runtime code hash;
- metadata hash;
- registration component type;
- manifest, dependency-root and interface commitments when published;
- active/deprecated state;
- source block number and block hash.

Catalogue titles, categories, descriptions, screenshots, ratings, rankings and sponsored placement are deliberately absent from this model. Those fields are non-canonical AppStore presentation metadata and are introduced only in later phases.

## Synchronization rules

`appstore/registry.Projection` is a non-authoritative materialized view. It may be deleted and rebuilt from canonical Registry evidence.

Synchronization fails closed when:

- the source chain ID does not match the configured network;
- the source Registry address changes unexpectedly;
- finalized height moves backwards;
- a service version skips a predecessor;
- a previously observed service/version is replayed with conflicting canonical fields;
- required addresses, hashes or block provenance are malformed.

Exact replay of an already-ingested canonical version is idempotent.

## Rebuild behavior

`Rebuild` discards only the local projection and reconstructs it from the supplied canonical snapshot. It never writes to `ProtocolRegistry`, never changes registration status, and never grants application legitimacy.

The source abstraction is intentionally replaceable. A direct RPC reader, 420Indexer-backed canonical projection, or independent client may provide the snapshot so long as the same chain/Registry provenance and version history are preserved.

## Authority boundary

420Registry remains authoritative for service identity, versions, implementations and active/deprecated state. 420AppStore may display and filter that information, but listing or delisting cannot mutate Registry truth. This enforces APP-INV-002, APP-INV-003, APP-INV-012 and APP-INV-013.
