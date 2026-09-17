# 420Exchange V13 — API, Indexing & Market Data

V13 turns the hardened execution and bridge state from V1–V12 into deterministic read surfaces for clients, indexers, analytics and the V14 Exchange Web UI. V13 does not add new custody or execution authority; all APIs are projections of canonical on-chain state and events.

## V13.1 — Canonical market-data/event schema — QUALIFIED

- [x] define stable market, trade, order, liquidity, bridge and fee event domains
- [x] bind every indexed record to chain id, block number, block hash, transaction hash and log index
- [x] define schema-versioned canonical identifiers for markets, assets, routes, adapters and orders
- [x] prohibit indexer-generated authority or silent mutation of canonical fields
- [x] establish reorg-safe record identity and replacement semantics
- [x] define OBSERVED/CANONICAL/ORPHANED/FINALIZED canonicality states
- [x] define versioned derived-record identity binding source set and aggregation window
- [x] add executable qualification for idempotence, reorg separation and malformed provenance

Qualification:
- exact head `7246c8f03e4a3b31d3f6ac86f1a8c9c791202409`
- Solidity Contracts #2588
- 420 Integrated Qualification #4093
- 420Docs Qualification #1803

Implementation:
- `contracts/src/exchange/ExchangeMarketDataTypes420.sol`
- `contracts/test/ExchangeMarketDataTypes420.t.sol`
- `contracts/config/exchange/market-data-v13.1.json`

## V13.2 — Deterministic indexer core — IN QUALIFICATION

- [x] ingest V13.1 record envelopes with deterministic validation
- [x] idempotent replay by record/provenance identity
- [x] reject conflicting replay under the same record ID
- [x] canonical block-hash tracking by chain and height
- [x] monotonic canonical checkpoint persistence
- [x] monotonic finalized checkpoint persistence
- [x] bounded rollback on reorg
- [x] prohibit rollback across finalized head
- [x] clear rolled-back canonical block claims so replacement branches can be indexed
- [x] preserve explicit ORPHANED and FINALIZED record lifecycle states
- [x] add executable qualification for replay, checkpoint and reorg recovery behavior

Implementation:
- `contracts/src/exchange/ExchangeDeterministicIndexer420.sol`
- `contracts/test/ExchangeDeterministicIndexer420.t.sol`
- `contracts/config/exchange/indexer-v13.2.json`

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
