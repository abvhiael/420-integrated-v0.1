# Indexer diagnostics and query workflow

This guide shows how to use the 420Indexer v1 public API safely inside Developer Hub and application tooling.

## Goal

Use Indexer health, readiness, status and public query endpoints without treating off-chain projection state as protocol authority.

## 1. Discover the service

Resolve only the selected network manifest's `services.indexer` endpoint.

```text
420 service indexer
420 indexer view
```

The service must be HTTP(S), contain no embedded credentials and remain bound to the selected network chain ID.

## 2. Check diagnostics

```text
420 indexer diagnostics
```

The diagnostic workflow combines:

- service health;
- chain-specific readiness;
- chain-specific Indexer status;
- selected chain ID;
- service endpoint;
- `canonicalAuthority: false` provenance.

A readiness HTTP 503 is diagnostic information. Preserve the readiness payload instead of flattening it into an opaque transport failure.

## 3. Query the public v1 API

The DEVHUB-11 client supports:

- blocks and block lookup;
- transactions and receipts;
- logs;
- address projections;
- asset transfers;
- protocol events;
- protocol object state;
- search.

Cursor-based list queries accept a validated cursor, `limit` from 1 to 200 and direction `asc` or `desc`.

```text
420 indexer search ProtocolRegistry 20
```

Breaking API versions fail closed rather than being silently interpreted with v1 semantics.

## 4. Understand what Indexer can prove

Indexer can tell a developer what it has indexed and projected. It cannot independently authorize:

- wallet capabilities;
- governance actions;
- settlement;
- Registry legitimacy;
- protocol role changes;
- final canonical chain state.

A healthy Indexer can still lag the chain. A correctly indexed row is still a projection.

## 5. Escalate to canonical authority

When a query result will affect a security decision:

1. identify the canonical object or contract from the Indexer result;
2. resolve the canonical contract/interface from DEVHUB discovery/catalogue;
3. query chain RPC or the owning protocol contract;
4. authorize only from that canonical source.

## Error handling

Preserve:

- HTTP status;
- Indexer error code;
- Indexer error message;
- v1 envelope version.

Do not convert `not_found`, lag/readiness or incompatible-version failures into invented chain facts.

## Boundary summary

| Information | Indexer appropriate? | Canonical security source? |
| --- | --- | --- |
| Search | Yes | No |
| History | Yes | No |
| UI projections | Yes | No |
| Service health/readiness | Yes | Operational only |
| Wallet permission | No | Wallet/Smart Account authority |
| Registry legitimacy | No | 420Registry |
| Final chain state | No | canonical RPC / owning contract |

Developer Hub should make Indexer convenient while making its non-authoritative nature impossible to miss.
