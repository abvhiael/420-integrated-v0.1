# 420Exchange V13 — API, Indexing & Market Data

V13 turns the hardened execution and bridge state from V1–V12 into deterministic read surfaces for clients, indexers, analytics and the V14 Exchange Web UI. V13 does not add new custody or execution authority; all APIs are projections of canonical on-chain state and events.

## V13.1 — Canonical market-data/event schema — IN PROGRESS

- define stable market, trade, order, liquidity, bridge and fee event envelopes
- bind every indexed record to chain id, block number, block hash, transaction hash and log index
- define canonical identifiers for markets, assets, routes, adapters and orders
- prohibit indexer-generated authority or silent mutation of canonical fields
- establish reorg-safe record identity and replacement semantics

## V13.2 — Deterministic indexer core

- ingest canonical Exchange/Bridge events
- idempotent replay by provenance key
- bounded rollback on reorg
- finalized/canonical head tracking
- indexer checkpoint persistence and recovery

## V13.3 — Market snapshots

- market status and configuration
- best bid/ask where applicable
- last trade and rolling OHLCV windows
- liquidity/volume summaries
- route and settlement-health projection

## V13.4 — Historical query API

- trades, fills, orders and cancellations
- liquidity events
- bridge deposits/withdrawals and route state
- fee-routing history
- cursor pagination and deterministic sort order

## V13.5 — Live market-data stream

- websocket/SSE event stream
- ordered sequence numbers
- reconnect/resume cursor
- reorg/replacement notifications
- heartbeat and freshness metadata

## V13.6 — Public API hardening

- schema/version negotiation
- request bounds and pagination limits
- rate-limit and abuse controls
- malformed-query tests
- deterministic error contract
- cache/freshness policy

## V13.7 — V14 UI handoff qualification

- canonical client schema/package
- API/indexer parity checks against chain state
- freshness/lag SLO evidence
- reorg recovery drills
- final V13 exact-head qualification and reconciliation with main

## Invariants

1. APIs/indexers never create execution, custody, mint, burn or settlement authority.
2. Every externally visible record is traceable to canonical chain provenance or an explicitly labeled derived aggregate.
3. Reprocessing the same canonical event is idempotent.
4. Reorg handling removes/replaces orphaned projections without rewriting canonical history.
5. Derived market data is reproducible from canonical inputs and versioned aggregation rules.
6. V14 UI consumes V13 surfaces rather than directly inventing protocol state.
