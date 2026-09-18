# 420Exchange V13 — API, Indexing & Market Data

V13 turns the hardened execution and bridge state from V1–V12 into deterministic read surfaces for clients, indexers, analytics and the V14 Exchange Web UI. V13 does not add new custody or execution authority; all APIs are projections of canonical on-chain state and events.

## V13.1 — Canonical market-data/event schema — QUALIFIED

Qualification:
- exact head `7246c8f03e4a3b31d3f6ac86f1a8c9c791202409`
- Solidity Contracts #2588
- 420 Integrated Qualification #4093
- 420Docs Qualification #1803

Implementation:
- `contracts/src/exchange/ExchangeMarketDataTypes420.sol`
- `contracts/test/ExchangeMarketDataTypes420.t.sol`
- `contracts/config/exchange/market-data-v13.1.json`

## V13.2 — Deterministic indexer core — QUALIFIED

Qualification:
- exact head `4dc287f42115d274e9e2bbf302b49cf2f77dd1bc`
- Solidity Contracts #2597
- 420 Integrated Qualification #4114
- 420Docs Qualification #1824

Implementation:
- `contracts/src/exchange/ExchangeDeterministicIndexer420.sol`
- `contracts/test/ExchangeDeterministicIndexer420.t.sol`
- `contracts/config/exchange/indexer-v13.2.json`

## V13.3 — Market snapshots — QUALIFIED

Qualification:
- exact head `3120c733c1859508d8b56cffc7ecbf2d9bc2dc82`
- Solidity Contracts #2607
- 420 Integrated Qualification #4131
- 420Docs Qualification #1841

Implementation:
- `contracts/src/exchange/ExchangeMarketSnapshot420.sol`
- `contracts/test/ExchangeMarketSnapshot420.t.sol`
- `contracts/config/exchange/market-snapshots-v13.3.json`

## V13.4 — Historical query API — IN QUALIFICATION

- [x] index trades, fills, orders and cancellations
- [x] index liquidity events
- [x] index bridge deposits/withdrawals and route state
- [x] index fee-routing history
- [x] append-only record identity with duplicate rejection
- [x] active/inactive lifecycle for canonical versus orphaned history
- [x] bounded pagination with 100-record maximum
- [x] query-bound cursor identity
- [x] reject cursor reuse across different filters
- [x] deterministic result order in canonical index insertion order
- [x] retain inactive/orphaned history for explicit lookup
- [x] add executable qualification for pagination, filtering and reorg visibility

Implementation:
- `contracts/src/exchange/ExchangeHistoricalQuery420.sol`
- `contracts/test/ExchangeHistoricalQuery420.t.sol`
- `contracts/config/exchange/historical-query-v13.4.json`

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
