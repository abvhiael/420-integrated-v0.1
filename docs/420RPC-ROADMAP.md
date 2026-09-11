# 420RPC implementation roadmap

420RPC is the public ingress, routing and policy layer for 420 Integrated. It fronts compatible execution RPC providers and selected derived read services without becoming protocol authority.

## Delivery rule

Each numbered RPC phase is developed, reconciled against current `main`, fully qualified, and merged to `main` before the next phase begins.

## Completed phases

### RPC-0 — architecture and trust foundation — complete

Delivered the `420-rpc/` package, service authority boundaries, chain-ID pinning, Engine isolation, non-custodial transaction rules, TLS public transport, threat model and qualification workflow.

### RPC-1 — upstream abstraction and capability discovery — complete

Delivered normalized execution and Indexer provider descriptors, runtime capability discovery, chain binding, reachable-versus-eligible status and fail-closed provider qualification.

### RPC-2 — Ethereum JSON-RPC compatibility and method profiles — complete

Delivered the explicit public Ethereum JSON-RPC method catalogue, metadata/read/submit/subscription profiles, capability requirements, raw signed transaction submission, WebSocket compatibility, and fail-closed exclusion of unknown, signing/account and privileged methods.

### RPC-3 — routing, upstream health, circuit breaking and failover — complete

Delivered deterministic method/transport-aware provider selection, gateway-local circuit breakers, read/metadata failover, no ambiguous signed-transaction replay, and fail-closed routing when no qualified healthy provider exists.

### RPC-4 — chain identity, freshness and finality safety — complete

Delivered chain-observation validation, strict chain identity continuity, freshness and head-lag bounds, safe/finalized evidence requirements, fail-closed same-height checkpoint disagreement, and integration ahead of RPC-3 routing.

## RPC-5 — request validation, method policy and privileged-surface enforcement — implementation complete

Delivered:

- JSON-RPC 2.0 envelope validation;
- request-ID validation and default-deny public notifications;
- explicit RPC-2 catalogue enforcement before safety/routing;
- local blocking of Engine, admin, personal, debug, miner and txpool namespaces;
- continued exclusion of node-managed account/signing methods;
- positional-array parameter policy for the public surface;
- method-specific arity checks;
- canonical address, 32-byte hash, hex quantity, byte-data and block-selector validation;
- transaction call-object validation for `eth_call` and `eth_estimateGas`;
- log-filter validation including mutually exclusive `blockHash` versus block-range fields;
- fee-history percentile validation;
- non-empty signed raw transaction byte validation without rewriting transaction bytes;
- supported subscription type/filter validation;
- stable local JSON-RPC error classes: `-32600`, `-32601`, `-32602`;
- per-entry batch-envelope validation while leaving batch/resource limits to RPC-6;
- hostile-state tests and `docs/420RPC-REQUEST-POLICY.md`.

RPC-5 is a forwarding policy boundary only. Passing validation does not mean a transaction, call or block reference is valid on-chain; canonical execution nodes retain execution authority.

Exit gate: implementation is complete. Merge requires the exact final head to pass 420RPC, docs and repository-wide qualification and remain reconciled with current `main`.

## Remaining phases

- **RPC-6:** rate limits, quotas, batch/resource bounds and abuse protection.
- **RPC-7:** WebSocket transport and subscription lifecycle.
- **RPC-8:** enriched/indexer-backed read APIs with explicit derived-state semantics.
- **RPC-9:** authentication, API credentials and Developer Hub integration.
- **RPC-10:** observability, health/readiness, metrics and operational recovery.
- **RPC-11:** hostile-state and security hardening.
- **RPC-12:** testnet qualification and launch closeout.

## Authority rule

420RPC may refuse malformed, unsupported, privileged, stale, wrong-chain or unsafe requests/upstreams, but it never determines canonical blocks, transaction validity, consensus, safe/finalized checkpoints or fork choice. Request validation is gateway policy, not protocol authority.
