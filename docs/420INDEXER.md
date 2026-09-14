# 420Indexer — GEN-11.1

420Indexer is the shared, non-authoritative indexing backbone for 420 Integrated.

Its purpose is to ingest canonical chain and registered protocol data once, preserve provenance and finality context, and expose rebuildable read models for 420Explorer, 420Search, 420Analytics, 420Notifications and other applications.

## Authority boundary

420Indexer never becomes protocol authority. It cannot create or mutate balances, ownership, identity, rights, governance outcomes, settlement, validator state, bridge state or any other canonical chain state. Every indexed record must remain traceable to canonical source data.

Indexer databases are replaceable and rebuildable from supported node/RPC sources and registered protocol metadata.

## Core responsibilities

- ingest blocks by chain ID, height and canonical hash;
- ingest transactions, receipts and logs;
- track head, safe and finalized independently;
- decode registered protocol events with version-aware metadata;
- preserve raw event provenance alongside derived projections;
- support deterministic restart and resume;
- detect and repair reorgs only in non-finalized history;
- refuse to rewrite finalized history without an explicit catastrophic-recovery procedure;
- expose indexed height, safe height and finalized height;
- detect wrong-chain or inconsistent RPC sources;
- support full rebuild from canonical sources;
- expose deterministic pagination for fixed snapshots;
- preserve schema and decoder versions;
- support multiple downstream projections without duplicating chain ingestion.

## Initial downstream consumers

1. 420Explorer
2. 420Search
3. 420Analytics
4. 420Notifications
5. 420Status
6. future AppStore and Verify projections where appropriate

## Data model

Minimum canonical-source records:

- `ChainCheckpoint`
- `BlockRecord`
- `TransactionRecord`
- `ReceiptRecord`
- `LogRecord`
- `ProtocolServiceVersion`
- `DecoderVersion`
- `ProjectionCheckpoint`

Each derived record must retain sufficient provenance to identify the chain ID, block number, block hash, transaction hash/log position when applicable, finality state, decoder/schema version and source service version.

## Reorg model

420Indexer treats finality as a boundary.

- non-finalized blocks may be replaced when canonical ancestry changes;
- affected derived projections must be rolled back deterministically;
- finalized history is immutable during normal operation;
- a finalized-history conflict places the indexer into a degraded/fail-closed state instead of silently rewriting history.

## Privacy model

420Indexer indexes only public/indexable records. It must not ingest plaintext private Messenger content, private Identity fields, encrypted Resource payload contents, private Commons payloads, raw private Attention telemetry, wallet secrets or application secrets.

## Availability model

A downstream application must be able to determine:

- chain ID;
- indexed head;
- indexed safe block;
- indexed finalized block;
- last successful ingestion time;
- active schema version;
- active decoder set;
- degraded/rebuild status.

Downstream clients must label stale or degraded data rather than presenting it as current canonical state.

## GEN-11.1 invariants

- `IDX-INV-001`: indexed data never becomes canonical protocol authority.
- `IDX-INV-002`: every canonical-source record retains chain and block provenance.
- `IDX-INV-003`: non-finalized reorgs are repaired deterministically.
- `IDX-INV-004`: finalized history is never silently rewritten.
- `IDX-INV-005`: the complete index can be rebuilt from supported canonical sources.
- `IDX-INV-006`: wrong-chain RPC sources are rejected.
- `IDX-INV-007`: downstream projections cannot mutate canonical-source records.
- `IDX-INV-008`: schema/decoder version changes are explicit and observable.
- `IDX-INV-009`: private or encrypted payload contents are not indexed unless the owning protocol explicitly marks a field public/indexable.
- `IDX-INV-010`: pagination is deterministic for a fixed snapshot.
- `IDX-INV-011`: service/version decoding is sourced from 420Registry / ProtocolRegistry and preserves historical decoder compatibility.
- `IDX-INV-012`: downstream consumers can identify data freshness and finality state.

## GEN-11.1 delivery slices

### GEN-11.1A — specification and readiness profile

Define authority boundaries, invariants, health state, canonical ingestion requirements and downstream contracts.

### GEN-11.1B — core indexer service

Implement the chain-ingestion engine, persistent checkpoint model, RPC validation, restart/resume and finality tracking.

### GEN-11.1C — deterministic reorg engine

Implement rollback/replay for non-finalized history and fail-closed handling for finalized conflicts.

### GEN-11.1D — protocol decoder registry

Resolve active/historical protocol versions from 420Registry and dispatch versioned decoders without making the indexer an authority.

### GEN-11.1E — shared read API

Expose stable endpoints/interfaces for Explorer, Search, Analytics and Notifications with provenance/finality metadata.

### GEN-11.1F — qualification

Add unit, integration, restart, wrong-chain, reorg, finalized-conflict, rebuild and deterministic-pagination qualification.

## Completion gate

GEN-11.1 is complete only when a clean index can be built from canonical sources, intentionally interrupted and resumed, subjected to non-finalized reorgs, rebuilt from zero, and consumed by at least one GEN-10 application without that application implementing its own independent chain-ingestion pipeline.
