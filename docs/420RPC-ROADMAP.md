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

### RPC-5 — request validation, method policy and privileged-surface enforcement — complete

Delivered JSON-RPC envelope and parameter validation, public compatibility policy enforcement, privileged namespace exclusion, raw transaction byte checks, subscription-shape checks and stable local policy errors before upstream dispatch.

### RPC-6 — rate limiting, quotas, resource bounds and abuse protection — complete

Delivered weighted method admission, per-client token buckets, batch/count/byte/cost ceilings, per-client/global concurrency leases, bounded tracked-client state and fail-closed resource exhaustion behavior.

### RPC-7 — WebSocket transport and subscription lifecycle — complete

Delivered bounded sessions, subscription ownership/upstream binding, heartbeat and idle cleanup, queue backpressure bounds and explicit resubscription after upstream loss.

## RPC-8 — 420Indexer-backed enriched/read APIs — implementation complete

Delivered:

- an explicit derived-resource catalogue mapped to the stable 420Indexer v1 API;
- deterministic selection of only eligible `indexer-api` providers with `derived-read` capability;
- fail-closed exclusion of execution providers, wrong-chain Indexers, unready Indexers and capability-incompatible providers;
- chain-scoped request construction for status, blocks, transactions, receipts, logs, addresses, asset transfers, protocol events, protocol objects and search;
- validation of required route parameters before any upstream request is constructed;
- projection metadata validation for chain identity, readiness, observation time and staleness;
- explicit response provenance carrying `source: 420Indexer`, `derived: true`, `authoritative: false`, chain ID, upstream ID, indexed head and observation time;
- hostile-state tests proving Indexer data cannot silently satisfy canonical Ethereum RPC semantics;
- `docs/420RPC-INDEXER-READS.md`.

RPC-8 exposes rebuildable projection data only. Canonical Ethereum JSON-RPC remains execution-backed, and canonical balances, ownership, registrations, settlements, rights, governance outcomes, bridge state, eligibility, transaction validity, fork choice and finality remain outside Indexer authority.

Exit gate: implementation is complete. Merge requires the exact final head to pass 420RPC, docs and repository-wide qualification and remain reconciled with current `main`.

## Remaining phases

- **RPC-9:** authentication, API credentials and Developer Hub integration.
- **RPC-10:** observability, health/readiness, metrics and operational recovery.
- **RPC-11:** hostile-state and security hardening.
- **RPC-12:** testnet qualification and launch closeout.

## Authority rule

420RPC may refuse malformed, unsupported, privileged, over-budget, stale, wrong-chain or unsafe requests/upstreams and may expose clearly labeled derived projection data, but it never determines canonical blocks, transaction validity, consensus, safe/finalized checkpoints or fork choice. Derived Indexer responses remain non-authoritative by construction.
