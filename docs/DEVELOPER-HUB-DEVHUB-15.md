# 420 Developer Hub — DEVHUB-15 Logs, Events & Debugging

## Status

DEVHUB-15 adds a developer debugging surface that correlates 420Indexer projections with canonical 420 chain RPC evidence. It is a diagnostic layer only and never becomes protocol, wallet, Registry, settlement, governance or verification authority.

The runtime, CLI and local dashboard surfaces are now wired to the same DEVHUB-15 debugging client so provenance and authority rules are identical across programmatic and human-facing workflows.

## Scope

DEVHUB-15 provides:

- transaction debugging by exact transaction hash;
- correlated Indexer transaction/receipt projections and canonical RPC transaction/receipt evidence;
- filtered indexed log queries;
- filtered protocol-event queries;
- service/RPC diagnostic bundles with explicit provenance;
- CLI transaction/log/event/diagnostic commands;
- dashboard transaction/log/event/diagnostic views;
- fail-closed chain binding between selected network and 420Indexer;
- strict transaction-hash/address/query-limit validation;
- source labels and security rules on every returned diagnostic view.

## Transaction debugging

`createDebugClient420().transaction(txHash)` retrieves four pieces of evidence in parallel:

1. the 420Indexer transaction projection;
2. the 420Indexer receipt projection;
3. `eth_getTransactionByHash` from canonical RPC;
4. `eth_getTransactionReceipt` from canonical RPC.

The resulting object keeps Indexer evidence under an explicitly non-canonical `indexer` section and RPC evidence under a `canonical` section. An indexed receipt is useful for developer UX but is not treated as sufficient finality proof.

## Logs and protocol events

DEVHUB-15 reuses the DEVHUB-11 public API:

- `/v1/logs` through `indexer.logs()`;
- `/v1/protocols/events` through `indexer.protocolEvents()`.

These views support validated limits and descending/ascending ordering. Address filters are validated as EVM addresses by the diagnostic layer before reaching Indexer.

Indexed logs/events are projections. Any security-sensitive conclusion derived from them must be revalidated against canonical RPC and/or the owning protocol contract.

## CLI surface

DEVHUB-15 extends `420 CLI` with:

```text
420 debug view
420 debug diagnostics
420 debug tx HASH
420 debug logs [ADDRESS] [LIMIT]
420 debug events PROTOCOL [OBJECT_KEY] [LIMIT]
```

`debug view` is network-free after local configuration validation and shows the authority boundary. The other commands perform live read-only diagnostics against the selected Indexer and/or canonical RPC. The CLI does not add signing, send-transaction or mutation commands as part of DEVHUB-15.

## Dashboard surface

The localhost DEVHUB-14 dashboard now exposes read-only endpoints:

```text
GET /api/debug/view
GET /api/debug/diagnostics
GET /api/debug/transaction?hash=...
GET /api/debug/logs?address=...&limit=...
GET /api/debug/events?protocol=...&objectKey=...&limit=...
```

The browser UI provides transaction, logs, protocol-event and diagnostic controls. The server rejects non-GET requests and intentionally exposes no generic RPC proxy, signing endpoint, raw transaction submission or state mutation route.

## Diagnostic bundle

The diagnostics view combines:

- 420Indexer health/readiness/status via DEVHUB-11;
- canonical RPC `eth_chainId`;
- the selected Developer Hub chain ID;
- explicit source and canonical/projection labels.

This is intended to answer questions such as:

- Is the Indexer healthy but behind?
- Is the selected network different from the Indexer network?
- Is a transaction visible in Indexer but absent from canonical RPC?
- Did Indexer project a receipt differently from the current canonical receipt?
- Are protocol events available as a query projection even though authorization must still use the owning contract?

## Authority model

| Evidence | Source | Canonical? |
| --- | --- | --- |
| indexed transaction | 420Indexer | No |
| indexed receipt | 420Indexer | No |
| indexed logs/events | 420Indexer | No |
| `eth_getTransactionByHash` | selected chain RPC | Yes for chain transaction state |
| `eth_getTransactionReceipt` | selected chain RPC | Yes for canonical receipt state |
| protocol authorization/state | owning protocol contract | Yes |
| debug correlation/explanation | Developer Hub | No |

Developer Hub may correlate disagreements; it may not silently resolve them by promoting a projection into canonical truth.

## Invariants

- **DEVHUB-INV-114** — DEVHUB-15 is diagnostic-only and has `canonicalAuthority: false`.
- **DEVHUB-INV-115** — the selected network and 420Indexer chain IDs must match before any debugging client can be created.
- **DEVHUB-INV-116** — transaction-debug requests require an exact 32-byte transaction hash and fail closed on malformed input.
- **DEVHUB-INV-117** — indexed transactions, receipts, logs and protocol events remain explicitly non-canonical projections.
- **DEVHUB-INV-118** — canonical transaction and receipt evidence is obtained from the selected chain RPC rather than inferred from Indexer.
- **DEVHUB-INV-119** — an indexed receipt cannot by itself establish canonical transaction finality.
- **DEVHUB-INV-120** — log address filters and query limits are validated before requests are sent.
- **DEVHUB-INV-121** — protocol-event projections cannot authorize settlement, governance, Registry legitimacy, wallet capability or other protocol transitions.
- **DEVHUB-INV-122** — diagnostic output preserves source provenance rather than flattening Indexer and RPC evidence into an ambiguous result.
- **DEVHUB-INV-123** — DEVHUB-15 introduces no signing, raw-key, deployment, Registry mutation, verification-classification or wallet-capability authority.
- **DEVHUB-INV-124** — CLI and dashboard debugging commands are read-only orchestration over the same DEVHUB-15 client semantics.
- **DEVHUB-INV-125** — dashboard debugging APIs accept GET only and expose no generic transaction-submission or state-mutation proxy.

## Exit criteria

DEVHUB-15 is complete when transaction correlation, logs, protocol events and diagnostic bundles are available through validated runtime, CLI and dashboard surfaces; hostile/mismatched inputs fail closed; tests preserve the Indexer/canonical-RPC boundary; and the next off-chain application credential work remains isolated to DEVHUB-16.

## Next

DEVHUB-16 adds API keys/application identity for off-chain Developer Hub services without confusing those credentials with on-chain Identity, wallet authorization or protocol roles.
