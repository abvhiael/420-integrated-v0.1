---
title: 420Indexer API
audience:
  - developer
category: developer
status: development
version: current
---

# 420Indexer API

420Indexer exposes a stable, versioned, read-only projection API for applications that need efficient historical and query-oriented access to 420 Integrated data.

The API is not protocol authority. Canonical balances, ownership, registrations, settlements, rights, governance outcomes, bridge state, eligibility and other protocol decisions remain on-chain.

## Response envelope

Successful responses use:

```json
{ "apiVersion": "v1", "data": {} }
```

Errors use:

```json
{ "apiVersion": "v1", "error": { "code": "...", "message": "..." } }
```

Current stable error behavior includes:

- `400 invalid_request` for invalid client input;
- `404 not_found` for missing resources;
- `405 method_not_allowed` for unsupported methods;
- `503` readiness failure when the database or indexed head is unavailable;
- generic `500 internal_error` for backend/projection failures without leaking internal exception text.

## Stable v1 routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | process liveness only |
| GET | `/ready?chainId=` | database and indexed-head readiness |
| GET | `/v1` | API version metadata |
| GET | `/v1/status?chainId=` | indexed-head/finality metadata |
| GET | `/v1/blocks?chainId=` | paged block projection |
| GET | `/v1/blocks/:id?chainId=` | block by number or hash |
| GET | `/v1/transactions?chainId=` | paged transactions, optional address filter |
| GET | `/v1/transactions/:hash?chainId=` | transaction by hash |
| GET | `/v1/transactions/:hash/receipt?chainId=` | receipt by transaction hash |
| GET | `/v1/logs?chainId=` | paged canonical logs, optional address filter |
| GET | `/v1/addresses/:address?chainId=` | indexed address metadata |
| GET | `/v1/assets/transfers?chainId=` | normalized asset transfers |
| GET | `/v1/protocols/events?chainId=` | typed protocol-event journal |
| GET | `/v1/protocols/:protocol/objects/:key?chainId=` | latest typed protocol-object projection |
| GET | `/v1/search?chainId=&q=` | bounded deterministic search |

## Chain scoping

Every chain-scoped request must use the chain ID from the selected environment manifest. A reachable Indexer endpoint is not sufficient proof that the service belongs to the intended environment.

For security-sensitive integrations, pair chain ID with the environment/deployment identity described in [Networks and manifests](networks-and-manifests.md).

## Health, readiness and status

`/health` answers only whether the process is alive.

`/ready?chainId=` is stronger: it checks database access and indexed-head availability for the selected chain.

`/v1/status?chainId=` is the consumer-facing projection-state endpoint. It may expose indexed head, indexed head hash/timestamp, finality mode, configured confirmations where applicable, safe head, lag/freshness metadata and `authoritative: false`.

Do not equate HTTP 200 from `/health` with data readiness or freshness.

## Filters

Current documented filters include:

- transactions: `address`;
- logs: `address`;
- asset transfers: `assetKey`, `address`, `beforeBlock`;
- protocol events: `protocol`, `objectKey`;
- search: `q`, optional `limit`.

Do not depend on undocumented query fields or internal storage schemas.

## API stability boundary

The stable consumer boundary is the versioned HTTP contract, documented DTOs, route behavior, bounded paging rules and exported public API types.

The following are implementation details and must not be treated as public API:

- SQL schema/table names;
- database row shapes;
- decoder internals;
- projection implementation details;
- checkpoint storage format.

DOC-10 will own machine-generated API reference. This DOC-9 guide explains how to use the stable API safely.

## Related documentation

- [Reads and source selection](reads-and-source-selection.md)
- [Pagination, replay and reorgs](pagination-replay-and-reorgs.md)
- [API fallback and reliability](api-fallback-and-reliability.md)
- `docs/420INDEXER-API-V1.md`
