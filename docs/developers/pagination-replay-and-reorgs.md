---
title: Pagination, replay and reorgs
audience:
  - developer
category: developer
status: development
version: current
---

# Pagination, replay and reorgs

420Indexer is designed for deterministic historical consumption without requiring every application to build its own ingestion, checkpoint or reorg engine.

## Opaque keyset cursors

Paged v1 routes use opaque keyset cursors.

- default page size: **50**;
- hard maximum page size: **200**;
- supported direction values: `asc` and `desc`.

Treat cursors as continuation tokens only. Do not decode them, derive ordering assumptions from their bytes, persist assumptions about SQL keys, or construct new cursors yourself.

## Consumer pagination

A robust consumer should:

1. choose the selected chain explicitly;
2. choose a deterministic direction;
3. request a bounded page size;
4. process each response together with its provenance/finality context;
5. persist the returned opaque cursor only after the page has been processed successfully;
6. continue until no further cursor is returned;
7. restart from the last successfully persisted consumer checkpoint after failure.

The application's consumer checkpoint is not the same thing as the Indexer's own ingestion checkpoint.

## Reorg-sensitive data

Indexed non-finalized history can change after a canonical reorg. Applications that display head-level data must therefore be able to retract or replace it.

Do not make irreversible application decisions merely because an event appeared in an indexed head page.

Where the user experience permits, prefer safe or finalized context for stronger claims.

## Indexer reorg behavior

The Indexer detects canonical ancestry changes, finds a common ancestor, refuses to cross below finalized history, rolls back rebuildable projections above the ancestor and deterministically replays the replacement suffix.

Downstream applications should not attempt to fight this process with their own alternate canonicality rules.

If an object/event disappears or changes before finality, update the UI/model according to the new canonical projection.

## Finalized conflict

A disagreement involving finalized indexed history is different from an ordinary reorg. The Indexer enters degraded/fail-closed behavior rather than silently rewriting finalized records.

A consumer seeing degraded readiness, a finalized mismatch, or incompatible provenance should stop making freshness-sensitive claims and recheck canonical RPC.

## Replay and rebuild

420Indexer projections are rebuildable from canonical sources plus approved deployment/decoder metadata. Rebuilds may cause temporary lag or unavailability without changing protocol state.

Consumers must tolerate:

- temporary `503` readiness failures;
- lag while projections catch up;
- replay of canonical history;
- non-finalized rows changing after reconciliation;
- service restart without treating it as chain restart.

## Event processing and idempotency

When consuming paged event/protocol history into another system, use canonical identifiers and provenance to make downstream processing idempotent. Do not use array position or page number as an event identity.

If an application creates an off-chain side effect from non-finalized indexed data, it must have a strategy for reconciliation if that source event is reorganized away.

## Historical protocol versions

Protocol decoding is pinned to the service/version active at the historical block. Missing historical decoder information fails closed rather than falling forward to a newer ABI.

Consumers should preserve the returned service/version provenance when interpreting historical protocol objects or events.

## Related documentation

- [420Indexer API](indexer-api.md)
- [Reads and source selection](reads-and-source-selection.md)
- [Source of truth and finality](source-of-truth.md)
- [420Indexer infrastructure](../architecture/infrastructure/420indexer.md)
