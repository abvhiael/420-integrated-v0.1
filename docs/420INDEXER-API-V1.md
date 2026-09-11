# 420Indexer Public API v1

420Indexer exposes a stable, read-only, rebuildable projection API for first-party consumers including 420Explorer, 420Search, 420Analytics, 420Wallet, 420Notifications, and the Developer Hub.

The API is never protocol authority. Canonical balances, ownership, registrations, settlements, rights, governance outcomes, bridge state, eligibility, and other protocol decisions remain on-chain.

## Response envelopes

Successful responses use:

```json
{ "apiVersion": "v1", "data": {} }
```

Errors use:

```json
{ "apiVersion": "v1", "error": { "code": "...", "message": "..." } }
```

Invalid client input returns `400 invalid_request`. Missing resources return `404 not_found`. Unsupported methods return `405 method_not_allowed`. Readiness may return `503` when the database or indexed head is unavailable. Backend or projection failures return a generic `500 internal_error` without exposing internal exception text.

## Route table

| Method | Route | Chain scoped | Paged | Purpose |
| --- | --- | --- | --- | --- |
| GET | `/health` | no | no | process liveness |
| GET | `/ready?chainId=` | yes | no | database and indexed-head readiness |
| GET | `/v1` | no | no | API version metadata |
| GET | `/v1/status?chainId=` | yes | no | indexed head and finality metadata |
| GET | `/v1/blocks?chainId=` | yes | yes | canonical block projection |
| GET | `/v1/blocks/:id?chainId=` | yes | no | block by number or hash |
| GET | `/v1/transactions?chainId=` | yes | yes | transaction projection, optional address filter |
| GET | `/v1/transactions/:hash?chainId=` | yes | no | transaction by hash |
| GET | `/v1/transactions/:hash/receipt?chainId=` | yes | no | receipt by transaction hash |
| GET | `/v1/logs?chainId=` | yes | yes | canonical logs, optional address filter |
| GET | `/v1/addresses/:address?chainId=` | yes | no | indexed address metadata |
| GET | `/v1/assets/transfers?chainId=` | yes | yes | normalized asset transfers |
| GET | `/v1/protocols/events?chainId=` | yes | yes | typed protocol event journal |
| GET | `/v1/protocols/:protocol/objects/:key?chainId=` | yes | no | latest typed protocol-object state |
| GET | `/v1/search?chainId=&q=` | yes | no | bounded deterministic search |

## Paging and filters

Paged routes use opaque cursors with bounded limits. The default page size is 50 and the hard maximum is 200. Supported direction values are `asc` and `desc`.

Additional filters include:

- transactions: `address`
- logs: `address`
- asset transfers: `assetKey`, `address`, `beforeBlock`
- protocol events: `protocol`, `objectKey`
- search: `q`, optional `limit`

Consumers must treat cursors as opaque and must not bind to SQL schemas, database row shapes, projection table names, or internal decoder structures.

## Operational semantics

`/health` only reports process liveness. `/ready` checks database access and indexed-head availability for the selected chain. `/v1/status` reports the indexed head, indexed head hash/timestamp, finality mode, configured confirmations when applicable, safe head, lag when available, and `authoritative: false`.

Operational metadata describes the indexer's projection state only. It does not certify canonical protocol outcomes.

## Stability boundary

The stable consumer boundary consists of the exported DTOs, `IndexerPublicApi420`, `INDEXER_V1_ROUTES_420`, versioned HTTP envelopes, bounded paging semantics, and documented route behavior. Internal query rows and storage schemas are not public API.
