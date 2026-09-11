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

## RPC-6 — rate limiting, quotas, resource bounds and abuse protection — implementation complete

Delivered:

- independent single-request and batch payload byte ceilings;
- a hard batch-entry limit;
- deterministic method-cost weights with higher cost for expensive queries/simulation/submission paths;
- aggregate batch cost enforcement so batching cannot bypass quotas;
- per-client token-bucket quotas with deterministic refill and retry guidance;
- per-client concurrency limits;
- global concurrency limits;
- batch concurrency charged by entry count/fanout units;
- explicit admission leases and idempotent release handling;
- a bounded tracked-client table;
- idle-client eviction that never removes active leases;
- fail-closed behavior when tracked-client capacity is exhausted;
- RPC-5-first ordering so malformed/privileged requests consume no RPC-6 quota;
- configurable policy validation and accounting snapshots;
- hostile-state tests and `docs/420RPC-RESOURCE-CONTROLS.md`.

RPC-6 governs gateway work only. Client accounting keys are not authentication claims; credential identity remains RPC-9 scope. Admission never changes transaction validity, chain state, consensus, fork choice or finality.

Exit gate: implementation is complete. Merge requires the exact final head to pass 420RPC, docs and repository-wide qualification and remain reconciled with current `main`.

## Remaining phases

- **RPC-7:** WebSocket transport and subscription lifecycle.
- **RPC-8:** enriched/indexer-backed read APIs with explicit derived-state semantics.
- **RPC-9:** authentication, API credentials and Developer Hub integration.
- **RPC-10:** observability, health/readiness, metrics and operational recovery.
- **RPC-11:** hostile-state and security hardening.
- **RPC-12:** testnet qualification and launch closeout.

## Authority rule

420RPC may refuse malformed, unsupported, privileged, over-budget, stale, wrong-chain or unsafe requests/upstreams, but it never determines canonical blocks, transaction validity, consensus, safe/finalized checkpoints or fork choice. Resource admission is gateway policy, not protocol authority.
