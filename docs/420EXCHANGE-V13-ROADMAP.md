# 420Exchange V13 — API, Indexing & Market Data

V13 turns the hardened execution and bridge state from V1–V12 into deterministic read surfaces for clients, indexers, analytics and the V14 Exchange Web UI. V13 does not add new custody or execution authority; all APIs are projections of canonical on-chain state and events.

## V13.1 — Canonical market-data/event schema — QUALIFIED
Qualification:
- exact head `7246c8f03e4a3b31d3f6ac86f1a8c9c791202409`
- Solidity Contracts #2588
- 420 Integrated Qualification #4093
- 420Docs Qualification #1803

## V13.2 — Deterministic indexer core — QUALIFIED
Qualification:
- exact head `4dc287f42115d274e9e2bbf302b49cf2f77dd1bc`
- Solidity Contracts #2597
- 420 Integrated Qualification #4114
- 420Docs Qualification #1824

## V13.3 — Market snapshots — QUALIFIED
Qualification:
- exact head `3120c733c1859508d8b56cffc7ecbf2d9bc2dc82`
- Solidity Contracts #2607
- 420 Integrated Qualification #4131
- 420Docs Qualification #1841

## V13.4 — Historical query API — QUALIFIED
Qualification:
- exact head `17a782146c960d64568e1c43a22c198a57e29f63`
- Solidity Contracts #2610
- 420 Integrated Qualification #4141
- 420Docs Qualification #1851

## V13.5 — Live market-data stream — QUALIFIED
Qualification:
- exact head `a7ad5411c6f1d1f100cdfb6af3b0a57616076e73`
- Solidity Contracts #2618
- 420 Integrated Qualification #4163
- 420Docs Qualification #1868

## V13.6 — Public API hardening — QUALIFIED
Qualification:
- exact head `7a2e1a879ca1ff106dd842210bc7c9e84f760c4f`
- Solidity Contracts #2621
- 420 Integrated Qualification #4166
- 420Docs Qualification #1871

Implementation:
- `contracts/src/exchange/ExchangePublicApiPolicy420.sol`
- `contracts/test/ExchangePublicApiPolicy420.t.sol`
- `contracts/config/exchange/public-api-v13.6.json`

## V13.7 — V14 UI handoff qualification — IN QUALIFICATION

- [x] publish canonical V14 client schema/package
- [x] bind V14 to V13 snapshot/history/live/API surfaces
- [x] require indexer/snapshot/stream heads never lead canonical head
- [x] enforce maximum three-block canonical lag SLO
- [x] enforce maximum thirty-second live-stream freshness SLO
- [x] add deterministic V14 handoff identity
- [x] add explicit reorg/replacement recovery drill
- [x] require replacement history to resolve the replacement record
- [x] prohibit V14 from inventing protocol state outside V13 read surfaces
- [x] add executable parity, freshness, lag and recovery qualification

Implementation:
- `contracts/src/exchange/ExchangeV14Handoff420.sol`
- `contracts/test/ExchangeV14Handoff420.t.sol`
- `contracts/config/exchange/v14-client-schema.json`
- `contracts/config/exchange/v14-handoff-v13.7.json`

Closeout after exact-head green:
- reconcile PR #333 with latest `main`
- requalify reconciled exact head if `main` moved
- merge V13 to `main`
- proceed to V14 Exchange Web UI

## Invariants

1. APIs/indexers never create execution, custody, mint, burn or settlement authority.
2. Every externally visible record is traceable to canonical chain provenance or an explicitly labeled derived aggregate.
3. Reprocessing the same canonical event is idempotent.
4. Reorg handling removes/replaces orphaned projections without rewriting canonical history.
5. Derived market data is reproducible from canonical inputs and versioned aggregation rules.
6. V14 UI consumes V13 surfaces rather than directly inventing protocol state.
