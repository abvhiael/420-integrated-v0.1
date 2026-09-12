---
title: API fallback and reliability
audience:
  - developer
category: developer
status: development
version: current
---

# API fallback and reliability

420Indexer is a replaceable read service over canonical 420 Integrated state. Applications should degrade safely when it is stale or unavailable instead of promoting stale projections into authority.

## Failure classes

Treat these separately:

- process unavailable;
- process alive but not ready;
- wrong-chain/environment response;
- stale or excessively lagged projection;
- non-finalized reorg/replay;
- finalized-history conflict;
- missing historical decoder/version;
- generic backend/projection error.

## Liveness is not readiness

`/health` means only that the process is alive.

Before depending on current projections, check `/ready?chainId=` and inspect `/v1/status?chainId=` for indexed head/finality/freshness metadata.

A healthy HTTP server with stale or invalid projection state is not a healthy source for freshness-sensitive UX.

## Fallback policy

Fallback depends on the type of read.

### Security-sensitive read

If the projection is unavailable, stale, contradictory or degraded, read the canonical RPC/owning contract directly or fail closed.

Do not substitute a second derived source and call the result canonical.

### Historical/list/search UX

If the Indexer is unavailable, applications may:

- show a degraded/unavailable state;
- retain explicitly stale cached results with visible freshness context;
- use a same-environment replacement Indexer endpoint if one is officially configured;
- fall back to bounded direct RPC reads where practical.

Do not hide stale state behind a normal “current” presentation.

## Endpoint replacement

A replacement Indexer endpoint must belong to the same selected environment. Validate chain/environment identity before accepting it.

Do not silently fail over from testnet to mainnet, local to testnet, or between unrelated deployments simply because the API route shapes match.

## Rate limits

The repository currently defines bounded pagination but does not define a universal 420Indexer-specific requests-per-second quota in the stable v1 API contract.

Clients should therefore:

- obey HTTP throttling/retry metadata when a deployment exposes it;
- keep page sizes bounded;
- avoid polling `/v1/status` or list endpoints unnecessarily;
- use exponential backoff with jitter for transient service errors;
- avoid synchronized retry storms;
- treat deployment-specific gateway limits as operational policy rather than protocol semantics.

Do not hard-code an undocumented global rate-limit number into SDK behavior.

## Retry rules

Safe retries are generally appropriate for idempotent GET requests after transient network or `5xx` failure, provided the selected environment remains unchanged.

Do not retry indefinitely when:

- `/ready` remains false;
- chain/environment identity is wrong;
- finalized provenance conflicts;
- a decoder/version mismatch requires operator repair;
- the application has crossed its own latency/deadline budget.

## Caching

Caches must preserve enough context to avoid mixing environments or finality classes.

Useful cache keys include selected environment/network identity, chain ID, request path/filter, and where relevant block/finality provenance.

Never use a cache entry from another environment merely because chain ID or contract address happens to match.

## Privacy

420Indexer is for public/indexable chain data. Do not send private Messenger plaintext, private Identity fields, encrypted Resource payload contents, raw Attention telemetry, Wallet secrets or application secrets to the Indexer unless the owning protocol explicitly defines that field as public/indexable.

## Consumer checklist

Before shipping an Indexer-backed feature, confirm that it:

- distinguishes canonical and derived reads;
- validates environment/chain identity;
- checks readiness/freshness;
- preserves provenance;
- tolerates opaque cursors and replay;
- handles non-finalized reorgs;
- fails closed on finalized conflict;
- has a bounded retry/deadline policy;
- does not invent a universal rate limit;
- rechecks canonical state before security-sensitive decisions.

## Related documentation

- [Endpoint health and failover](endpoint-health-and-failover.md)
- [420Indexer API](indexer-api.md)
- [Pagination, replay and reorgs](pagination-replay-and-reorgs.md)
- [Reads and source selection](reads-and-source-selection.md)
