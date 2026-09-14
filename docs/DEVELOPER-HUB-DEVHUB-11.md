# 420 Developer Hub — DEVHUB-11 420Indexer Public API Integration

## Status

DEVHUB-11 adds the Developer Hub client boundary for the existing 420Indexer public API. The Hub discovers the Indexer from the selected network manifest, validates the v1 transport contract, exposes developer query helpers and diagnostics, and preserves the architectural rule that indexed projections are not canonical authorization state.

## Canonical boundary

420Indexer is the preferred off-chain query source for blocks, transactions, receipts, logs, addresses, asset transfers, protocol projections and search-style developer experiences. It does not own chain state, protocol authorization, Registry legitimacy, Wallet permissions or settlement authority.

Developer Hub therefore treats Indexer data as a sourced projection. Any workflow that changes security-relevant state must verify against the appropriate canonical chain/protocol authority rather than trusting an indexed row merely because it is convenient to query.

## Service discovery

`createIndexerClient420()` consumes a DEVHUB-1 discovered network and resolves only:

`services.indexer`

The endpoint must:

- exist;
- use HTTP or HTTPS;
- contain no embedded username/password credentials.

The selected network chain ID is attached to every chain-scoped request. The Hub does not infer chain identity from hostnames or UI labels.

## Public API contract

DEVHUB-11 targets 420Indexer API version `v1` and supports the current public routes:

- health;
- readiness;
- status;
- block list and block lookup;
- transaction list and transaction lookup;
- transaction receipt lookup;
- logs;
- address lookup;
- asset transfers;
- protocol events;
- protocol object state;
- search.

The client rejects response envelopes whose `apiVersion` is not `v1`; a future breaking Indexer API therefore cannot be silently interpreted with old semantics.

## Pagination

Cursor-based list queries support:

- `cursor`;
- `limit` from 1 through 200;
- `direction` of `asc` or `desc`.

Malformed pagination inputs fail before a request is sent. Asset-transfer `beforeBlock` values must be unsigned decimal strings so large block numbers are never truncated through JavaScript number conversion.

## Error handling

The client preserves structured Indexer errors where available:

- HTTP status;
- machine-readable error code;
- message.

A readiness response with HTTP 503 is intentionally preserved as readiness data instead of being converted into a generic transport exception. This allows the Developer Hub to explain lag or dependency readiness without pretending the service is healthy.

## Diagnostics

`client.diagnostics()` combines:

- Indexer health;
- chain-specific readiness;
- chain-specific status;
- selected chain ID;
- manifest-declared service endpoint;
- explicit `canonicalAuthority: false` metadata.

The control view also exposes the security rule:

`indexed projections must not authorize protocol state transitions`

This wording is machine-readable so browser/dashboard work in later phases cannot silently weaken the boundary.

## CLI

DEVHUB-11 adds:

```text
420 indexer view [--manifest PATH] [--catalogue PATH]
420 indexer diagnostics [--manifest PATH] [--catalogue PATH]
420 indexer search TERM [LIMIT] [--manifest PATH] [--catalogue PATH]
```

`indexer view` is local/control metadata only and performs no network query.

`indexer diagnostics` performs the health/readiness/status queries against the manifest-declared Indexer.

`indexer search` queries the public v1 search endpoint and remains projection-only data.

## Invariants

- **DEVHUB-INV-074** — 420Indexer is discovered only from the selected network manifest; Developer Hub does not hard-code or infer its service endpoint.
- **DEVHUB-INV-075** — every chain-scoped Indexer request binds to the selected network chain ID.
- **DEVHUB-INV-076** — only HTTP(S) Indexer service URLs are accepted and embedded endpoint credentials are rejected.
- **DEVHUB-INV-077** — DEVHUB-11 accepts only the supported `v1` response envelope and fails closed on incompatible API versions.
- **DEVHUB-INV-078** — pagination is validated locally against the public API contract before requests are sent.
- **DEVHUB-INV-079** — structured Indexer error code/message/status information is preserved for developer diagnostics.
- **DEVHUB-INV-080** — readiness HTTP 503 remains readiness data and is not confused with canonical chain failure.
- **DEVHUB-INV-081** — Indexer projections are explicitly non-canonical and may not authorize security-sensitive protocol state transitions.
- **DEVHUB-INV-082** — address/hash/path inputs are validated and encoded before entering public API routes.
- **DEVHUB-INV-083** — diagnostics expose source provenance and projection authority state alongside health/readiness/status.

## Exit criteria

DEVHUB-11 is complete when:

1. the Hub consumes the manifest-declared Indexer service;
2. the public v1 envelope is validated fail-closed;
3. all current public query families have typed/validated client helpers;
4. cursor pagination and filters match the Indexer transport contract;
5. structured errors and readiness semantics are preserved;
6. a developer diagnostic view reports health/readiness/status;
7. CLI control/diagnostic/search entry points exist;
8. tests enforce the non-authoritative projection boundary.

## Next

DEVHUB-12 adds protocol integration guides that connect the SDK, Wallet, deployment, verification and Indexer query paths into complete developer workflows without collapsing their separate authority boundaries.
