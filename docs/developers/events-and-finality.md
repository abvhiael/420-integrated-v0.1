---
title: Events, logs and finality
audience:
  - developer
category: developer
status: development
version: current
---

# Events, logs and finality

Events are evidence about executed transactions. They are not a substitute for the current canonical state owned by the protocol contract.

## Sources

420Indexer exposes rebuildable log and typed protocol-event projections for efficient application queries. Canonical RPC exposes the chain transaction/receipt/log evidence. The owning protocol contract remains authoritative for current authorization and state.

Use indexed events for discovery, activity feeds, notifications, analytics and replayable application projections. Revalidate security-sensitive conclusions against canonical RPC and/or the owning contract.

## Finality states

Preserve the distinction between head, safe and finalized. A transaction/event observed near head may disappear or move during a non-finalized reorg. Applications must avoid presenting head observation as irreversible settlement.

A safe event consumer records enough provenance to identify at least the selected chain/environment, block number/hash, transaction hash, log identity and the finality state used by the application.

## Reorg handling

For non-finalized events:

1. retain block provenance;
2. detect ancestry/hash disagreement;
3. roll back derived local effects tied to the replaced suffix;
4. replay from the last trusted checkpoint;
5. promote effects only according to the application's safe/finalized policy.

Do not silently rewrite a result that had already been treated as finalized. A finalized-history disagreement is a fail-closed diagnostic condition and should trigger canonical-source investigation.

## Event-driven state machines

When an event triggers application work, make the consumer replay-safe. Derive a stable processing identity from canonical event provenance rather than arrival time. Persist the last successfully processed checkpoint only after dependent local writes are durable.

Notifications, analytics and other off-chain reactions should remain reversible until the event reaches the application's required finality threshold.

## WebSocket delivery

WebSocket subscriptions improve latency but do not provide durable delivery. After disconnect/reconnect, recover from the last trusted checkpoint using canonical/indexed historical queries instead of assuming no events were missed.

## Related

- [Source of truth and finality](source-of-truth.md)
- [Pagination, replay and reorgs](pagination-replay-and-reorgs.md)
- [API fallback and reliability](api-fallback-and-reliability.md)
