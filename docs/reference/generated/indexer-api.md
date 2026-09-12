---
title: Generated 420Indexer API reference
audience:
  - developer
category: reference
status: generated
version: current
---

# Generated 420Indexer API reference

> GENERATED FILE - DO NOT EDIT. Regenerate from the checked-in `420-indexer/src` API contracts.

420Indexer is a read-only, rebuildable projection service. Its API is **non-authoritative**: security-sensitive balance, ownership, registration, settlement, governance, bridge, eligibility and finality decisions must be rechecked against canonical chain state or the owning protocol.

## Stable routes

| Route | Method | Scope | Paged | Parameters | Description |
| --- | --- | --- | --- | --- | --- |
| `/health` | `GET` | `global` | false | `none` | process liveness |
| `/ready` | `GET` | `chain` | false | `chainId` | database and indexed-head readiness |
| `/v1` | `GET` | `global` | false | `none` | public API version metadata |
| `/v1/status` | `GET` | `chain` | false | `chainId` | indexed head and finality metadata |
| `/v1/blocks` | `GET` | `chain` | true | `chainId, cursor?, limit?, direction?` | paged canonical block projection |
| `/v1/blocks/:id` | `GET` | `chain` | false | `chainId; path: id` | block by number or hash |
| `/v1/transactions` | `GET` | `chain` | true | `chainId, address?, cursor?, limit?, direction?` | paged transaction projection |
| `/v1/transactions/:hash` | `GET` | `chain` | false | `chainId; path: hash` | transaction by hash |
| `/v1/transactions/:hash/receipt` | `GET` | `chain` | false | `chainId; path: hash` | transaction receipt by hash |
| `/v1/logs` | `GET` | `chain` | true | `chainId, address?, cursor?, limit?, direction?` | paged canonical log projection |
| `/v1/addresses/:address` | `GET` | `chain` | false | `chainId; path: address` | indexed address metadata |
| `/v1/assets/transfers` | `GET` | `chain` | true | `chainId, assetKey?, address?, beforeBlock?, cursor?, limit?, direction?` | paged normalized asset transfers |
| `/v1/protocols/events` | `GET` | `chain` | true | `chainId, protocol?, objectKey?, cursor?, limit?, direction?` | paged typed protocol events |
| `/v1/protocols/:protocol/objects/:key` | `GET` | `chain` | false | `chainId; path: protocol, key` | latest typed protocol object state |
| `/v1/search` | `GET` | `chain` | false | `chainId, q, limit?` | bounded deterministic index search |

## Envelopes

Successful HTTP responses use:

```json
{ "apiVersion": "v1", "data": {} }
```

Errors use:

```json
{ "apiVersion": "v1", "error": { "code": "...", "message": "..." } }
```

## HTTP error surface

| Status | Code | Meaning |
| ---: | --- | --- |
| `400` | `invalid_request` | malformed URL, chainId, paging/filter input, path encoding, or required search input |
| `404` | `not_found` | route or requested indexed resource not found |
| `405` | `method_not_allowed` | public transport only supports GET |
| `500` | `internal_error` | generic backend/projection failure; internal exception text is not exposed |

`/ready` is special: when readiness is false it returns HTTP `503` **with the normal success envelope containing readiness data**, not an error envelope.

## Pagination and cursors

- Paged routes use opaque base64url keyset cursors, not page numbers or SQL offsets.
- Default `limit`: `50`.
- Maximum `limit`: `200`.
- `direction`: `asc` or `desc`; default is `desc`.
- Page responses use `{ items, nextCursor }`.
- Cursor shapes are route-specific and intentionally opaque to clients.

## Route-specific filters

- transactions: optional `address` filter matches sender or recipient.
- logs: optional `address` filter.
- asset transfers: optional `assetKey`, `address`, and unsigned `beforeBlock`.
- protocol events: optional `protocol` and `objectKey`.
- search: required non-empty `q`; optional `limit` uses the same `1..200` validation.
- all chain-scoped routes require decimal unsigned `chainId`.

## Health, readiness and status

`GET /health` reports process liveness only: `{ status: "ok", apiVersion: "v1" }`.

`GET /ready?chainId=...` checks database reachability plus presence of an indexed head and, when runtime state is available, runtime freshness/readiness. Its DTO includes `ready`, `databaseReady`, `chainId`, `indexedHead`, and optional runtime status.

`GET /v1/status?chainId=...` exposes `indexedHead`, head hash/timestamp, configured finality mode/confirmations, `safeHead`, optional lag/runtime status, and always sets `authoritative: false`.

## Authority boundary

Indexer output can drive lists, history, search, analytics, transfer journals and protocol projections. It must not be treated as canonical protocol authority. Consumers should preserve chain/finality provenance, tolerate non-finalized reorgs, and recheck canonical state before security-sensitive actions.
