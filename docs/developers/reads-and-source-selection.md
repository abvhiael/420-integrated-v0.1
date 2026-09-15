---
title: Reads and source selection
audience:
  - developer
category: developer
status: development
version: current
---

# Reads and source selection

Use the narrowest source that preserves the authority you need. 420 Integrated intentionally separates canonical chain state from rebuildable query projections.

## The core rule

Use canonical RPC or the owning protocol contract when a read can affect authorization, money, ownership, eligibility, settlement, governance, bridge safety, identity trust, validator state or another protocol decision.

Use 420Indexer for discovery, lists, history, search, analytics, normalized transfers, typed event journals and other read-heavy UX where rebuildable projections are appropriate.

420Indexer can make an application faster and simpler. It cannot make an indexed value authoritative.

## Source matrix

| Need | Preferred source | Why |
| --- | --- | --- |
| Current canonical balance | chain RPC / owning contract | protocol authority |
| Ownership or active registration | owning contract / ProtocolRegistry | canonical state |
| Transaction inclusion/receipt | canonical RPC | execution truth |
| Head/safe/finalized block | canonical RPC | chain finality source |
| Historical block/transaction list | 420Indexer | efficient rebuildable projection |
| Address activity feed | 420Indexer | normalized history |
| Search | 420Indexer | derived discovery |
| Analytics | 420Indexer | derived metrics/projections |
| Protocol event history | 420Indexer, with provenance | version-aware historical projection |
| Latest protocol object for UX | 420Indexer for display; canonical recheck before sensitive action | convenience plus authority check |

## Read path

A safe read-heavy application normally:

1. resolves the selected network from the official manifest;
2. checks the Indexer service belongs to that environment;
3. checks `/ready?chainId=` before depending on the projection;
4. reads `/v1/status?chainId=` and retains freshness/finality metadata;
5. performs the projection query;
6. carries chain/block provenance into the application model;
7. rechecks canonical state before a security-sensitive decision or write.

## Finality labels

Applications must distinguish indexed head, safe and finalized data.

Head data is freshest and most reorg-sensitive. Safe data has stronger consensus support but is not the same as finalized. Finalized data is the preferred boundary for irreversible UX claims, but a conflict between the Indexer and canonical finalized chain state is an incident condition, not permission to choose whichever value is convenient.

## Do not promote convenience into authority

Do not use an indexed balance, search result, AppStore label, analytics value or latest-object projection as the sole input to a state-changing authorization decision.

Examples that require canonical rechecks include:

- deciding whether an account owns an asset;
- deciding whether a Registry service is active;
- determining whether a credential is currently valid;
- deciding whether a governance proposal passed;
- deciding whether bridge state is complete or refundable;
- deciding whether a validator is eligible;
- calculating a settlement that the owning protocol will enforce.

## Provenance

For derived data, retain enough provenance to explain where the value came from. At minimum, applications should preserve the selected chain/environment plus relevant block number/hash and the Indexer freshness/finality context when the API exposes them.

Do not strip provenance merely because a projection is displayed in a polished first-party UI.

## Related documentation

- [Source of truth and finality](source-of-truth.md)
- [Networks and manifests](networks-and-manifests.md)
- [RPC and WebSocket access](rpc-and-websocket.md)
- [420Indexer infrastructure](../architecture/infrastructure/420indexer.md)
- `docs/420INDEXER-API-V1.md`
