# 420RPC RPC-8 — 420Indexer-derived reads

RPC-8 exposes selected 420Indexer v1 resources through 420RPC without presenting projection data as canonical Ethereum JSON-RPC state.

## Boundary

Canonical Ethereum JSON-RPC methods remain execution-RPC backed. RPC-8 is a distinct derived-read surface for indexed and enriched data. It cannot satisfy `eth_*` canonical reads and cannot submit transactions.

Every eligible upstream must be:

- class `indexer-api`;
- enabled and RPC-1 eligible;
- pinned to chain ID 420;
- explicitly non-authoritative;
- unable to submit transactions;
- HTTP(S)-based; and
- advertising the `derived-read` capability.

If no such upstream exists, the request fails closed. Execution providers are never substituted for derived-resource routing.

## Derived resources

RPC-8 maps to the stable 420Indexer v1 contract:

- status;
- block lists and block lookup;
- transaction lists and transaction lookup;
- receipt lookup;
- logs;
- indexed address metadata;
- normalized asset transfers;
- typed protocol events;
- typed protocol-object state; and
- bounded deterministic search.

All requests are chain scoped with `chainId=420`. Required path parameters are validated before route construction.

## Provenance envelope

RPC-8 wraps successful derived results with explicit provenance:

```json
{
  "source": "420Indexer",
  "derived": true,
  "authoritative": false,
  "chainId": "420",
  "upstreamId": "420indexer-primary",
  "indexedHead": "1234",
  "observedAtMs": 1789160000000,
  "data": {}
}
```

The wrapper is part of the trust boundary. Consumers must not strip or reinterpret these fields as a finality assertion.

## Projection metadata safety

Responses are wrapped only when projection metadata is:

- for the expected chain;
- explicitly non-authoritative;
- ready;
- non-negative in indexed head;
- not future-dated; and
- within the configured observation-age bound.

This freshness check concerns the indexer's projection observation only. It does not replace RPC-4 canonical execution freshness/finality safety.

## Authority rule

420Indexer is rebuildable derived infrastructure. RPC-8 may expose useful historical, search, transfer, address and protocol-object projections, but protocol truth remains on-chain. Canonical balances, ownership, registrations, settlements, rights, governance outcomes, bridge state, eligibility, transaction validity, fork choice and finality are never decided by RPC-8.
